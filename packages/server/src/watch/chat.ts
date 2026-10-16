import assert from 'assert';
import { Context as KoaContext, Next } from 'koa';
import { Server } from 'socket.io';
import User from '@fiora/database/mongoose/models/user';
import Message from '@fiora/database/mongoose/models/message';
import { Redis, getSealUserKey } from '@fiora/database/redis/initRedis';
import config from '@fiora/config/server';
import { sendMessage } from '../routes/message';
import getLinkmanAccess from '../utils/linkmanAccess';
import { verifyWatchChatGrant } from '../utils/watchGrant';

const rates = new Map<string, number[]>();
export async function authorizeChat(token: string) {
    const grant = verifyWatchChatGrant(token);
    const user = await User.findById(grant.sub).select('tokenVersion isAdmin').lean();
    assert(user && (user.tokenVersion || 0) === grant.tokenVersion, '登录已失效，请从 Fiora 重新进入');
    assert(!(await Redis.has(getSealUserKey(grant.sub))), '账号已被封禁');
    await getLinkmanAccess(grant.sub, grant.room);
    return { grant, isAdmin: !!user!.isAdmin || config.administrator.includes(grant.sub) };
}

export async function handleWatchChat(token: string, data: any, emit: (target: string | string[], event: string, data: any) => void) {
    const { grant, isAdmin } = await authorizeChat(token);
    assert(data && ['read', 'send'].includes(data.action), '未知聊天操作');
    if (data.action === 'read') {
        const messages = await Message.find({ to: grant.room, type: 'text' },
            { from: 1, content: 1, deleted: 1, createTime: 1 }, { sort: { createTime: -1, _id: -1 }, limit: 50 })
            .populate('from', { username: 1, avatar: 1 }).lean();
        return { messages: messages.reverse().map((message) => ({
            id: message._id.toString(), content: message.deleted ? '' : message.content,
            deleted: !!message.deleted, createdAt: message.createTime,
            user: { id: (message.from as any)?._id?.toString() || '', name: (message.from as any)?.username || '已注销用户' },
        })) };
    }
    assert(typeof data.content === 'string' && data.content.trim().length > 0 && data.content.length <= 2048, '评论需为 1–2048 个字符');
    assert(typeof data.requestId === 'string' && /^[a-f0-9-]{36}$/.test(data.requestId), '发送编号无效');
    const now = Date.now();
    rates.forEach((times, key) => { if (!times.some(time => time > now - 60000)) rates.delete(key); });
    const recent = (rates.get(grant.sub) || []).filter(time => time > now - 60000);
    assert(recent.length < 30, '发送太快，请稍后再试');
    rates.set(grant.sub, [...recent, now]);
    const message = await sendMessage({ data: { to: grant.room, type: 'text', content: data.content.trim() },
        socket: { user: grant.sub, isAdmin, emit } } as Context<SendMessageData>,
    { literalText: true, bridgeKey: `watch:${grant.sub}:${grant.room}:${data.requestId}` });
    return { id: message._id.toString() };
}

export default function watchChat(io: Server) {
    return async (ctx: KoaContext, next: Next) => {
        if (ctx.path !== '/api/watch/chat') { await next(); return; }
        ctx.set('Cache-Control', 'no-store');
        if (ctx.method !== 'POST') { ctx.status = 405; return; }
        const token = ctx.get('Authorization').replace(/^Bearer /, '');
        try { verifyWatchChatGrant(token); } catch { ctx.status = 401; ctx.body = { error: '影院授权无效或已过期' }; return; }
        try {
            assert(ctx.is('application/json'), '请求格式错误');
            const chunks: Buffer[] = []; let size = 0;
            ctx.req.setTimeout(10000);
            for await (const chunk of ctx.req) {
                size += chunk.length; assert(size <= 16384, '请求过大'); chunks.push(Buffer.from(chunk));
            }
            const data = JSON.parse(Buffer.concat(chunks).toString());
            ctx.body = await handleWatchChat(token, data, (target, event, value) => io.to(target).emit(event, value));
        } catch (error) {
            ctx.status = error instanceof assert.AssertionError ? 403 : 500;
            ctx.body = { error: error instanceof assert.AssertionError ? error.message : '聊天暂不可用，请稍后重试' };
        }
    };
}
