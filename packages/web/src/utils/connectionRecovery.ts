/** Recover suspended/half-open connections without reloading the page. */
interface RecoverableSocket {
    connected: boolean;
    id: string;
    connect(): unknown;
    disconnect(): unknown;
    emit(event: string, data: object, callback: (response: any) => void): unknown;
    on(event: string, callback: (...args: any[]) => void): unknown;
    off(event: string, callback: (...args: any[]) => void): unknown;
}

export default function installConnectionRecovery(
    socket: RecoverableSocket,
    isRestoring: () => boolean,
    restoreSession: () => void,
) {
    let probeTimer: number | undefined;
    let probeVersion = 0;
    let lastCheck = -Infinity;
    let lastRestart = -Infinity;
    let frozen = false;
    let disposed = false;
    let failures = 0;

    function cancelProbe() {
        window.clearTimeout(probeTimer);
        probeTimer = undefined;
        probeVersion += 1;
    }
    function restart() {
        if (disposed || frozen || navigator.onLine === false || Date.now() - lastRestart < 5000) return;
        lastRestart = Date.now();
        cancelProbe();
        failures = 0;
        socket.disconnect();
        socket.connect();
    }
    function check() {
        // Hidden tabs can still receive messages. Only frozen/offline pages suspend checks.
        if (disposed || frozen || navigator.onLine === false) return;
        if (!socket.connected) {
            socket.connect();
            return;
        }
        if (probeTimer !== undefined || Date.now() - lastCheck < 5000) return;
        lastCheck = Date.now();
        const startedAt = lastCheck;
        const timeoutMs = document.hidden ? 90000 : 10000;
        const version = ++probeVersion;
        const connectionId = socket.id;
        const timedOut = (allowGrace: boolean) => {
            if (version !== probeVersion || socket.id !== connectionId) return;
            if (disposed || frozen || navigator.onLine === false) { cancelProbe(); return; }
            if (allowGrace && Date.now() - startedAt > timeoutMs + 5000) {
                // Delayed timers after suspension are not evidence of a dead transport.
                // Let queued acknowledgements run, but never defer failure forever.
                probeTimer = window.setTimeout(() => timedOut(false), 1000);
                return;
            }
            cancelProbe();
            failures += 1;
            if (failures >= 2) restart();
            else check();
        };
        probeTimer = window.setTimeout(() => timedOut(true), timeoutMs);
        socket.emit('connectionHealth', {}, (response) => {
            if (disposed || version !== probeVersion || socket.id !== connectionId) return;
            cancelProbe();
            // Any response proves transport liveness, even a server business error.
            failures = 0;
            if (response && typeof response === 'object' && response.ok === true &&
                window.localStorage.getItem('token') && response.authenticated === false && !isRestoring()) {
                restoreSession();
            }
        });
    }
    function resume() {
        if (disposed || frozen || document.hidden) return;
        check();
    }
    function visibilityChanged() {
        // Visibility changes also change the timeout policy. Start a fresh probe.
        cancelProbe();
        failures = 0;
        lastCheck = -Infinity;
        check();
    }
    function freeze() {
        frozen = true;
        cancelProbe();
    }
    function thaw() {
        frozen = false;
        visibilityChanged();
    }
    function resetConnection() {
        cancelProbe();
        failures = 0;
        lastCheck = -Infinity;
    }
    socket.on('connect', resetConnection);
    socket.on('disconnect', resetConnection);
    document.addEventListener('visibilitychange', visibilityChanged);
    document.addEventListener('freeze', freeze);
    document.addEventListener('resume', thaw);
    window.addEventListener('pagehide', freeze);
    window.addEventListener('pageshow', thaw);
    window.addEventListener('focus', resume);
    window.addEventListener('online', visibilityChanged);
    const interval = window.setInterval(check, 30000);
    return () => {
        disposed = true;
        cancelProbe();
        window.clearInterval(interval);
        socket.off('connect', resetConnection);
        socket.off('disconnect', resetConnection);
        document.removeEventListener('visibilitychange', visibilityChanged);
        document.removeEventListener('freeze', freeze);
        document.removeEventListener('resume', thaw);
        window.removeEventListener('pagehide', freeze);
        window.removeEventListener('pageshow', thaw);
        window.removeEventListener('focus', resume);
        window.removeEventListener('online', visibilityChanged);
    };
}
