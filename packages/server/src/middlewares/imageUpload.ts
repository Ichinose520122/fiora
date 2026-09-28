import { Context as KoaContext, Next } from 'koa';
import { IncomingMessage } from 'http';
import { Socket } from 'socket.io';
import jwt from 'jwt-simple';
import config from '@fiora/config/server';
import clientConfig from '@fiora/config/client';
import User from '@fiora/database/mongoose/models/user';
import { Redis, getSealIpKey, getSealUserKey } from '@fiora/database/redis/initRedis';
import { getSocketIp } from '@fiora/utils/socket';
import { SEAL_TEXT } from '@fiora/utils/const';
import { uploadFile } from '../routes/system';

const active = new Map<string, number>();
let reservedBytes = 0;
const memoryBudget = 64 * 1024 * 1024;
class UploadError extends Error {
    constructor(public status: number, message: string) { super(message); }
}

function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        let chunks: Buffer[] = [];
        let size = 0;
        let settled = false;
        const finish = (error?: Error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            req.removeListener('data', data);
            req.removeListener('end', end);
            req.removeListener('aborted', aborted);
            req.removeListener('error', fail);
            if (error) { chunks = []; req.resume(); reject(error); }
            else resolve(Buffer.concat(chunks, size));
        };
        const data = (chunk: Buffer) => {
            size += chunk.length;
            if (size > limit) finish(new UploadError(413, '图片超过上传大小限制'));
            else chunks.push(chunk);
        };
        const end = () => finish();
        const aborted = () => finish(new UploadError(400, '上传已中断'));
        const fail = () => finish(new UploadError(400, '读取图片失败'));
        const timer = setTimeout(() => finish(new UploadError(408, '上传超时，请重试')), 90000);
        req.on('data', data).once('end', end).once('aborted', aborted).once('error', fail);
        if (req.destroyed || req.readableEnded) aborted();
    });
}

function isImage(file: Buffer, ext: string) {
    if (/^jpe?g$/.test(ext)) return file.length >= 3 && file[0] === 255 && file[1] === 216 && file[2] === 255;
    if (ext === 'png') return file.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (ext === 'gif') return ['GIF87a', 'GIF89a'].includes(file.toString('ascii', 0, 6));
    return ext === 'webp' && file.toString('ascii', 0, 4) === 'RIFF' && file.toString('ascii', 8, 12) === 'WEBP';
}

/** Browser -> HTTPS gateway may use HTTP/3; the internal Node hop stays HTTP. */
export default async function imageUpload(ctx: KoaContext, next: Next) {
    if (ctx.path !== '/api/upload/image') { await next(); return; }
    ctx.set('Cache-Control', 'no-store');
    ctx.vary('Origin');
    let userId = '';
    let reserved = 0;
    try {
        const origin = ctx.get('Origin');
        if (origin && config.allowOrigin && !config.allowOrigin.includes(origin)) throw new UploadError(403, '不允许的请求来源');
        if (origin) ctx.set('Access-Control-Allow-Origin', origin);
        ctx.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        ctx.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-File-Name, X-Client-Environment');
        if (ctx.method === 'OPTIONS') { ctx.status = 204; return; }
        if (ctx.method !== 'POST') { ctx.set('Allow', 'POST, OPTIONS'); throw new UploadError(405, '仅支持 POST 上传'); }
        let payload: any;
        try { payload = jwt.decode(ctx.get('Authorization').replace(/^Bearer /i, ''), config.jwtSecret, false, 'HS256'); }
        catch (_) { throw new UploadError(401, '请重新登录后上传'); }
        if (!payload || typeof payload.user !== 'string' || !/^[a-f0-9]{24}$/i.test(payload.user) || !Number.isFinite(payload.expires) || payload.expires <= Date.now()) throw new UploadError(401, '登录已过期');
        let environment: string;
        let fileName: string;
        try { environment = decodeURIComponent(ctx.get('X-Client-Environment')); fileName = decodeURIComponent(ctx.get('X-File-Name')); }
        catch (_) { throw new UploadError(400, '上传参数无效'); }
        if (environment !== (payload.environment || '')) throw new UploadError(401, '登录环境不匹配，请重新登录');
        const match = /^(Avatar|BackgroundImage|GroupAvatar|ImageMessage)\/([a-f0-9]{24})_[0-9]+\.(png|jpe?g|gif|webp)$/i.exec(fileName);
        if (!match || match[2].toLowerCase() !== payload.user.toLowerCase()) throw new UploadError(400, '图片文件名无效');
        const user = await User.findById(payload.user, { tokenVersion: 1 });
        if (!user || (payload.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) throw new UploadError(401, '登录已过期');
        const ip = getSocketIp({ handshake: { address: ctx.req.socket.remoteAddress, headers: ctx.req.headers } } as Socket, config.trustProxyHeaders);
        if (await Redis.has(getSealUserKey(payload.user)) || await Redis.has(getSealIpKey(ip))) throw new UploadError(403, SEAL_TEXT);
        const configured = match[1] === 'BackgroundImage' ? clientConfig.maxBackgroundImageSize : match[1] === 'Avatar' || match[1] === 'GroupAvatar' ? clientConfig.maxAvatarSize : clientConfig.maxImageSize;
        const limit = Math.min(Number.isFinite(configured) && configured > 0 ? configured : 15 * 1024 * 1024, 32 * 1024 * 1024);
        const length = Number(ctx.get('Content-Length'));
        if (length > limit) throw new UploadError(413, '图片超过上传大小限制');
        userId = payload.user;
        if ((active.get(userId) || 0) >= 2 || reservedBytes + limit > memoryBudget) throw new UploadError(429, '上传繁忙，请稍后重试');
        active.set(userId, (active.get(userId) || 0) + 1);
        reserved = limit; reservedBytes += limit;
        const file = await readBody(ctx.req, limit);
        if (!isImage(file, match[3].toLowerCase())) throw new UploadError(400, '图片格式与扩展名不匹配');
        const result = await uploadFile({ data: { fileName, file }, socket: { user: userId } } as Context<{ fileName: string; file: Buffer }>);
        if (typeof result === 'string') throw new UploadError(500, '保存图片失败，请重试');
        ctx.body = result;
    } catch (error) {
        ctx.status = error instanceof UploadError ? error.status : 503;
        ctx.body = { error: error instanceof UploadError ? error.message : '上传服务暂时不可用' };
        ctx.req.resume();
    } finally {
        if (reserved) {
            reservedBytes -= reserved;
            const count = (active.get(userId) || 1) - 1;
            if (count) active.set(userId, count); else active.delete(userId);
        }
    }
}
