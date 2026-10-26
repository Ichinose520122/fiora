import { Readable } from 'stream';
import http from 'http';
import Koa from 'koa';
import config from '@fiora/config/server';
import BotConfig, { BotRequest } from '@fiora/database/mongoose/models/botConfig';
import User from '@fiora/database/mongoose/models/user';
import Group from '@fiora/database/mongoose/models/group';
import Friend from '@fiora/database/mongoose/models/friend';
import Message from '@fiora/database/mongoose/models/message';
import { Redis } from '@fiora/database/redis/initRedis';
import { authorizeBot, hash, publicConfig } from '../src/bot/config';
import { getBotConfig, saveBotConfig, rotateBotApiKey, revokeBotApiKey } from '../src/routes/bot';
import botHttp, { handleBotRequest } from '../src/bot/http';
import { sendMessage } from '../src/routes/message';

jest.mock('@fiora/config/server', () => ({ __esModule: true, default: { administrator: [] } }));
jest.mock('@fiora/database/mongoose/models/botConfig', () => ({ __esModule: true,
    default: { init: jest.fn(), findOne: jest.fn(), findOneAndUpdate: jest.fn() },
    BotRequest: { init: jest.fn(), findOneAndUpdate: jest.fn(), findOne: jest.fn(), updateOne: jest.fn() },
}));
jest.mock('@fiora/database/mongoose/models/user', () => ({ __esModule: true, default: { findById: jest.fn(), find: jest.fn(), exists: jest.fn() } }));
jest.mock('@fiora/database/mongoose/models/group', () => ({ __esModule: true, default: { find: jest.fn(), findById: jest.fn(), exists: jest.fn() } }));
jest.mock('@fiora/database/mongoose/models/friend', () => ({ __esModule: true, default: { find: jest.fn(), exists: jest.fn() } }));
jest.mock('@fiora/database/mongoose/models/message', () => ({ __esModule: true, default: { find: jest.fn(), findById: jest.fn() } }));
jest.mock('@fiora/database/redis/initRedis', () => ({ Redis: { has: jest.fn() }, getSealUserKey: (id: string) => id }));
jest.mock('../src/routes/message', () => ({ sendMessage: jest.fn() }));

const actor = 'a'.repeat(24); const bot = 'b'.repeat(24); const group = 'c'.repeat(24); const peer = 'd'.repeat(24);
const privateId = bot + peer; const token = 'fiora_bot_' + '1'.repeat(64);
let stored: any;
let users: any[];
const chain = (value: any) => ({ select: () => chain(value), sort: () => chain(value), limit: () => chain(value), populate: () => chain(value), lean: async () => value });
const ctx = (data: any = {}) => ({ socket: { user: actor, isAdmin: true }, data } as any);
const request = (path: string, query: any = {}, data?: any, method = 'GET') => handleBotRequest(token, method, path, query, data, jest.fn());

beforeEach(() => {
    jest.clearAllMocks(); (config.administrator as string[]) = [];
    stored = { enabled: true, userId: bot, allowedGroupIds: [group], allowPrivate: false, apiKeyHash: hash(token), apiKeyPrefix: token.slice(0, 18), revision: 'rev', updatedAt: new Date() };
    users = [{ _id: bot, username: 'Bot', isAdmin: false }];
    (BotConfig.findOne as jest.Mock).mockImplementation(() => chain(stored));
    (BotConfig.findOneAndUpdate as jest.Mock).mockImplementation((_filter, update) => { stored = { ...stored, ...update.$set }; return chain(stored); });
    (User.findById as jest.Mock).mockImplementation((id: string) => chain(id === actor ? { _id: actor, isAdmin: true } : users.find(user => user._id === id)));
    (User.find as jest.Mock).mockImplementation(() => chain(users)); (User.exists as jest.Mock).mockResolvedValue(true);
    (Redis.has as jest.Mock).mockResolvedValue(false);
    (Group.find as jest.Mock).mockReturnValue(chain([{ _id: group, name: 'Group' }]));
    (Group.exists as jest.Mock).mockResolvedValue(true);
    (Group.findById as jest.Mock).mockReturnValue(chain({ _id: group, members: [bot, peer] }));
    (Friend.find as jest.Mock).mockReturnValue(chain([])); (Friend.exists as jest.Mock).mockResolvedValue(true);
    (Message.find as jest.Mock).mockReturnValue(chain([]));
    (BotRequest.init as jest.Mock).mockResolvedValue(undefined);
    (BotRequest.findOneAndUpdate as jest.Mock).mockImplementation((_filter, update) => chain(update.$setOnInsert));
    (sendMessage as jest.Mock).mockResolvedValue({ _id: 'e'.repeat(24) });
});

