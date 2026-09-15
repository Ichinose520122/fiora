import type { Socket } from 'socket.io-client';
export function socketRequest<T = any>(socket: Socket, event: string, data: any = {}, timeout = 30000): Promise<[string | null, T | null]> {
    if (!socket.connected) return Promise.resolve(['连接已断开，请稍后重试', null]);
    return new Promise((resolve) => {
        let settled = false;
        const finish = (result: [string | null, T | null]) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            socket.off('disconnect', disconnected);
            resolve(result);
        };
        const disconnected = () => finish(['连接已断开，请稍后重试', null]);
        const timer = setTimeout(() => finish(['请求超时，请检查消息是否已经发送再重试', null]), timeout);
        socket.on('disconnect', disconnected);
        socket.emit(event, data, (result: any) => finish(typeof result === 'string' ? [result, null] : [null, result]));
    });
}
