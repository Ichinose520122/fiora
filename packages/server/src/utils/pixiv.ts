import assert from 'assert';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { pixivDirectImage } from '@fiora/utils/pixiv';
import { getPixivSession, pixivHeaders } from './pixivAccount';

const imageRoot = path.resolve(__dirname, '../../public/ImageMessage');
const activeUsers = new Set<string>();
const maxImageBytes = 20 * 1024 * 1024;
const maxWorkBytes = 100 * 1024 * 1024;
const usage = '用法：/pixiv 作品ID、作品页链接或 https://i.pximg.net/ 图片直链';

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

// Read dimensions locally: direct CDN links do not need the artwork metadata API.
function imageDimensions(data: Buffer, ext: string) {
    if (ext === 'png' && data.length >= 24) {
        return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
    }
    if (ext === 'gif' && data.length >= 10) {
        return { width: data.readUInt16LE(6), height: data.readUInt16LE(8) };
    }
    if (ext === 'webp' && data.length >= 30) {
        const chunk = data.toString('ascii', 12, 16);
        if (chunk === 'VP8X') return { width: data.readUIntLE(24, 3) + 1, height: data.readUIntLE(27, 3) + 1 };
        if (chunk === 'VP8 ') return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
        if (chunk === 'VP8L' && data[20] === 0x2f) {
            const bits = data.readUInt32LE(21);
            return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
        }
    }
    if (ext === 'jpg') {
        let offset = 2;
        while (offset + 4 <= data.length && data[offset] === 0xff) {
            while (offset < data.length && data[offset] === 0xff) offset += 1;
            const marker = data[offset++];
            if (marker === 0xda || marker === 0xd9) break;
            if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
            if (offset + 2 > data.length) break;
            const length = data.readUInt16BE(offset);
            if (length < 2 || offset + length > data.length) break;
            if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7) {
                return { width: data.readUInt16BE(offset + 5), height: data.readUInt16BE(offset + 3) };
            }
            offset += length;
        }
    }
    assert.fail('无法识别 Pixiv 图片尺寸');
}

// Download first, then publish the complete work. No third-party image proxy.
export async function preparePixivImages(input: string, userId: string): Promise<string[]> {
    const value = input.replace(/^\/\s*pixiv(?:\s|$)/i, '').trim();
    const direct = pixivDirectImage(value);
    const id = direct ? 'direct' : pixivId(input);
    assert(!activeUsers.has(userId), '上一组 Pixiv 图片仍在处理中，请稍候');
    assert(activeUsers.size < 4, 'Pixiv 图片服务繁忙，请稍后再试');
    activeUsers.add(userId);
    const cancel = axios.CancelToken.source();
    const timer = setTimeout(() => cancel.cancel(), 120000);
    const written: string[] = [];
    const options = {
        headers: pixivHeaders,
        timeout: 20000,
        maxRedirects: 0,
        cancelToken: cancel.token,
    };
    try {
        let sources: { url: string; width: number; height: number }[];
        if (direct) {
            sources = [{ url: direct, width: 0, height: 0 }];
        } else {
            const session = await getPixivSession();
            const response = await axios.get('https://www.pixiv.net/ajax/illust/' + id + '/pages', {
                ...options,
                // Credentials go only to Pixiv, never to CDN downloads or redirects.
                headers: session ? { ...pixivHeaders, Cookie: 'PHPSESSID=' + session } : pixivHeaders,
                maxContentLength: 2 * 1024 * 1024,
            });
            const pages = response.data?.body;
            assert(!response.data?.error && Array.isArray(pages) && pages.length,
                session ? '作品不可访问，请确认账号有查看权限，并在管理员面板验证 Pixiv 登录状态'
                    : '作品不存在或需要登录，请管理员连接 Pixiv 账号；已有图片直链也可直接发送');
            assert(pages.length <= 200, '作品超过 200 张，暂时无法整组发送');
            sources = pages.map((page: any) => ({
                url: pixivImageUrl(page?.urls?.original).toString(),
                width: Number.isInteger(page?.width) && page.width > 0 ? page.width : 0,
                height: Number.isInteger(page?.height) && page.height > 0 ? page.height : 0,
            }));
        }
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
                    const size = source.width && source.height ? source : imageDimensions(data, ext);
                    assert(size.width > 0 && size.height > 0, 'Pixiv 图片尺寸无效');
                    const filename = 'pixiv-' + id + '-p' + index + '-' + randomBytes(12).toString('hex') + '.' + ext;
                    const file = path.join(imageRoot, filename);
                    written.push(file);
                    await fs.promises.writeFile(file, data, { flag: 'wx' });
                    images[index] = '/ImageMessage/' + filename + '?width=' + size.width + '&height=' + size.height;
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
            message: 'Pixiv 图片获取失败，请检查链接是否有效、服务器是否能连接 Pixiv，以及账号访问权限',
        });
    } finally {
        clearTimeout(timer);
        activeUsers.delete(userId);
    }
}
