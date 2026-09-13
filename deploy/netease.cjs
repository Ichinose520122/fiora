const http = require('http');
const fs = require('fs');
const api = require('@neteasecloudmusicapienhanced/api');
const routes = { '/search': 'search', '/song/detail': 'song_detail', '/song/url/v1': 'song_url_v1',
    '/lyric': 'lyric', '/playlist/track/all': 'playlist_track_all' };
http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const method = routes[url.pathname];
    if (!method || req.method !== 'GET') { res.writeHead(404); res.end(); return; }
    const params = Object.fromEntries(url.searchParams);
    let cookie = '';
    try { cookie = fs.readFileSync('/secrets/netease-cookie.txt', 'utf8').trim(); } catch (_) {}
    try {
        let result;
        try {
            result = await api[method]({ ...params, cookie });
        } catch (error) {
            // SDK 4.40.1 needs a separately provisioned key for xeapi. Standard
            // playback can use the same platform's established player endpoint.
            if (method !== 'song_url_v1' || params.level !== 'standard' ||
                !/xeapi public key is missing/.test(error.message || '')) throw error;
            result = await api.song_url({ id: params.id, br: 128000, cookie });
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.body));
    } catch (_) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 502, message: 'Music provider unavailable' }));
    }
}).listen(3000, '0.0.0.0');
