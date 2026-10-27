import assert from 'assert';
import { createHmac, timingSafeEqual } from 'crypto';
import { Context as KoaContext, Next } from 'koa';
import { Server } from 'socket.io';
import Group from '@fiora/database/mongoose/models/group';
import Friend from '@fiora/database/mongoose/models/friend';
import User from '@fiora/database/mongoose/models/user';
import Message from '@fiora/database/mongoose/models/message';
import { BotRequest, BotConfigDocument } from '@fiora/database/mongoose/models/botConfig';
import getFriendId from '@fiora/utils/getFriendId';
import { sendMessage } from '../routes/message';
import { uploadFile } from '../routes/system';
import { authorizeBot, BotError, hash, identifier } from './config';

const rates = new Map<string, number[]>();
const FiveMinutes = 5 * 60 * 1000;
const MaxRequestBytes = 16 * 1024;
const MaxImageBytes = 15 * 1024 * 1024;
// Base64 expands each three decoded bytes to four characters; reserve room for JSON fields.
const MaxImageRequestBytes = Math.ceil(MaxImageBytes / 3) * 4 + MaxRequestBytes;
const RequestTimeout = 10 * 1000;
const ImageRequestTimeout = 120 * 1000;
const projection = { from: 1, to: 1, type: 1, content: 1, deleted: 1, createTime: 1 };
type Cursor = { time: number; id: string; revision: string; purpose: string; start?: number; issuedAt?: number };

function rate(key: string, maximum: number) {
    const now = Date.now();
    const times = (rates.get(key) || []).filter(time => time > now - 60000);
    if (times.length >= maximum) throw new BotError(429, '请求过于频繁，请稍后重试');
    if (rates.size >= 10000) {
        rates.forEach((value, stored) => { if (value[value.length - 1] <= now - 60000) rates.delete(stored); });
        if (rates.size >= 10000 && !rates.has(key)) throw new BotError(429, '请求过于频繁，请稍后重试');
    }
    rates.set(key, [...times, now]);
}

function cursor(settings: BotConfigDocument, value: Omit<Cursor, 'revision'>) {
    const body = Buffer.from(JSON.stringify({ ...value, revision: settings.revision })).toString('base64');
    return `${body}.${createHmac('sha256', settings.apiKeyHash).update(body).digest('hex')}`;
}

function parseCursor(settings: BotConfigDocument, value: unknown, purpose: string, recent: boolean): Cursor {
    assert(typeof value === 'string' && value.length <= 1024, '游标格式错误');
    const [body, signature, excess] = value.split('.');
    const expected = createHmac('sha256', settings.apiKeyHash).update(body).digest('hex');
    assert(!excess && /^[a-f0-9]{64}$/.test(signature || '') && timingSafeEqual(Buffer.from(signature), Buffer.from(expected)), '游标无效');
    let decoded: Cursor;
    try { decoded = JSON.parse(Buffer.from(body, 'base64').toString()); } catch { throw new BotError(400, '游标无效'); }
    assert(decoded!.revision === settings.revision && decoded!.purpose === purpose && identifier(decoded!.id) && Number.isSafeInteger(decoded!.time) && decoded!.time <= Date.now() + 1000, '游标已失效，请重新同步');
    if (recent) {
        assert(Number.isSafeInteger(decoded!.start) && Number.isSafeInteger(decoded!.issuedAt), '轮询游标格式错误');
        if (decoded!.issuedAt! < Date.now() - FiveMinutes) throw new BotError(409, '轮询游标已过期，请省略游标重新从当前时间开始');
    }
    return decoded!;
}

export async function conversations(settings: BotConfigDocument) {
    const groups = await Group.find({ _id: { $in: settings.allowedGroupIds }, members: settings.userId }, { name: 1 }).limit(100).lean();
    const result = groups.map(group => ({ id: String(group._id), type: 'group', name: group.name }));
    if (settings.allowPrivate) {
        const outgoing = await Friend.find({ from: settings.userId }, { to: 1 }).limit(1000).lean();
        const peers = outgoing.map(friend => String(friend.to));
        const incoming = await Friend.find({ to: settings.userId, from: { $in: peers } }, { from: 1 }).limit(1000).lean();
        const users = await User.find({ _id: { $in: incoming.map(friend => friend.from) } }, { username: 1 }).limit(1000).lean();
        users.forEach(user => result.push({ id: getFriendId(settings.userId, String(user._id)), type: 'private', name: user.username }));
    }
    return result;
}