test('default public configuration hides all credentials and internal revisions', async () => {
    const result = await getBotConfig(ctx());
    expect(result.config.hasApiKey).toBe(true);
    expect(JSON.stringify(result)).not.toContain(hash(token)); expect(JSON.stringify(result)).not.toContain(token);
    expect(result.config).not.toHaveProperty('revision');
    expect(publicConfig({})).toEqual({ enabled: false, userId: '', allowedGroupIds: [], allowPrivate: false, hasApiKey: false, apiKeyPrefix: '', updatedAt: null });
});

test.each([getBotConfig, saveBotConfig, rotateBotApiKey, revokeBotApiKey])('management rechecks real administrator instead of trusting socket cache', async (handler) => {
    (User.findById as jest.Mock).mockReturnValue(chain({ _id: actor, isAdmin: false }));
    await expect(handler(ctx())).rejects.toThrow('你不是管理员');
    expect(BotConfig.findOneAndUpdate).not.toHaveBeenCalled();
});

test('rotation reveals a random key once, persists only digest, and immediately rejects the old key', async () => {
    const result = await rotateBotApiKey(ctx());
    expect(result.apiKey).toMatch(/^fiora_bot_[a-f0-9]{64}$/);
    expect(stored.apiKeyHash).toBe(hash(result.apiKey)); expect(stored.apiKeyHash).not.toBe(result.apiKey);
    await expect(authorizeBot(token)).rejects.toMatchObject({ status: 401 });
    expect((await authorizeBot(result.apiKey)).settings.userId).toBe(bot);
    await revokeBotApiKey(ctx());
    await expect(authorizeBot(result.apiKey)).rejects.toMatchObject({ status: 401 });
});

test('switching identity clears all scopes and invalidates its key', async () => {
    users.push({ _id: peer, username: 'Other', isAdmin: false });
    const result = await saveBotConfig(ctx({ enabled: true, userId: peer, allowedGroupIds: [group], allowPrivate: true }));
    expect(result.config).toMatchObject({ userId: peer, allowedGroupIds: [], allowPrivate: false, hasApiKey: false });
    await expect(authorizeBot(token)).rejects.toMatchObject({ status: 401 });
});

test('scope save verifies account and all group memberships', async () => {
    (Group.find as jest.Mock).mockReturnValue(chain([]));
    await expect(saveBotConfig(ctx({ enabled: true, userId: bot, allowedGroupIds: [group], allowPrivate: false }))).rejects.toThrow('已加入');
    users[0].isAdmin = true;
    await expect(saveBotConfig(ctx({ enabled: true, userId: bot, allowedGroupIds: [], allowPrivate: true }))).rejects.toThrow('非管理员');
});

test('disabled, promoted and banned identities cannot use valid keys', async () => {
    stored.enabled = false; await expect(request('/identity')).rejects.toMatchObject({ status: 401 });
    stored.enabled = true; users[0].isAdmin = true; await expect(request('/identity')).rejects.toThrow('非管理员');
    users[0].isAdmin = false; (Redis.has as jest.Mock).mockResolvedValue(true); await expect(request('/identity')).rejects.toThrow('封禁');
});

test('identity truthfully advertises text, history, polling and membership queries', async () => {
    expect(await request('/identity')).toMatchObject({ user: { id: bot }, capabilities: { send: { text: true, image: false, reply: false, recall: false }, member: { list: true, mute: false } } });
});

