const http = require('http');
const crypto = require('crypto');
const api = require('@neteasecloudmusicapienhanced/api');
const { createMusicAuth } = require('./netease-auth.cjs');
const { musicToken } = require('./music-token.cjs');

const token = musicToken();
const auth = createMusicAuth({
    api,
    token,
    accountFile: process.env.MusicAccountFile || '/music-auth/account.json',
    legacyCookieFile: '/secrets/netease-cookie.txt',
});

const routes = {
    '/search': 'search',
    '/song/detail': 'song_detail',
    '/song/url/v1': 'song_url_v1',
    '/lyric': 'lyric',
    '/playlist/detail': 'playlist_detail',
    '/playlist/track/all': 'playlist_track_all',
};

function authorized(req) {
    const received = req.headers['x-music-auth'];
    return (
        typeof token === 'string' &&
        token.length >= 32 &&
        typeof received === 'string' &&
        Buffer.byteLength(received) === Buffer.byteLength(token) &&
        crypto.timingSafeEqual(Buffer.from(received), Buffer.from(token))
    );
}

function json(res, status, body) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify(body));
}

http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/health') {
        json(res, 200, { ok: true });
        return;
    }

    // /auth/* keeps its existing token validation and account persistence logic.
    if (await auth.handle(req, res, url)) return;

    const method = routes[url.pathname];
    if (!method || req.method !== 'GET') {
        json(res, 404, { code: 404 });
        return;
    }

    // Unlike the old local-only adapter, every normal API route on the remote
    // gateway requires the same X-Music-Auth token.
    if (!authorized(req)) {
        json(res, 403, { code: 403 });
        return;
    }

    const params = Object.fromEntries(url.searchParams);
    let cookie = '';
    try {
        cookie = await auth.readCookie();
    } catch (_) {}

    try {
        let result;
        try {
            result = await api[method]({ ...params, cookie });
        } catch (error) {
            // SDK 4.40.1 needs a separately provisioned key for xeapi. Standard
            // playback can use the same platform's established player endpoint.
            if (
                method !== 'song_url_v1' ||
                params.level !== 'standard' ||
                !/xeapi public key is missing/.test(error.message || '')
            ) {
                throw error;
            }
            result = await api.song_url({
                id: params.id,
                br: 128000,
                cookie,
            });
        }

        json(res, 200, result.body);
    } catch (_) {
        json(res, 502, {
            code: 502,
            message: 'Music provider unavailable',
        });
    }
}).listen(3000, '0.0.0.0');
