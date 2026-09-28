import socket from '../socket';
import store from '../state/store';

const publicEvents = new Set(['register', 'login', 'loginByToken', 'connectionHealth']);

/** Wait only BEFORE emitting. An emitted mutation is never automatically replayed. */
export default function waitForConnection(event: string, timeout = 12000): Promise<string | null> {
    const token = window.localStorage.getItem('token');
    const requiresLogin = !publicEvents.has(event);
    const ready = () => socket.connected && (!requiresLogin || (store.getState().connect && !!store.getState().user));
    if (requiresLogin && !token) return Promise.resolve('请登录后再试');
    if (ready()) return Promise.resolve(null);
    return new Promise((resolve) => {
        let finished = false;
        let unsubscribe = () => {};
        let timer: number | undefined;
        const finish = (error: string | null) => {
            if (finished) return;
            finished = true;
            window.clearTimeout(timer);
            unsubscribe();
            socket.off('connect', check);
            window.removeEventListener('storage', check);
            resolve(error);
        };
        const check = () => {
            if (token !== window.localStorage.getItem('token')) finish('账号已切换，请重新操作');
            else if (ready()) finish(null);
        };
        unsubscribe = store.subscribe(check);
        socket.on('connect', check);
        window.addEventListener('storage', check);
        timer = window.setTimeout(() => finish('连接尚未恢复，请稍后重试'), timeout);
        check();
        if (!finished && !socket.connected && navigator.onLine !== false) socket.connect();
    });
}
