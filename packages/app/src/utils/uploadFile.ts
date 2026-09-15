import { serverUrl } from '../config';
import fetch from './fetch';
import { decodeBase64, encodeBase64 } from './base64';
import waitForSession from './waitForSession';
import store from '../state/store';

/**
 * 上传文件
 * @param blob 文件blob数据
 * @param fileName 文件名
 */
export default async function uploadFile(
    blob: Blob | string | ArrayBuffer,
    fileName: string,
    isBase64 = false,
    onProgress?: (percent: number) => void,
): Promise<string> {
    const userId = store.getState().user?._id || '';
    await waitForSession(userId);
    const bytes = isBase64 && typeof blob === 'string' ? decodeBase64(blob) : blob instanceof ArrayBuffer ? new Uint8Array(blob) : new Uint8Array(await (blob as Blob).arrayBuffer());
    if (bytes.length > 30 * 1024 * 1024) throw new Error('上传文件不能超过 30 MB');
    async function request(event: string, data: object): Promise<any> {
        for (let attempt = 0; attempt < 3; attempt += 1) {
            await waitForSession(userId);
            const [error, result] = await fetch(event, data, { toast: false, timeout: 60000 });
            if (!error && result) return result;
            if (error?.includes('not exists')) throw new Error('服务器需要更新到支持分片上传的版本，请先更新 Fiora Docker 镜像');
            if (attempt === 2 || !/断开|超时|连接/.test(error || '')) throw new Error(error || '服务器未返回上传确认');
        }
    }
    const requestId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2);
    const start = await request('uploadStart', { fileName, size: bytes.length, requestId });
    if (!Number.isInteger(start.chunkSize) || start.chunkSize < 1 || start.chunkSize > 48 * 1024) throw new Error('服务器上传参数无效');
    let offset = start.offset;
    while (offset < bytes.length) {
        const end = Math.min(offset + start.chunkSize, bytes.length);
        const result = await request('uploadChunk', { uploadId: start.uploadId, offset, data: encodeBase64(bytes.subarray(offset, end)) });
        if (result.offset !== end) throw new Error('上传进度不一致，请重新发送');
        offset = end; onProgress?.(Math.round(offset / bytes.length * 100));
    }
    const result = await request('uploadFinish', { uploadId: start.uploadId });
    if (typeof result.url !== 'string') throw new Error('服务器未返回文件地址');
    return result.url;
}

export function getOSSFileUrl(url: string | number = '', process = '') {
    if (typeof url === 'number') {
        return url;
    }
    const [rawUrl = '', extraPrams = ''] = url.split('?');
    if (/^\/\/cdn\.suisuijiang\.com/.test(rawUrl)) {
        return `https:${rawUrl}?x-oss-process=${process}${
            extraPrams ? `&${extraPrams}` : ''
        }`;
    }
    if (url.startsWith('//')) {
        return `https:${url}`;
    }
    if (url.startsWith('/')) {
        return `${serverUrl}${url}`;
    }
    return `${url}`;
}
