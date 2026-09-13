// Run only against the isolated review deployment; uses seeded test accounts.
const assert = require('assert');
const fs = require('fs');
const { io } = require('socket.io-client');
const password = fs.readFileSync('/secrets/review-password.txt', 'utf8').trim();
const base = process.env.REVIEW_URL || 'http://web:9200';
const sockets = [];
const call = (socket, event, data = {}) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(event + ' timeout')), 20000);
    socket.emit(event, data, result => { clearTimeout(timer); resolve(result); });
});
async function login(username) {
    const socket = io(base, { transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
    const user = await call(socket, 'login', { username, password, os: 'test', browser: 'test', environment: 'review-test' });
    assert.equal(typeof user, 'object', String(user));
    return { socket, user };
}
let sequence = 0;
async function action(client, roomId, data) {
    return call(client.socket, 'musicAction', { roomId, requestId: 'test-' + Date.now() + '-' + sequence++, ...data });
}
(async () => {
    const a = await login('reviewer1'), b = await login('reviewer2'), c = await login('reviewer3');
    const group = a.user.groups.find(g => g.name === '音乐审核房间')._id;
    const other = c.user.groups.find(g => g.name === '隔离测试房间')._id;
    const privateRoom = [a.user._id, b.user._id].sort().join('');
    // Clear only the seeded review rooms through normal controller operations.
    for (const roomId of [group, privateRoom]) {
        await action(a, roomId, { action: 'clearIdle' });
        const initial = await call(a.socket, 'musicGetState', { roomId });
        for (const track of initial.queue) await action(a, roomId, { action: 'remove', entryId: track.entryId });
        if (initial.current) await action(a, roomId, { action: 'next', entryId: initial.current.entryId });
    }
    assert.equal(typeof await call(c.socket, 'musicGetState', { roomId: group }), 'string');
    assert.equal(typeof await call(c.socket, 'musicGetState', { roomId: privateRoom }), 'string');
    console.log('PASS unauthorized group/private reads rejected');
    await call(a.socket, 'musicGetState', { roomId: group, listening: true });
    await call(b.socket, 'musicGetState', { roomId: group, listening: true });
    const tracks = await call(a.socket, 'musicSearch', { roomId: group, provider: 'local', keywords: '' });
    assert(tracks.tracks.length >= 3);
    let state = await action(a, group, { action: 'add', provider: 'local', id: tracks.tracks[0].id });
    assert(state.current && state.current.url);
    assert.equal(state.paused, false);
    const first = state.current.entryId;
    state = await action(b, group, { action: 'add', provider: 'local', id: tracks.tracks[1].id });
    assert.equal(state.current.entryId, first);
    assert.equal(state.queue[state.queue.length - 1].id, tracks.tracks[1].id);
    console.log('PASS first request plays immediately; subsequent request queues');
    const duplicate = { roomId: group, requestId: 'duplicate-' + Date.now(), action: 'add', provider: 'local', id: tracks.tracks[2].id };
    const one = await call(a.socket, 'musicAction', duplicate), two = await call(a.socket, 'musicAction', duplicate);
    assert.equal(one.queue.length, two.queue.length);
    const seen = await call(b.socket, 'musicGetState', { roomId: group, listening: true });
    assert.equal(seen.current.entryId, first);
    assert.equal(seen.queue.length, one.queue.length);
    console.log('PASS idempotent requests and second-client snapshot');
    assert.equal(typeof await action(b, group, { action: 'next', entryId: first }), 'string');
    state = await action(a, group, { action: 'pause', entryId: first });
    assert.equal(state.paused, true);
    state = await action(a, group, { action: 'resume', entryId: first });
    assert.equal(state.paused, false);
    console.log('PASS group owner controls and pause/resume');
    state = await action(a, privateRoom, { action: 'add', provider: 'local', id: tracks.tracks[2].id });
    assert.equal(state.current.id, tracks.tracks[2].id);
    const isolated = await call(c.socket, 'musicGetState', { roomId: other });
    assert.equal(isolated.current, null);
    const stillGroup = await call(a.socket, 'musicGetState', { roomId: group, listening: true });
    assert.equal(stillGroup.current.entryId, first);
    console.log('PASS independent group and private queues');
    state = await action(a, group, { action: 'vote', entryId: first });
    assert.notEqual(state.current.entryId, first);
    assert.equal(typeof await action(a, group, { action: 'next', entryId: first }), 'string');
    console.log('PASS skip vote and stale-track protection');
    const response = await fetch(base + tracks.tracks[0].url, { headers: { Range: 'bytes=0-99' } });
    assert.equal(response.status, 206); assert.equal((await response.arrayBuffer()).byteLength, 100);
    const invalid = await fetch(base + '/music-files/library.json');
    assert.equal(invalid.status, 404);
    console.log('PASS audio HTTP ranges and configuration-file protection');
    const search = await call(a.socket, 'musicSearch', { roomId: group, provider: 'netease', keywords: '晴天' });
    if (search.tracks?.length) console.log('PASS NetEase live search: ' + search.tracks.length + ' results');
    else console.log('PROVIDER_LIMITATION ' + String(search));
    // Leave a stable, paused demo for manual review.
    for (const roomId of [group, privateRoom]) {
        const current = await call(a.socket, 'musicGetState', { roomId });
        for (const track of current.queue) await action(a, roomId, { action: 'remove', entryId: track.entryId });
        if (current.current) await action(a, roomId, { action: 'pause', entryId: current.current.entryId });
    }
    sockets.forEach(socket => socket.disconnect());
})().catch(error => { console.error(error.stack); sockets.forEach(socket => socket.disconnect()); process.exit(1); });