test('history rejects unscoped and removed groups and redacts withdrawn messages', async () => {
    await expect(request('/history', { conversationId: peer })).rejects.toThrow('授权范围');
    (Group.exists as jest.Mock).mockResolvedValue(false);
    await expect(request('/history', { conversationId: group })).rejects.toThrow('不在');
    (Group.exists as jest.Mock).mockResolvedValue(true);
    (Message.find as jest.Mock).mockReturnValue(chain([{ _id: 'e'.repeat(24), to: group, from: { _id: peer, username: 'Peer' }, type: 'text', content: 'secret', deleted: true, createTime: new Date() }]));
    expect((await request('/history', { conversationId: group }) as any).messages[0]).toMatchObject({ content: '', deleted: true });
    expect(Message.find).toHaveBeenLastCalledWith({ to: group }, expect.any(Object), { sort: { createTime: -1, _id: -1 }, limit: 31 });
});

test('private reads and sends require explicit scope and current mutual friendship', async () => {
    await expect(request('/history', { conversationId: privateId })).rejects.toThrow('授权范围');
    stored.allowPrivate = true;
    (Friend.exists as jest.Mock).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(request('/history', { conversationId: privateId })).rejects.toThrow('双向好友');
    await request('/history', { conversationId: privateId });
    expect(Friend.exists).toHaveBeenCalledWith({ from: bot, to: peer }); expect(Friend.exists).toHaveBeenCalledWith({ from: peer, to: bot });
});

test('sending uses ordinary message permissions, literal text and a durable retry key', async () => {
    const data = { conversationId: group, content: '/music stop', requestId: '12345678-1234-1234-1234-123456789abc', userId: actor, isAdmin: true };
    await request('/messages', {}, data, 'POST');
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ data: { to: group, type: 'text', content: '/music stop' }, socket: expect.objectContaining({ user: bot, isAdmin: false }) }), { literalText: true, bridgeKey: `bot:${hash(token)}:${data.requestId}` });
    (BotRequest.findOneAndUpdate as jest.Mock).mockReturnValue(chain({ digest: 'different' }));
    await expect(request('/messages', {}, { ...data, content: 'different' }, 'POST')).rejects.toMatchObject({ status: 409 });
    expect(sendMessage).toHaveBeenCalledTimes(1);
});

test('poll starts at tail, binds cursors to current configuration and caps replay at five minutes', async () => {
    const initial = await request('/events') as any;
    expect(initial).toMatchObject({ events: [], hasMore: false, reset: true }); expect(Message.find).not.toHaveBeenCalled();
    await request('/events', { cursor: initial.cursor, limit: '1' });
    expect(Message.find).toHaveBeenCalledWith(expect.objectContaining({ to: { $in: [group] } }), expect.any(Object), expect.objectContaining({ limit: 2 }));
    await expect(request('/events', { cursor: initial.cursor + 'x' })).rejects.toThrow('游标');
    stored.revision = 'changed'; await expect(request('/events', { cursor: initial.cursor })).rejects.toThrow('失效');
    stored.revision = 'rev';
    const date = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 301000);
    try { await expect(request('/events', { cursor: initial.cursor })).rejects.toMatchObject({ status: 409 }); } finally { date.mockRestore(); }
});

test('message and member queries enforce scope and return only public fields', async () => {
    (Message.findById as jest.Mock).mockReturnValue(chain({ _id: 'e'.repeat(24), to: peer, content: 'secret', createTime: new Date() }));
    await expect(request('/messages/' + 'e'.repeat(24))).rejects.toThrow('授权范围');
    const result = await request('/members', { conversationId: group }) as any;
    expect(result.members).toEqual([{ id: bot, name: 'Bot', avatar: '' }]);
    expect(User.find).toHaveBeenCalledWith(expect.any(Object), { username: 1, avatar: 1 });
    await expect(request('/history', { conversationId: group, limit: '999' })).rejects.toThrow('50');
});

test('completed sends return their durable receipt after the message is removed', async () => {
    const data = { conversationId: group, content: 'hello', requestId: '22345678-1234-1234-1234-123456789abc' };
    (BotRequest.findOneAndUpdate as jest.Mock).mockReturnValue(chain({ digest: hash(JSON.stringify([group, data.content])), messageId: 'e'.repeat(24) }));
    expect(await request('/messages', {}, data, 'POST')).toEqual({ id: 'e'.repeat(24), conversationId: group });
    expect(sendMessage).not.toHaveBeenCalled();
});

