import assert from 'assert';
import axios from 'axios';

function apiToken() {
    const value = (process.env.NeteaseMusicApiToken || '').trim();
    return value.length >= 32 ? value : '';
}

async function requestOne(
    base: string,
    endpoint: string,
    params: Record<string, any>,
    token = '',
) {
    const result = await axios.get(
        base.replace(/\/$/, '') + endpoint,
        {
            params,
            headers: token
                ? { 'X-Music-Auth': token }
                : undefined,
            timeout: 15000,
            maxContentLength: 8 * 1024 * 1024,
            maxRedirects: 0,
        },
    );

    assert(
        result.data && result.data.code !== 401,
        '音乐平台登录已失效',
    );

    return result.data;
}

export async function requestNetease(
    endpoint: string,
    params: Record<string, any> = {},
) {
    const primary = (process.env.NeteaseMusicApi || '').trim();
    const fallback = (
        process.env.NeteaseMusicApiFallback || ''
    ).trim();

    assert(
        primary || fallback,
        '该音乐源尚未配置，请先使用本地曲库',
    );

    const attempts: Array<{
        base: string;
        token: string;
    }> = [];

    if (primary) {
        attempts.push({
            base: primary,
            token: apiToken(),
        });
    }

    if (
        fallback &&
        fallback.replace(/\/$/, '') !==
            primary.replace(/\/$/, '')
    ) {
        // The Hong Kong local adapter remains private on the Docker network, so
        // it does not need to share the Aliyun gateway token.
        attempts.push({ base: fallback, token: '' });
    }

    let lastError: unknown;
    for (const attempt of attempts) {
        try {
            return await requestOne(
                attempt.base,
                endpoint,
                params,
                attempt.token,
            );
        } catch (error) {
            lastError = error;
        }
    }

    if (lastError instanceof assert.AssertionError) {
        throw lastError;
    }

    throw new assert.AssertionError({
        message:
            '音乐接口暂时不可用，请稍后重试或使用本地曲库',
    });
}

export function upgradeNeteaseMediaUrl(value: any) {
    if (typeof value !== 'string') return value;

    try {
        const url = new URL(value);
        if (
            url.protocol === 'http:' &&
            (url.hostname === 'music.126.net' ||
                url.hostname.endsWith('.music.126.net'))
        ) {
            url.protocol = 'https:';
            return url.toString();
        }
    } catch (_) {}

    return value;
}
