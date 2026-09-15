import { serverUrl } from '../config';
import fetch from './fetch';
import { decodeBase64 } from './base64';
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
): Promise<string> {
    const userId = store.getState().user?._id || '';
    await waitForSession(userId);
    // Socket.IO binary attachments work with both local storage and OSS.
    const file = isBase64 && typeof blob === 'string' ? decodeBase64(blob).buffer : blob;
    if (file instanceof ArrayBuffer && file.byteLength > 30 * 1024 * 1024) throw new Error('上传文件不能超过 30 MB');
    const [uploadErr, result] = await fetch('uploadFile', {
        file,
        fileName,
        isBase64: false,
    }, { timeout: 120000 });
    if (uploadErr) {
        throw Error(`上传失败：${uploadErr}`);
    }
    if (!result || typeof result.url !== 'string') throw new Error('服务器未返回文件地址');
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
