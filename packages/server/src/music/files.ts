import fs from 'fs';
import path from 'path';
import { musicDirectory } from './providers';

// Read-only administrator-managed audio. Support seeking without loading whole files.
export default async function musicFiles(ctx: any, next: () => Promise<any>) {
    if (!ctx.path.startsWith('/music-files/')) return next();
    if (!['GET', 'HEAD'].includes(ctx.method)) { ctx.status = 405; return; }
    let filename;
    try { filename = decodeURIComponent(ctx.path.slice('/music-files/'.length)); }
    catch (_) { ctx.status = 400; return; }
    if (filename !== path.basename(filename) || !/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(filename)) {
        ctx.status = 404; return;
    }
    try {
        const root = await fs.promises.realpath(musicDirectory);
        const file = await fs.promises.realpath(path.join(root, filename));
        if (path.dirname(file) !== root) { ctx.status = 404; return; }
        const stat = await fs.promises.stat(file);
        if (!stat.isFile()) { ctx.status = 404; return; }
        ctx.set('Accept-Ranges', 'bytes');
        ctx.set('X-Content-Type-Options', 'nosniff');
        ctx.set('Cache-Control', 'private, max-age=3600');
        ctx.type = path.extname(file);
        let start = 0;
        let end = stat.size - 1;
        const range = ctx.get('range');
        if (range) {
            const match = /^bytes=(\d*)-(\d*)$/.exec(range);
            if (!match || (!match[1] && !match[2])) {
                ctx.status = 416; ctx.set('Content-Range', 'bytes */' + stat.size); return;
            }
            start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2]));
            end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end;
            if (start > end || start >= stat.size) {
                ctx.status = 416; ctx.set('Content-Range', 'bytes */' + stat.size); return;
            }
            ctx.status = 206;
            ctx.set('Content-Range', 'bytes ' + start + '-' + end + '/' + stat.size);
        } else ctx.status = 200;
        ctx.length = end - start + 1;
        if (ctx.method !== 'HEAD') ctx.body = fs.createReadStream(file, { start, end });
    } catch (_) { ctx.status = 404; }
}

