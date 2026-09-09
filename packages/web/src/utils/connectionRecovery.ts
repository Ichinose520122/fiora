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
        // Keep an in-flight probe: focus/pageshow/visibilitychange often arrive together.
        check();
    }

    function visibilityChanged() {
        if (document.hidden) {
            cancelProbe();
            lastCheck = 0;
        } else {
            resume();
        }
    }

    function pageShown() {
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
