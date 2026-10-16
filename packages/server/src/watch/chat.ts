import assert from 'assert';
import { Context as KoaContext, Next } from 'koa';
import { Server } from 'socket.io';
import User from '@fiora/database/mongoose/models/user';
import Message from '@fiora/database/mongoose/models/message';
import Socket from '@fiora/database/mongoose/models/socket';
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
    const access = await getLinkmanAccess(grant.sub, grant.room);
    return { grant, access, isAdmin: !!user!.isAdmin || config.administrator.includes(grant.sub) };
}

function mediaUrl(value: unknown) {
    assert(typeof value === 'string' && value.length <= 4096, '影片链接格式错误');
    if (!value) return '';
    try {
        const url = new URL(value);
        assert(url.protocol === 'https:' && !url.username && !url.password, '影片链接必须为无凭据的 HTTPS 地址');
        return url.href;
    } catch { throw new assert.AssertionError({ message: '影片链接必须为无凭据的 HTTPS 地址' }); }
}

export async function handleWatchChat(token: string, data: any, emit: (target: string | string[], event: string, data: any) => void) {
    const { grant, access, isAdmin } = await authorizeChat(token);
    assert(data && ['read', 'send', 'media'].includes(data.action), '未知聊天操作');
    if (data.action === 'media') {
        assert(isAdmin || !access.group || access.group.creator.toString() === grant.sub, '没有切换影片的权限');
        assert(typeof data.title === 'string' && data.title.trim().length > 0 && data.title.length <= 180, '影片标题需为 1–180 个字符');
        const media = { title: data.title.trim(), cover: mediaUrl(data.cover), source: mediaUrl(data.source) };
        const invitations = await Message.find({ to: grant.room, type: 'system', deleted: { $ne: true },
            $and: [{ content: /"command"\s*:\s*"watch"/ }, { content: /"invite"\s*:\s*true/ }] },
        { content: 1 }, { sort: { createTime: -1, _id: -1 }, limit: 50 }).lean();
        for (const invitation of invitations) {
            let original;
            try { original = JSON.parse(invitation.content); } catch { continue; }
            if (original?.command !== 'watch' || original.invite !== true) continue;
            const content = JSON.stringify({ ...original, ...media });
            const updated = await Message.findOneAndUpdate({ _id: invitation._id, to: grant.room, type: 'system',
                deleted: { $ne: true }, content: invitation.content }, { $set: { content } }, { new: true }).lean();
            if (!updated) return { updated: false };
            const payload = { linkmanId: grant.room, messageId: invitation._id.toString(), ...media };
            if (access.group) emit(grant.room, 'watchMedia', payload);
            else {
                const sockets = await Socket.find({ user: { $in: [grant.room.slice(0, 24), grant.room.slice(24)] } }, { id: 1 }).lean();
                const targets = sockets.map(socket => socket.id);
                if (targets.length) emit(targets, 'watchMedia', payload);
            }
            return { updated: true, messageId: payload.messageId };
        }
        return { updated: false };
    }
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
