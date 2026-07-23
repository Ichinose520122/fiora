import { Socket } from 'socket.io';
import isLogin, { PLEASE_LOGIN } from '../../src/middlewares/isLogin';
import { getMiddlewareParams } from '../helpers/middleware';

describe('server/middlewares/isLogin', () => {
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
});
