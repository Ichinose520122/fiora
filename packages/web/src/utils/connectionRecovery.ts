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
) {
    const intervalMs = 30000;
    const timeoutMs = 8000;
    let probeTimer: number | undefined;
    let probeVersion = 0;
    let hiddenAt: number | undefined;
    let lastCheck = 0;
    let lastRestart = 0;

    function cancelProbe() {
        window.clearTimeout(probeTimer);
        probeTimer = undefined;
        probeVersion += 1;
    }

    function restart() {
        if (navigator.onLine === false || Date.now() - lastRestart < 5000) {
            return;
        }
        lastRestart = Date.now();
        cancelProbe();
        socket.disconnect();
        socket.connect();
    }

    function check() {
        if (document.hidden || navigator.onLine === false) {
            return;
        }
        if (!socket.connected) {
            socket.connect();
            return;
        }
        if (isRestoring() || probeTimer !== undefined || Date.now() - lastCheck < 5000) {
            return;
        }
        lastCheck = Date.now();
        const version = ++probeVersion;
        const connectionId = socket.id;
        probeTimer = window.setTimeout(() => {
            cancelProbe();
            if (!document.hidden && socket.id === connectionId) {
                restart();
            }
        }, timeoutMs);
        socket.emit('connectionHealth', {}, (response) => {
            if (version !== probeVersion || socket.id !== connectionId) {
                return;
            }
            cancelProbe();
            if (
                response && typeof response === 'object' &&
                response.ok === true &&
                (!window.localStorage.getItem('token') || response.authenticated)
            ) {
                return;
            }
            // A live transport can still have lost its server-side login/rooms.
            if (window.localStorage.getItem('token')) {
                restart();
            }
        });
    }

    function resume() {
        if (document.hidden) {
            return;
        }
        const slept = hiddenAt !== undefined && Date.now() - hiddenAt >= intervalMs;
        hiddenAt = undefined;
        cancelProbe();
        if (slept && socket.connected && window.localStorage.getItem('token')) {
            // Re-login and fetch history even if the old transport reports connected.
            restart();
        } else {
            check();
        }
    }

    function visibilityChanged() {
        if (document.hidden) {
            hiddenAt = Date.now();
            cancelProbe();
        } else {
            resume();
        }
    }

    function pageShown(event: PageTransitionEvent) {
        if (event.persisted) {
            hiddenAt = Date.now() - intervalMs;
        }
        resume();
    }

    socket.on('disconnect', cancelProbe);
    document.addEventListener('visibilitychange', visibilityChanged);
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    window.addEventListener('pageshow', pageShown);
    const interval = window.setInterval(check, intervalMs);

    return () => {
        cancelProbe();
        window.clearInterval(interval);
        socket.off('disconnect', cancelProbe);
        document.removeEventListener('visibilitychange', visibilityChanged);
        window.removeEventListener('focus', resume);
        window.removeEventListener('online', resume);
        window.removeEventListener('pageshow', pageShown);
    };
}
