import assert from 'assert';
import { createHmac, randomBytes } from 'crypto';
import config from '@fiora/config/server';
import User from '@fiora/database/mongoose/models/user';
import getLinkmanAccess from '../utils/linkmanAccess';

const recent = new Map<string, number[]>();
const base64url = (buffer: Buffer) => buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

function settings() {
    assert(config.watch.url && config.watch.issuer && config.watch.secret.length >= 32, '影院未配置，请设置 WatchServerUrl、WatchIssuer 和 WatchSharedSecret');
    const origin = (value: string) => {
        const url = new URL(value);
        assert(url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password &&
            (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))),
        '影院和 Fiora 地址必须是 HTTPS 根域名');
        return url.origin;
    };
    return { audience: origin(config.watch.url), issuer: origin(config.watch.issuer) };
}

function source(value: unknown) {
    assert(typeof value === 'string' && value.length <= 2048, '视频地址过长或格式错误');
    if (!value) return '';
    const url = new URL(value);
    assert(['https:', 'http:'].includes(url.protocol) && !url.username && !url.password, '请输入 HTTP / HTTPS 视频地址');
    return url.href;
}

// Called by sendMessage only after membership and send permission checks.
export function _watchInvitation(input: string) {
    settings();
    const argument = input.trim().replace(/^\/watch(?:\s+|$)/i, '').trim();
    if (argument === 'help') return { command: 'watch', value: '/watch 创建影院邀请；/watch 视频地址 创建带视频地址的邀请，进入影院后选择播放模式。' };
    return { command: 'watch', invite: true, source: source(argument), value: '邀请一起看' };
}

export async function watchJoin(ctx: Context<any>) {
    assert(ctx.socket.user, '请先登录');
    assert(ctx.data && typeof ctx.data.roomId === 'string', '缺少聊天房间');
    const roomId = ctx.data.roomId.toLowerCase();
    const access = await getLinkmanAccess(ctx.socket.user, roomId);
    const { audience, issuer } = settings();
    const now = Date.now();
    recent.forEach((times, key) => { if (!times.some(time => time > now - 60000)) recent.delete(key); });
    const times = (recent.get(ctx.socket.user) || []).filter(time => time > now - 60000);
    assert(times.length < 10, '进入影院过于频繁，请稍后再试');
    recent.set(ctx.socket.user, [...times, now]);
    const user = await User.findById(ctx.socket.user).select('username avatar').lean();
    assert(user, '用户不存在');
    const admin = !!ctx.socket.isAdmin;
    const payload = {
        v: 1, iss: issuer, aud: audience,
        iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 60,
        jti: randomBytes(16).toString('hex'), sub: ctx.socket.user,
        name: user!.username.slice(0, 100), avatar: user!.avatar || '', room: roomId,
        admin, canControl: admin || !access.group || access.group.creator.toString() === ctx.socket.user,
    };
    const body = base64url(Buffer.from(JSON.stringify(payload)));
    const signature = base64url(createHmac('sha256', config.watch.secret).update(body).digest());
    const fragment = new URLSearchParams({ ticket: `${body}.${signature}` });
    const input = source(ctx.data.source || '');
    if (input) fragment.set('source', input);
    return { url: `${audience}/#${fragment.toString()}` };
}
