import assert from 'assert';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

const imageRoot = path.resolve(__dirname, '../../public/ImageMessage');
const activeUsers = new Set<string>();
const maxImageBytes = 20 * 1024 * 1024;
const maxWorkBytes = 100 * 1024 * 1024;
const usage = '用法：/pixiv 作品ID 或 /pixiv https://www.pixiv.net/artworks/作品ID';

export function pixivId(input: string) {
    const value = input.replace(/^\/\s*pixiv(?:\s|$)/i, '').trim();
    if (/^[1-9]\d{0,11}$/.test(value)) return value;
    try {
        const url = new URL(value);
        assert(['https:', 'http:'].includes(url.protocol));
        assert(['www.pixiv.net', 'pixiv.net', 'touch.pixiv.net'].includes(url.hostname));
        assert(!url.username && !url.password && !url.port);
        const match = /^\/(?:[a-z]{2}\/)?artworks\/([1-9]\d{0,11})\/?$/.exec(url.pathname);
        const id = match?.[1] || (
            ['/member_illust.php', '/i.php'].includes(url.pathname)
                ? url.searchParams.get('illust_id')
                : ''
        );
        assert(id && /^[1-9]\d{0,11}$/.test(id));
        return id!;
    } catch (_) {
        throw new assert.AssertionError({ message: usage });
    }
}

export function pixivImageUrl(value: unknown) {
    assert(typeof value === 'string', 'Pixiv 图片地址无效');
    const url = new URL(value as string);
    assert(url.protocol === 'https:' && url.hostname === 'i.pximg.net' &&
        !url.port && !url.username && !url.password, 'Pixiv 图片地址无效');
    assert(/\.(jpg|jpeg|png|gif|webp)$/i.test(url.pathname), '暂不支持此 Pixiv 图片格式');
    return url;
}

function imageExtension(data: Buffer) {
    if (data.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return 'jpg';
    if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
    if (/^GIF8[79]a$/.test(data.subarray(0, 6).toString())) return 'gif';
    if (data.subarray(0, 4).toString() === 'RIFF' && data.subarray(8, 12).toString() === 'WEBP') return 'webp';
    assert.fail('Pixiv 返回的不是可显示的图片');
}

// Download first, then publish the complete work. No third-party image proxy.
export async function preparePixivImages(input: string, userId: string): Promise<string[]> {
    const id = pixivId(input);
    assert(!activeUsers.has(userId), '上一组 Pixiv 图片仍在处理中，请稍候');
    assert(activeUsers.size < 4, 'Pixiv 图片服务繁忙，请稍后再试');
    activeUsers.add(userId);
    const cancel = axios.CancelToken.source();
    const timer = setTimeout(() => cancel.cancel(), 120000);
    const written: string[] = [];
    const options = {
        headers: { Referer: 'https://www.pixiv.net/', 'User-Agent': 'Mozilla/5.0' },
        timeout: 20000,
        maxRedirects: 0,
        cancelToken: cancel.token,
    };
    try {
        const response = await axios.get('https://www.pixiv.net/ajax/illust/' + id + '/pages', {
            ...options, maxContentLength: 2 * 1024 * 1024,
        });
        const pages = response.data?.body;
        assert(!response.data?.error && Array.isArray(pages) && pages.length,
            '作品不存在、不可公开访问，或 Pixiv 暂时无法访问');
        assert(pages.length <= 200, '作品超过 200 张，暂时无法整组发送');
        const sources = pages.map((page: any) => ({
            url: pixivImageUrl(page?.urls?.original).toString(),
            width: Number.isInteger(page?.width) && page.width > 0 ? page.width : 200,
            height: Number.isInteger(page?.height) && page.height > 0 ? page.height : 200,
        }));
        await fs.promises.mkdir(imageRoot, { recursive: true });
        const images: string[] = new Array(sources.length);
        let next = 0;
        let bytes = 0;
        // A few workers keep large multi-page works from opening hundreds of requests.
        const workers = Array.from({ length: Math.min(3, sources.length) }, async () => {
            try {
                while (next < sources.length) {
                    const index = next++;
                    const source = sources[index];
                    const result = await axios.get(source.url, {
                        ...options, responseType: 'arraybuffer', maxContentLength: maxImageBytes,
                    });
                    const data = Buffer.from(result.data);
                    bytes += data.length;
                    assert(bytes <= maxWorkBytes, '作品图片总大小超过 100 MB，暂时无法整组发送');
                    const ext = imageExtension(data);
                    const filename = 'pixiv-' + id + '-p' + index + '-' + randomBytes(12).toString('hex') + '.' + ext;
                    const file = path.join(imageRoot, filename);
                    written.push(file);
                    await fs.promises.writeFile(file, data, { flag: 'wx' });
                    images[index] = '/ImageMessage/' + filename + '?width=' + source.width + '&height=' + source.height;
                }
            } catch (error) {
                cancel.cancel();
                throw error;
            }
        });
        // Wait for all workers before cleanup, including writes already in progress.
        const failures = await Promise.all(workers.map((worker) => worker.then(() => null, (error) => error)));
        const failure = failures.find((error) => error instanceof assert.AssertionError) || failures.find(Boolean);
        if (failure) throw failure;
        return images;
    } catch (error) {
        await Promise.all(written.map((file) => fs.promises.unlink(file).catch(() => undefined)));
        if (error instanceof assert.AssertionError) throw error;
        throw new assert.AssertionError({
            message: 'Pixiv 图片获取失败，请确认作品公开可访问及服务器能连接 Pixiv，稍后重试',
        });
    } finally {
        clearTimeout(timer);
        activeUsers.delete(userId);
    }
}