async function assertConversation(settings: BotConfigDocument, id: unknown) {
    assert(typeof id === 'string' && /^[a-f0-9]{24}(?:[a-f0-9]{24})?$/.test(id), '会话编号格式错误');
    if (id.length === 24) {
        assert(settings.allowedGroupIds.includes(id), '会话不在机器人授权范围内');
        assert(await Group.exists({ _id: id, members: settings.userId }), '机器人已不在该群组中');
    } else {
        assert(settings.allowPrivate && (id.slice(0, 24) === settings.userId || id.slice(24) === settings.userId), '会话不在机器人授权范围内');
        const peer = id.slice(0, 24) === settings.userId ? id.slice(24) : id.slice(0, 24);
        assert(peer !== settings.userId && getFriendId(settings.userId, peer) === id, '私聊编号格式错误');
        const [outgoing, incoming, user] = await Promise.all([
            Friend.exists({ from: settings.userId, to: peer }), Friend.exists({ from: peer, to: settings.userId }), User.exists({ _id: peer }),
        ]);
        assert(outgoing && incoming && user, '机器人只允许访问当前双向好友私聊');
    }
    return id;
}

function message(value: any) {
    return { id: String(value._id), conversationId: String(value.to),
        user: { id: value.from?._id ? String(value.from._id) : '', name: value.from?.username || '已注销用户' },
        type: value.type, content: value.deleted ? '' : value.content,
        deleted: !!value.deleted, createdAt: new Date(value.createTime).toISOString() };
}

function limit(value: unknown, maximum: number, fallback: number) {
    if (value === undefined) return fallback;
    assert(typeof value === 'string' && /^\d{1,3}$/.test(value), '分页数量格式错误');
    const parsed = Number(value);
    assert(parsed >= 1 && parsed <= maximum, `分页数量必须为 1–${maximum}`);
    return parsed;
}

