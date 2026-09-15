import assert from 'assert';
import { uploadFile } from './system';

// Bounded, authenticated transfers. Small text frames also avoid native WebSocket
// binary/base64 expansion and proxy frame limits. State survives socket reconnects.
const chunkSize = 48 * 1024;
const maxSize = 30 * 1024 * 1024;
const budget = 96 * 1024 * 1024;
type Transfer = { user: string; name: string; size: number; offset: number; bytes: Buffer; touched: number; result?: { url: string }; finishing?: Promise<any> };
const transfers = new Map<string, Transfer>();
function expire() {
    transfers.forEach((item, id) => {
        if (!item.finishing && Date.now() - item.touched > 5 * 60 * 1000) transfers.delete(id);
    });
}
const timer = setInterval(expire, 60000);
timer.unref();
function get(ctx: Context<{ uploadId: string }>) {
    expire();
    const item = transfers.get(ctx.data.uploadId);
    assert(item && item.user === String(ctx.socket.user), '上传已过期，请重新选择文件');
    item.touched = Date.now();
    return item;
}
export async function uploadStart(ctx: Context<{ fileName: string; size: number; requestId: string }>) {
    expire();
    const { fileName, size, requestId } = ctx.data;
    const user = String(ctx.socket.user);
    assert(/^[a-zA-Z0-9-]{16,100}$/.test(requestId), '上传标识无效');
    assert(Number.isSafeInteger(size) && size >= 0 && size <= maxSize, '文件不能超过 30 MB');
    assert(typeof fileName === 'string' && /^(Avatar|BackgroundImage|FileMessage|GroupAvatar|ImageMessage)\/[a-f0-9]{24}_[0-9]+(?:\.[a-z0-9]{1,16})?$/i.test(fileName), '文件名格式错误');
    assert(fileName.split('/')[1].slice(0, 24) === user, '不能上传其他用户的文件');
    const id = `${user}:${requestId}`;
    const existing = transfers.get(id);
    if (existing) {
        assert(existing.name === fileName && existing.size === size, '上传信息不一致');
        existing.touched = Date.now();
        return { uploadId: id, offset: existing.offset, chunkSize };
    }
    const items = [...transfers.values()];
    assert(items.filter((item) => item.user === user).length < 8 && transfers.size < 128, '上传任务过多，请稍后重试');
    assert(items.reduce((sum, item) => sum + item.bytes.length, 0) + size <= budget, '服务器上传繁忙，请稍后重试');
    transfers.set(id, { user, name: fileName, size, offset: 0, bytes: Buffer.alloc(size), touched: Date.now() });
    return { uploadId: id, offset: 0, chunkSize };
}
export async function uploadChunk(ctx: Context<{ uploadId: string; offset: number; data: string }>) {
    const item = get(ctx);
    const { offset, data } = ctx.data;
    assert(Number.isSafeInteger(offset) && offset >= 0, '分片位置错误');
    assert(typeof data === 'string' && data.length <= chunkSize * 4 / 3 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data), '分片格式错误');
    const bytes = Buffer.from(data, 'base64');
    assert(bytes.length > 0 && offset + bytes.length <= item.size, '分片大小错误');
    if (offset < item.offset) {
        assert(offset + bytes.length <= item.offset, '分片位置错误');
        return { offset: item.offset }; // Acknowledgement lost: do not append twice.
    }
    assert(offset === item.offset && !item.result && !item.finishing, '分片顺序错误');
    bytes.copy(item.bytes, offset);
    item.offset += bytes.length;
    return { offset: item.offset };
}
export async function uploadFinish(ctx: Context<{ uploadId: string }>) {
    const item = get(ctx);
    if (item.result) return item.result;
    assert(item.offset === item.size, '文件尚未上传完整');
    if (!item.finishing) item.finishing = (async () => {
        const result = await uploadFile({ ...ctx, data: { fileName: item.name, file: item.bytes } });
        if (typeof result !== 'string') { item.result = result; item.bytes = Buffer.alloc(0); }
        return result;
    })();
    try { return await item.finishing; } finally { item.finishing = undefined; item.touched = Date.now(); }
}
