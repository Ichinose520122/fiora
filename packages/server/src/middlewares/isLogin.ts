import { Socket } from 'socket.io';
import { SESSION_EXPIRED, validateSocketSession } from '../utils/socketSession';

export const PLEASE_LOGIN = '请登录后再试';

/**
 * 拦截未登录用户请求需要登录态的接口
 */
export default function isLogin(socket: Socket) {
    const noRequireLoginEvent = new Set([
        'register',
        'login',
        'loginByToken',
        'connectionHealth',
    ]);
    return async ([event, , cb]: MiddlewareArgs, next: MiddlewareNext) => {
        if (socket.data.sessionExpired) {
            cb(SESSION_EXPIRED);
            return;
        }
        if (!socket.data.user) {
            if (noRequireLoginEvent.has(event)) next();
            else cb(PLEASE_LOGIN);
            return;
        }
        try {
            if (await validateSocketSession(socket)) next();
            else cb(SESSION_EXPIRED);
        } catch (error) {
            cb('登录状态校验失败，请稍后重试');
        }
    };
}