export async function handleBotRequest(token: string, method: string, path: string, query: any, data: any,
    emit: (target: string | string[], event: string, value: any) => void) {
    const { settings, user } = await authorizeBot(token);
    rate(`key:${settings.apiKeyHash}`, 120);
    if (method === 'GET' && path === '/identity') {
        return { user: { id: settings.userId, name: user.username }, apiVersion: 1,
            capabilities: { receive: { history: true, poll: true, message: true, recall: false }, send: { text: true, image: true, reply: false, recall: false }, member: { list: true, kick: false, mute: false } },
            scope: { allowedGroupIds: [...settings.allowedGroupIds], allowPrivate: settings.allowPrivate },
            limits: { history: 50, events: 100, content: 2048, pollCursorMaxAgeSeconds: 300 } };
    }
    if (method === 'GET' && path === '/conversations') return { conversations: await conversations(settings) };
    if (method === 'GET' && path.startsWith('/messages/')) {
        const id = path.slice('/messages/'.length);
        assert(identifier(id), '消息编号格式错误');
        const found = await Message.findById(id, projection).populate('from', { username: 1 }).lean();
        if (!found) throw new BotError(404, '消息不存在或无权访问');
        await assertConversation(settings, String(found.to));
        return { message: message(found) };
    }
    if (method === 'GET' && path === '/members') {
        const id = await assertConversation(settings, query.conversationId);
        assert(id.length === 24, '成员列表仅支持群组');
        const group = await Group.findById(id, { members: 1 }).lean();
        assert(group, '群组不存在');
        // Return a bounded page, using a member ID cursor rather than offsets.
        const count = limit(query.limit, 100, 100);
        if (query.after !== undefined) assert(identifier(query.after), '成员分页编号格式错误');
        const users = await User.find({ _id: { $in: group!.members, ...(query.after ? { $gt: query.after } : {}) } }, { username: 1, avatar: 1 }).sort({ _id: 1 }).limit(count + 1).lean();
        await assertConversation(settings, id);
        return { members: users.slice(0, count).map(member => ({ id: String(member._id), name: member.username, avatar: member.avatar || '' })),
            next: users.length > count ? String(users[count - 1]._id) : null };
    }
    if (method === 'GET' && path === '/history') {
        const id = await assertConversation(settings, query.conversationId);
        const count = limit(query.limit, 50, 30);
        const filter: any = { to: id };
        if (query.before !== undefined) {
            const before = parseCursor(settings, query.before, `history:${id}`, false);
            filter.$or = [{ createTime: { $lt: new Date(before.time) } }, { createTime: new Date(before.time), _id: { $lt: before.id } }];
        }
        const found = await Message.find(filter, projection, { sort: { createTime: -1, _id: -1 }, limit: count + 1 }).populate('from', { username: 1 }).lean();
        await assertConversation(settings, id);
        const page = found.slice(0, count); const last = page[page.length - 1];
        return { messages: page.reverse().map(message), next: found.length > count && last ? cursor(settings, { time: new Date(last.createTime).getTime(), id: String(last._id), purpose: `history:${id}` }) : null };
    }
    if (method === 'GET' && path === '/events') {
        const now = Date.now();
        if (query.cursor === undefined) return { events: [], cursor: cursor(settings, { time: now, id: '000000000000000000000000', purpose: 'events', start: now, issuedAt: now }), hasMore: false, reset: true };
        const after = parseCursor(settings, query.cursor, 'events', true);
        const count = limit(query.limit, 100, 50);
        const rooms = await conversations(settings);
        const found = await Message.find({ to: { $in: rooms.map(room => room.id) }, createTime: { $lte: new Date(now) },
            $or: [{ createTime: { $gt: new Date(after.time) } }, { createTime: new Date(after.time), _id: { $gt: after.id } }],
        }, projection, { sort: { createTime: 1, _id: 1 }, limit: count + 1 }).populate('from', { username: 1 }).lean();
        const currentRooms = new Set((await conversations(settings)).map(room => room.id));
        const page = found.slice(0, count); const last = page[page.length - 1];
        const hasMore = found.length > count;
        return { events: page.filter(item => currentRooms.has(String(item.to))).map(item => ({ type: 'message.created', message: message(item) })),
            // Rescan a bounded overlap after every completed pass: createTime precedes
            // database commit, so a time-only high-water mark can skip concurrent inserts.
            // Consumers deduplicate by message ID; pagination still moves forward within a pass.
            cursor: cursor(settings, { time: hasMore && last ? new Date(last.createTime).getTime() : Math.max(after.start!, now - FiveMinutes),
                id: hasMore && last ? String(last._id) : '000000000000000000000000', purpose: 'events',
                start: after.start, issuedAt: now }), hasMore, reset: false };
    }
    if (method === 'POST' && path === '/images') {
        assert(data && typeof data.file === 'string', 'file 字段必填且需为 Base64 字符串');
        const buffer = Buffer.from(data.file, 'base64');
        if (buffer.length > MaxImageBytes) throw new BotError(413, '图片大小不能超过 15 MiB');
        assert(buffer.length > 0, '图片内容不能为空');
        let ext = 'png';
        if (data.fileName && typeof data.fileName === 'string') {
            const matched = data.fileName.match(/\.(png|jpe?g|gif|webp)$/i);
            if (matched) ext = matched[1].toLowerCase();
        } else {
            if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) ext = 'jpg';
            else if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ext = 'png';
            else if (['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))) ext = 'gif';
            else if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') ext = 'webp';
        }
        if (ext === 'jpeg') ext = 'jpg';
        const targetFileName = `ImageMessage/${settings.userId}_${Date.now()}.${ext}`;
        const result = await uploadFile({ data: { fileName: targetFileName, file: buffer }, socket: { user: settings.userId } } as any);
        if (typeof result === 'string') throw new BotError(500, result);
        return { url: result.url };
    }
    if (method === 'POST' && path === '/messages') {
        const type = data?.type || 'text';
        assert(type === 'text' || type === 'image', '只支持 text 或 image 消息类型');
        assert(data && typeof data.content === 'string' && data.content.trim().length > 0 && data.content.length <= 2048, '内容必须为 1–2048 个字符');
        assert(typeof data.requestId === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.requestId), 'requestId 必须为 UUID');
        const id = await assertConversation(settings, data.conversationId);
        rate(`send:${settings.userId}`, 30);
        const key = `bot:${settings.apiKeyHash}:${data.requestId.toLowerCase()}`;
        const digest = hash(JSON.stringify(type === 'text' ? [id, data.content] : [id, type, data.content]));
        await BotRequest.init();
        let record;
        try { record = await BotRequest.findOneAndUpdate({ key }, { $setOnInsert: { key, digest } }, { upsert: true, new: true }).lean(); }
        catch (error) {
            if ((error as any).code !== 11000) throw error;
            record = await BotRequest.findOne({ key }).lean();
        }
        if (!record || record.digest !== digest) throw new BotError(409, '同一 requestId 不得发送不同内容或会话');
        if (record.messageId) return { id: record.messageId, conversationId: id };
        const fresh = await authorizeBot(token);
        await assertConversation(fresh.settings, id);
        const sent = await sendMessage({ data: { to: id, type, content: data.content }, socket: { user: settings.userId, isAdmin: false, emit } } as Context<SendMessageData>, { literalText: true, bridgeKey: key });
        await BotRequest.updateOne({ key, digest }, { $set: { messageId: String(sent._id) } });
        return { id: String(sent._id), conversationId: id };
    }
    throw new BotError(404, '机器人接口不存在或不支持该请求方法');
}

