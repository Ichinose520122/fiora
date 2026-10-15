import { Socket } from 'socket.io';
import isLogin, { PLEASE_LOGIN } from '../../src/middlewares/isLogin';
import { getMiddlewareParams } from '../helpers/middleware';
import User from '@fiora/database/mongoose/models/user';
import { expireUserSessions, SESSION_EXPIRED } from '../../src/utils/socketSession';

jest.mock('@fiora/database/mongoose/models/user', () => ({ findById: jest.fn() }));

function connectedSocket(user = 'user', tokenVersion = 0): any {
    const rooms = new Set(['socket-id', 'group']);
    return {
        data: { user, tokenVersion }, rooms,
        leave: jest.fn((room) => rooms.delete(room)), conn: { close: jest.fn() },
    };
}

describe('server/middlewares/isLogin', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (User.findById as jest.Mock).mockResolvedValue({ tokenVersion: 0 });
    });
    it('should call service fail when user not login', async () => {
        const socket = {
            id: 'id',
            data: {},
        } as Socket;
        const middleware = isLogin(socket);

        const { args, cb, next } = getMiddlewareParams('sendMessage');

        await middleware(args, next);
        expect(cb).toBeCalledWith(PLEASE_LOGIN);
    });

    it('should call service success when user is login', async () => {
        const socket = {
            id: 'id',
            data: {
                user: 'user',
                tokenVersion: 0,
            },
        } as Socket;
        const middleware = isLogin(socket);

        const { args, next } = getMiddlewareParams('sendMessage');

        await middleware(args, next);
        expect(next).toBeCalled();
    });

    it('should allow login without an existing session', async () => {
        const socket = {
            id: 'id',
            data: {},
        } as Socket;
        const middleware = isLogin(socket);

        const { args, next } = getMiddlewareParams('login');

        await middleware(args, next);
        expect(next).toBeCalled();
    });

    it('should reject guest history access without login', async () => {
        const socket = {
            id: 'id',
            data: {},
        } as Socket;
        const middleware = isLogin(socket);

        const { args, cb, next } = getMiddlewareParams(
            'getDefaultGroupHistoryMessages',
        );

        await middleware(args, next);
        expect(cb).toBeCalledWith(PLEASE_LOGIN);
        expect(next).not.toBeCalled();
    });

    it.each(['sendMessage', 'resetUserPassword', 'connectionHealth'])('rejects a stale session on %s', async (event) => {
        const socket = connectedSocket();
        (User.findById as jest.Mock).mockResolvedValue({ tokenVersion: 1 });
        const { args, cb, next } = getMiddlewareParams(event);
        await isLogin(socket)(args, next);
        expect(cb).toHaveBeenCalledWith(SESSION_EXPIRED);
        expect(next).not.toHaveBeenCalled();
        expect(socket.data.user).toBeUndefined();
        expect(socket.rooms.size).toBe(0);
        await new Promise(setImmediate);
        expect(socket.conn.close).toHaveBeenCalledTimes(1);
    });

    it('rejects deleted accounts and missing session versions', async () => {
        for (const missingAccount of [false, true]) {
            const socket = connectedSocket();
            if (missingAccount) (User.findById as jest.Mock).mockResolvedValue(null);
            else delete socket.data.tokenVersion;
            const { args, cb, next } = getMiddlewareParams('sendMessage');
            await isLogin(socket)(args, next);
            expect(cb).toHaveBeenCalledWith(SESSION_EXPIRED);
            expect(next).not.toHaveBeenCalled();
        }
    });

    it('supports legacy database records at version zero', async () => {
        (User.findById as jest.Mock).mockResolvedValue({});
        const { args, next } = getMiddlewareParams('sendMessage');
        await isLogin(connectedSocket())(args, next);
        expect(next).toHaveBeenCalled();
    });

    it('fails closed when the database cannot verify the session', async () => {
        (User.findById as jest.Mock).mockRejectedValue(new Error('offline'));
        const { args, cb, next } = getMiddlewareParams('sendMessage');
        await isLogin(connectedSocket())(args, next);
        expect(cb).toHaveBeenCalledWith('登录状态校验失败，请稍后重试');
        expect(next).not.toHaveBeenCalled();
    });

    it('revokes every device of the target user without disconnecting other users', async () => {
        const first = connectedSocket(); const second = connectedSocket();
        const other = connectedSocket('admin');
        first.nsp = { sockets: new Map([['one', first], ['two', second], ['other', other]]) };
        expireUserSessions(first, 'user');
        expect(first.rooms.size).toBe(0); expect(second.rooms.size).toBe(0);
        expect(other.data.user).toBe('admin'); expect(other.rooms.size).toBe(2);
        await new Promise(setImmediate);
        expect(first.conn.close).toHaveBeenCalled(); expect(second.conn.close).toHaveBeenCalled();
        expect(other.conn.close).not.toHaveBeenCalled();
    });
});
