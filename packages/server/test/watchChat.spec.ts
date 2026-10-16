import config from '@fiora/config/server';
import User from '@fiora/database/mongoose/models/user';
import Message from '@fiora/database/mongoose/models/message';
import { Redis } from '@fiora/database/redis/initRedis';
import { issueWatchChatGrant, verifyWatchChatGrant } from '../src/utils/watchGrant';
import { handleWatchChat } from '../src/watch/chat';
import { sendMessage } from '../src/routes/message';
import getLinkmanAccess from '../src/utils/linkmanAccess';
import Koa from 'koa';
import http from 'http';
import watchChat from '../src/watch/chat';
jest.mock('../src/routes/message', () => ({ sendMessage: jest.fn() }));
jest.mock('../src/utils/linkmanAccess', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@fiora/database/mongoose/models/user', () => ({ __esModule: true, default: { findById: jest.fn() } }));
jest.mock('@fiora/database/mongoose/models/message', () => ({ __esModule: true, default: { find: jest.fn() } }));
jest.mock('@fiora/database/redis/initRedis', () => ({ Redis: { has: jest.fn() }, getSealUserKey: (id: string) => id }));
const user = 'a'.repeat(24); const room = 'b'.repeat(24);
beforeEach(() => {
    jest.clearAllMocks(); config.watch.secret = 'test-only-secret-0123456789abcdef0123456789';
    (User.findById as jest.Mock).mockReturnValue({ select: () => ({ lean: async () => ({ tokenVersion: 7, isAdmin: false }) }) });
    (getLinkmanAccess as jest.Mock).mockResolvedValue({ group: null }); (Redis.has as jest.Mock).mockResolvedValue(false);
    (sendMessage as jest.Mock).mockResolvedValue({ _id: 'message' });
});
test('chat credential lasts 180 minutes, rejects altered and expired tokens', () => {
    const now = Date.now(); const token = issueWatchChatGrant(user, room, 7, now);
    expect(verifyWatchChatGrant(token, now + 179 * 60000).sub).toBe(user);
    expect(() => verifyWatchChatGrant(token, now + 180 * 60000)).toThrow();
    expect(() => verifyWatchChatGrant(token + 'x')).toThrow();
});
test('password changes, removed members and banned users lose chat access', async () => {
    await expect(handleWatchChat(issueWatchChatGrant(user, room, 6), { action: 'read' }, jest.fn())).rejects.toThrow('登录已失效');
    (getLinkmanAccess as jest.Mock).mockRejectedValueOnce(new Error('你不在该群组中'));
    await expect(handleWatchChat(issueWatchChatGrant(user, room, 7), { action: 'read' }, jest.fn())).rejects.toThrow('你不在');
    (Redis.has as jest.Mock).mockResolvedValue(true);
    await expect(handleWatchChat(issueWatchChatGrant(user, room, 7), { action: 'read' }, jest.fn())).rejects.toThrow('封禁');
});
test('comments use the normal message pipeline with scoped idempotency and no commands', async () => {
    const emit = jest.fn(); const requestId = '12345678-1234-1234-1234-123456789abc';
    await handleWatchChat(issueWatchChatGrant(user, room, 7), { action: 'send', content: '/watch', requestId, room: 'c'.repeat(24), user: 'evil' }, emit);
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ data: { to: room, type: 'text', content: '/watch' }, socket: { user, isAdmin: false, emit } }), { literalText: true, bridgeKey: `watch:${user}:${room}:${requestId}` });
});
test('reads only signed-room text messages and redacts retracted contents', async () => {
    (Message.find as jest.Mock).mockReturnValue({ populate: () => ({ lean: async () => [{ _id: '2', content: 'secret', deleted: true, from: { _id: user, username: 'Alice' } }, { _id: '1', content: 'hello', from: { _id: user, username: 'Alice' } }] }) });
    const result = await handleWatchChat(issueWatchChatGrant(user, room, 7), { action: 'read', room: 'evil' }, jest.fn());
    expect(Message.find).toHaveBeenCalledWith({ to: room, type: 'text' }, expect.any(Object), expect.any(Object));
    expect((result as any).messages.map((item: any) => item.content)).toEqual(['hello', '']);
});

test('HTTP endpoint authenticates the grant, reads bounded JSON and returns permission failures', async () => {
    (Message.find as jest.Mock).mockReturnValue({ populate: () => ({ lean: async () => [] }) });
    const app = new Koa(); app.use(watchChat({ to: () => ({ emit: jest.fn() }) } as any));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const request = (token: string, body = JSON.stringify({ action: 'read' })) => new Promise<{ status: number; body: any }>((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port: (server.address() as any).port, path: '/api/watch/chat', method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }, res => {
            const chunks: Buffer[] = []; res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve({ status: res.statusCode!, body: JSON.parse(Buffer.concat(chunks).toString()) }));
        });
        req.on('error', reject); req.end(body);
    });
    try {
        expect(await request(issueWatchChatGrant(user, room, 7))).toEqual({ status: 200, body: { messages: [] } });
        expect((await request('forged')).status).toBe(401);
        expect((await request(issueWatchChatGrant(user, room, 6))).status).toBe(403);
        expect((await request(issueWatchChatGrant(user, room, 7), JSON.stringify({ action: 'read', excess: 'x'.repeat(17000) }))).status).toBe(403);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
