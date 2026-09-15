import socket from '../socket';
import store from '../state/store';

// Android's document picker can keep the app in the background long enough for
// the socket to disconnect. Transport reconnection precedes login restoration.
export default function waitForSession(userId: string, timeout = 30000): Promise<void> {
    return new Promise((resolve, reject) => {
        let done = false;
        let unsubscribe = () => {};
        const finish = (error?: string) => {
            if (done) return;
            done = true; clearTimeout(timer); unsubscribe();
            if (error) reject(new Error(error)); else resolve();
        };
        const inspect = () => {
            const state = store.getState();
            if (!userId || state.user?._id !== userId) finish('账号已退出或切换，请重新选择文件');
            else if (socket.connected && state.connect) finish();
        };
        const timer = setTimeout(() => finish('连接仍在恢复，请网络连接正常后重试'), timeout);
        unsubscribe = store.subscribe(inspect);
        inspect();
        if (!done && !socket.connected) socket.connect();
    });
}