test('poll overlap recovers an insert committed after an empty poll and paginates forward', async () => {
    const start = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(start);
    try {
        const initial = await request('/events') as any;
        clock.mockReturnValue(start + 1000);
        const empty = await request('/events', { cursor: initial.cursor }) as any;
        const item = { _id: 'e'.repeat(24), to: group, from: { _id: peer, username: 'Peer' }, type: 'text', content: 'late commit', createTime: new Date(start + 500) };
        (Message.find as jest.Mock).mockImplementation((filter) => chain(item.createTime > filter.$or[0].createTime.$gt ? [item] : []));
        const late = await request('/events', { cursor: empty.cursor }) as any;
        expect(late.events[0].message.content).toBe('late commit');
        (Message.find as jest.Mock).mockReturnValue(chain([item, { ...item, _id: 'f'.repeat(24) }]));
        const page = await request('/events', { cursor: late.cursor, limit: '1' }) as any;
        expect(page.hasMore).toBe(true);
        await request('/events', { cursor: page.cursor, limit: '1' });
        expect(Message.find).toHaveBeenLastCalledWith(expect.objectContaining({ $or: [
            { createTime: { $gt: item.createTime } }, { createTime: item.createTime, _id: { $gt: item._id } },
        ] }), expect.any(Object), expect.any(Object));
    } finally { clock.mockRestore(); }
});

test('HTTP boundary rejects browser origins, malformed credentials, non-JSON and oversized bodies', async () => {
    const middleware = botHttp({ to: () => ({ emit: jest.fn() }) } as any);
    const run = async (headers: any, body = '{}', method = 'POST') => {
        const req = Readable.from([Buffer.from(body)]); (req as any).socket = { remoteAddress: '127.0.0.1' };
        const context: any = { path: '/api/bot/v1/messages', method, req, query: {}, get: (name: string) => headers[name] || '', set: jest.fn(), is: (type: string) => headers['Content-Type'] === type };
        await middleware(context, jest.fn()); return context;
    };
    const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
    expect((await run({ ...headers, Origin: 'https://evil.example' })).status).toBe(403);
    expect((await run({ ...headers, Authorization: 'Bearer forged' })).status).toBe(401);
    expect((await run({ ...headers, 'Content-Type': 'text/plain' })).status).toBe(415);
    expect((await run(headers, '{')).status).toBe(400);
    expect((await run(headers, 'x'.repeat(16385))).status).toBe(413);
    expect((await run(headers, '[]')).status).toBe(403);
});

test('real HTTP transport authenticates, reads bounded JSON, applies scopes and never opens CORS', async () => {
    const app = new Koa(); app.use(botHttp({ to: () => ({ emit: jest.fn() }) } as any));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const send = (path: string, body?: string, headers: any = {}) => new Promise<any>((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port: (server.address() as any).port, path: '/api/bot/v1' + path,
            method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...headers } }, res => {
            const chunks: Buffer[] = []; res.on('data', value => chunks.push(value));
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(Buffer.concat(chunks).toString()) }));
        });
        req.on('error', reject); req.end(body);
    });
    try {
        const identity = await send('/identity'); expect(identity.status).toBe(200); expect(identity.body.user.id).toBe(bot);
        expect(identity.headers['cache-control']).toBe('no-store'); expect(identity.headers['access-control-allow-origin']).toBeUndefined();
        expect((await send('/identity', undefined, { Authorization: 'Bearer invalid' })).status).toBe(401);
        expect((await send('/history?conversationId=' + peer)).status).toBe(403);
        expect((await send('/messages', '{')).status).toBe(400);
        expect((await send('/messages', 'x'.repeat(17000))).status).toBe(413);
        expect((await send('/messages', JSON.stringify({ conversationId: group, content: '/watch', requestId: '12345678-1234-1234-1234-123456789abd' }))).status).toBe(200);
        await revokeBotApiKey(ctx()); expect((await send('/identity')).status).toBe(401);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
