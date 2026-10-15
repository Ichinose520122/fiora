/** @jest-environment node */
import http from 'http';
import { Server } from 'socket.io';
import { io as connect, Socket as Client } from 'socket.io-client';
import User from '@fiora/database/mongoose/models/user';
import isLogin from '../src/middlewares/isLogin';
import isAdmin from '../src/middlewares/isAdmin';
import registerRoutes from '../src/middlewares/registerRoutes';

jest.mock('@fiora/database/mongoose/models/user', () => ({ findById: jest.fn() }));
jest.mock('@fiora/config/server', () => ({ trustProxyHeaders: false, administrator: ['admin'] }));
jest.mock('@fiora/utils/logger', () => ({ info: jest.fn(), debug: jest.fn(), error: jest.fn() }));

describe('live Socket.IO session revocation', () => {
    it.each(['websocket', 'polling'])('acknowledges password changes and disconnects all old devices over %s', async (transport) => {
        const httpServer = http.createServer();
        const server = new Server(httpServer);
        const versions: Record<string, number> = { user: 0, admin: 0 };
        (User.findById as jest.Mock).mockImplementation(async (id) => ({ tokenVersion: versions[id] }));
        server.on('connection', (socket) => {
            socket.use(isLogin(socket));
            socket.use(isAdmin(socket));
            socket.use(registerRoutes(socket, {
                login: async (ctx) => {
                    ctx.socket.user = ctx.data.user;
                    ctx.socket.tokenVersion = ctx.data.version;
                    ctx.socket.join('chat');
                    return { ok: true };
                },
                changePassword: async (ctx) => {
                    versions[ctx.socket.user] += 1;
                    ctx.socket.invalidateSessions(ctx.socket.user);
                    return { msg: 'ok' };
                },
                resetUserPassword: async (ctx) => {
                    versions[ctx.data.user] += 1;
                    ctx.socket.invalidateSessions(ctx.data.user);
                    return { msg: 'ok' };
                },
                probe: async () => ({ ok: true }),
            }));
        });
        await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
        const url = `http://127.0.0.1:${(httpServer.address() as any).port}`;
        const clients: Client[] = [];
        const request = (client: Client, event: string, data = {}): Promise<any> =>
            new Promise((resolve) => client.emit(event, data, resolve));
        const device = async (user: string, version = 0) => {
            const client = connect(url, { transports: [transport], reconnection: false });
            clients.push(client);
            await new Promise<void>((resolve) => client.on('connect', resolve));
            const result = await request(client, 'login', { user, version });
            return { client, result };
        };
        try {
            const first = (await device('user')).client;
            const second = (await device('user')).client;
            const admin = (await device('admin')).client;
            const closed = [first, second].map((client) => new Promise((resolve) => client.once('disconnect', resolve)));
            expect(await request(first, 'changePassword')).toEqual({ msg: 'ok' });
            await Promise.all(closed);
            expect(admin.connected).toBe(true);
            expect(await request(admin, 'probe')).toEqual({ ok: true });
            expect(server.sockets.adapter.rooms.get('chat')?.size).toBe(1);
            // A login begun with old credentials cannot restore room access.
            expect((await device('user', 0)).result).toBe('token已过期');
            const fresh = await device('user', 1);
            expect(fresh.result).toEqual({ ok: true });
            expect(await request(fresh.client, 'probe')).toEqual({ ok: true });
            expect(await request(fresh.client, 'resetUserPassword', { user: 'admin' })).toBe('你不是管理员');
            const resetClosed = new Promise((resolve) => fresh.client.once('disconnect', resolve));
            expect(await request(admin, 'resetUserPassword', { user: 'user' })).toEqual({ msg: 'ok' });
            await resetClosed;
            expect(admin.connected).toBe(true);
        } finally {
            clients.forEach((client) => client.close());
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });
});
