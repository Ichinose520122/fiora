import config from '@fiora/config/client';
import platform from 'platform';

/** Raw HTTP body keeps image bytes off Socket.IO and allows gateway HTTP/3 negotiation. */
export default async function uploadImageHttp(blob: Blob, fileName: string): Promise<string> {
    const token = window.localStorage.getItem('token');
    if (!token) throw new Error('请登录后再上传');
    const base = new URL(config.server || '/', window.location.href);
    const url = new URL('/api/upload/image', base);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 95000);
    try {
        const response = await window.fetch(url.toString(), {
            method: 'POST', body: blob, signal: controller.signal,
            credentials: 'omit', cache: 'no-store', redirect: 'error',
            headers: {
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/octet-stream',
                'X-File-Name': encodeURIComponent(fileName),
                'X-Client-Environment': encodeURIComponent(platform.description || ''),
            },
        });
        if (token !== window.localStorage.getItem('token')) throw new Error('账号已切换，请重新上传');
        const result = await response.json().catch(() => null);
        if (!response.ok || !result || typeof result.url !== 'string') throw new Error(result?.error || '图片上传失败，请稍后重试');
        return result.url;
    } catch (error) {
        if (controller.signal.aborted) throw new Error('图片上传超时，请重试');
        throw error;
    } finally { window.clearTimeout(timer); }
}