function readBody(req: KoaContext['req'], maximum: number, timeout: number, sizeError: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = []; let size = 0;
        const cleanup = () => {
            clearTimeout(deadline);
            req.removeListener('data', onData);
            req.removeListener('end', onEnd);
            req.removeListener('aborted', onAborted);
        };
        const onError = (error: Error) => {
            cleanup();
            // Keep the socket writable long enough to return a JSON error response.
            req.pause();
            reject(error);
        };
        const onData = (chunk: Buffer) => {
            size += chunk.length;
            if (size > maximum) { onError(new BotError(413, sizeError)); return; }
            chunks.push(Buffer.from(chunk));
        };
        const onEnd = () => { cleanup(); resolve(Buffer.concat(chunks)); };
        const onAborted = () => onError(new BotError(400, '请求内容传输中断'));
        const deadline = setTimeout(() => onError(new BotError(408, '读取请求内容超时')), timeout);
        req.on('data', onData);
        req.on('end', onEnd);
        req.on('error', onError);
        req.on('aborted', onAborted);
        // IncomingMessage can emit ECONNRESET after aborted; keep an error listener until close.
        req.once('close', () => req.removeListener('error', onError));
    });
}

export default function botHttp(io: Server) {
    return async (ctx: KoaContext, next: Next) => {
        if (!ctx.path.startsWith('/api/bot/')) { await next(); return; }
        ctx.set('Cache-Control', 'no-store'); ctx.set('X-Content-Type-Options', 'nosniff');
        try {
            rate(`ip:${ctx.req.socket.remoteAddress || ''}`, 240);
            if (!ctx.path.startsWith('/api/bot/v1/')) throw new BotError(404, '机器人接口不存在');
            if (ctx.get('Origin')) throw new BotError(403, '机器人接口仅供服务端客户端使用');
            const authorization = ctx.get('Authorization');
            if (!/^Bearer fiora_bot_[a-f0-9]{64}$/.test(authorization)) throw new BotError(401, '需要有效的 Bearer API Key');
            const token = authorization.slice(7);
            // Authenticate before consuming the body; authorizeBot runs again at dispatch.
            await authorizeBot(token);
            let data: any;
            if (ctx.method === 'POST') {
                if (!ctx.is('application/json')) throw new BotError(415, '请求必须使用 application/json');
                const imageUpload = ctx.path === '/api/bot/v1/images';
                const maximum = imageUpload ? MaxImageRequestBytes : MaxRequestBytes;
                const sizeError = imageUpload ? '图片请求内容超过 20 MiB Base64 及 16 KiB 附加字段上限' : '请求内容超过 16 KiB';
                if (Number(ctx.get('Content-Length')) > maximum) throw new BotError(413, sizeError);
                const body = await readBody(ctx.req, maximum, imageUpload ? ImageRequestTimeout : RequestTimeout, sizeError);
                try { data = JSON.parse(body.toString()); } catch { throw new BotError(400, 'JSON 格式错误'); }
                assert(data && typeof data === 'object' && !Array.isArray(data), 'JSON 必须为对象');
            }
            ctx.body = await handleBotRequest(token, ctx.method, ctx.path.slice('/api/bot/v1'.length), ctx.query, data,
                (target, event, value) => io.to(target).emit(event, value));
        } catch (error) {
            ctx.status = error instanceof BotError ? error.status : error instanceof assert.AssertionError ? 403 : 500;
            if (ctx.status === 413 || ctx.status === 408) ctx.set('Connection', 'close');
            if (ctx.status === 429) ctx.set('Retry-After', '60');
            ctx.body = { error: ctx.status === 500 ? '机器人接口暂不可用' : (error as Error).message };
        }
    };
}
