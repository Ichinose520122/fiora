// Runs inside the review web container using the actual configured adapter.
require('ts-node/register/transpile-only');
const { searchMusic, resolveTrack } = require('../packages/server/src/music/providers');
(async () => {
    const tracks = await searchMusic('netease', '纯音乐');
    for (const track of tracks.slice(0, 3)) {
        try {
            const resolved = await resolveTrack(track);
            const response = await fetch(resolved.url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
            console.log(JSON.stringify({ title: resolved.title, duration: resolved.duration, lyrics: !!resolved.lyrics, mediaStatus: response.status }));
            if (response.ok) return;
        } catch (error) { console.log('PROVIDER_LIMITATION ' + error.message); }
    }
    process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
