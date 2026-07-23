import { mocked } from 'ts-jest/utils';
import config from '@fiora/config/server';
import { Socket } from 'socket.io';
import isAdmin, {
    YOU_ARE_NOT_ADMINISTRATOR,
} from '../../src/middlewares/isAdmin';
import { getMiddlewareParams } from '../helpers/middleware';

jest.mock('@fiora/config/server');

describe('server/middlewares/isAdmin', () => {
    it('should call service fail when user not administrator', async () => {
        const socket = {
            id: 'id',
            data: {
                user: 'user',
            },
        } as Socket;
        const middleware = isAdmin(socket);

        const { args, cb, next } = getMiddlewareParams('sealUser');

        await middleware(args, next);
        expect(cb).toBeCalledWith(YOU_ARE_NOT_ADMINISTRATOR);
    });

    it('should protect sealing online user IPs', async () => {
        const socket = {
            id: 'id',
            data: {
                user: 'user',
            },
        } as Socket;
        const middleware = isAdmin(socket);

        const { args, cb, next } =
            getMiddlewareParams('sealUserOnlineIp');

        await middleware(args, next);
        expect(cb).toBeCalledWith(YOU_ARE_NOT_ADMINISTRATOR);
        expect(next).not.toBeCalled();
    });

    it('should call service success when user is administrator', async () => {
        mocked(config).administrator = ['administrator'];
        const socket = {
            id: 'id',
            data: {
                user: 'administrator',
            },
        } as Socket;
        const middleware = isAdmin(socket);

        const { args, next } = getMiddlewareParams('sealUser');

        await middleware(args, next);
        expect(next).toBeCalled();
    });

    it('should preserve administrator status loaded from database', async () => {
        mocked(config).administrator = [];
        const socket = {
            id: 'id',
            data: {
                user: 'database-administrator',
                isAdmin: true,
            },
        } as Socket;
        const middleware = isAdmin(socket);

        const { args, next } = getMiddlewareParams('createUser');

        await middleware(args, next);
        expect(next).toBeCalled();
    });
});
