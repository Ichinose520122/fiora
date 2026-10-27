import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { once } from 'node:events';

const require = createRequire(process.env.FIORA_GATEWAY_TEST_DEPS
    ? path.join(process.env.FIORA_GATEWAY_TEST_DEPS, 'package.json') : import.meta.url);
const Koa = require('koa');
const token = `fiora_bot_${'a'.repeat(64)}`;
const userId = 'b'.repeat(24);
const groupId = 'c'.repeat(24);
const imageLimit = 15 * 1024 * 1024;
const envelopeLimit = 4 * Math.ceil(imageLimit / 3) + 16 * 1024;
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

async function endpoint(t) {
    const state = { authorized: true, uploads: [], sends: 0, timers: new Set() };
    class BotError extends Error {
        constructor(status, message) { super(message); this.status = status; }
    }
    const modules = {
        assert: { default: assert }, crypto: { createHmac: crypto.createHmac, timingSafeEqual: crypto.timingSafeEqual },
        koa: { Context: {}, Next: {} }, 'socket.io': { Server: {} },
        '@fiora/database/mongoose/models/group': { default: { exists: async () => true } },
        '@fiora/database/mongoose/models/friend': { default: {} },
        '@fiora/database/mongoose/models/user': { default: {} },
        '@fiora/database/mongoose/models/message': { default: {} },
        '@fiora/database/mongoose/models/botConfig': { BotConfigDocument: {}, BotRequest: {
            init: async () => {},
            findOneAndUpdate: (query, update) => ({ lean: async () => update.$setOnInsert }),
            updateOne: async () => {},
        } },
        '@fiora/utils/getFriendId': { default: () => '' },
        '../routes/message': { sendMessage: async () => { state.sends++; return { _id: 'd'.repeat(24) }; } },
        '../routes/system': { uploadFile: async ({ data }) => {
            state.uploads.push({ bytes: data.file.length, fileName: data.fileName });
            return { url: '/ImageMessage/test.png' };
        } },
        './config': { BotError, hash, identifier: (value) => /^[a-f0-9]{24}$/.test(value),
            authorizeBot: async () => {
                if (!state.authorized) throw new BotError(401, '密钥无效');
                return { settings: { userId, apiKeyHash: hash(token), allowedGroupIds: [groupId], allowPrivate: false }, user: { username: 'Bot' } };
            } },
    };
    // Keep real sockets and streams; expose body deadlines so expiry can be tested without a two-minute wait.
    const context = vm.createContext({ Buffer, console,
        setTimeout: (callback, delay) => {
            const timer = { callback, delay, handle: setTimeout(callback, delay) };
            state.timers.add(timer); return timer;
        },
        clearTimeout: (timer) => { clearTimeout(timer.handle); state.timers.delete(timer); },
    });
    const source = fs.readFileSync(new URL('../src/bot/http.ts', import.meta.url), 'utf8');
    const module = new vm.SourceTextModule(stripTypeScriptTypes(source), { context });
    await module.link((specifier) => {
        const exports = modules[specifier];
        assert(exports, `Unexpected import: ${specifier}`);
        return new vm.SyntheticModule(Object.keys(exports), function () {
            for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
        }, { context });
    });
    await module.evaluate();
    const app = new Koa();
    app.on('error', () => {}); // Deliberately aborted HTTP requests may also trigger Koa's socket error handler.
    app.use(module.namespace.default({ to: () => ({ emit() {} }) }));
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(async () => {
        for (const timer of state.timers) clearTimeout(timer.handle);
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
    });
    function start(route, headers = {}) {
        let request;
        const response = new Promise((resolve, reject) => {
            let received = false;
            request = http.request({ host: '127.0.0.1', port: server.address().port, path: `/api/bot/v1${route}`,
                method: 'POST', agent: false,
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers },
            }, (res) => {
                received = true;
                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('error', reject);
                res.on('end', () => resolve({ status: res.statusCode, headers: res.headers,
                    body: JSON.parse(Buffer.concat(chunks).toString()) }));
            });
            request.on('error', (error) => { if (!received) reject(error); });
        });
        return { request, response };
    }
    return { state, start, send(route, body, headers) {
        const pending = start(route, headers); pending.request.end(body); return pending.response;
    } };
}

for (const bytes of [20 * 1024, 3 * 1024 * 1024, imageLimit]) {
    test(`HTTP uploads a ${bytes}-byte decoded image`, { timeout: 15000 }, async (t) => {
        const h = await endpoint(t);
        const response = await h.send('/images', JSON.stringify({ file: Buffer.alloc(bytes, 42).toString('base64'), fileName: 'photo.png' }));
        assert.equal(response.status, 200);
        assert.equal(response.body.url, '/ImageMessage/test.png');
        assert.equal(h.state.uploads[0].bytes, bytes);
        assert.match(h.state.uploads[0].fileName, /\.png$/);
        assert.equal(h.state.timers.size, 0, 'successful reads must clear their deadline');
        assert.equal(response.headers['cache-control'], 'no-store');
        assert.equal(response.headers['access-control-allow-origin'], undefined);
    });
}

test('HTTP rejects an image above the decoded limit even when its JSON envelope fits', { timeout: 15000 }, async (t) => {
    const h = await endpoint(t);
    const body = JSON.stringify({ file: Buffer.alloc(imageLimit + 1).toString('base64') });
    assert(Buffer.byteLength(body) < envelopeLimit);
    const response = await h.send('/images', body);
    assert.equal(response.status, 413);
    assert.match(response.body.error, /15 MiB/);
    assert.equal(h.state.uploads.length, 0);
});

test('HTTP rejects oversized declared and streamed image envelopes with readable errors', { timeout: 15000 }, async (t) => {
    const h = await endpoint(t);
    const declared = h.start('/images', { 'Content-Length': envelopeLimit + 1 });
    declared.request.flushHeaders();
    assert.equal((await declared.response).status, 413, 'reject Content-Length before waiting for a body');
    const body = JSON.stringify({ file: Buffer.alloc(imageLimit).toString('base64'), padding: 'x'.repeat(16 * 1024) });
    assert(Buffer.byteLength(body) > envelopeLimit);
    const streamed = await h.send('/images', body, { 'Transfer-Encoding': 'chunked' });
    assert.equal(streamed.status, 413);
    assert.match(streamed.body.error, /20 MiB.*16 KiB/);
    assert.equal(h.state.uploads.length, 0);
    assert.equal(h.state.timers.size, 0);
});

test('messages still accept exactly 16 KiB and reject larger bodies, as do other POST routes', async (t) => {
    const h = await endpoint(t);
    const body = JSON.stringify({ conversationId: groupId, content: 'hello', requestId: '12345678-1234-1234-1234-123456789abc' }).padEnd(16 * 1024, ' ');
    assert.equal((await h.send('/messages', body)).status, 200);
    const oversized = await h.send('/messages', `${body} `, { 'Transfer-Encoding': 'chunked' });
    assert.equal(oversized.status, 413);
    assert.match(oversized.body.error, /16 KiB/);
    for (const route of ['/unknown', '/images/']) {
        assert.equal((await h.send(route, `${body} `)).status, 413);
    }
    assert.equal(h.state.sends, 1);
});

test('HTTP authenticates and rejects browser origins before reading image data', async (t) => {
    const h = await endpoint(t);
    for (const [headers, status] of [[{ Authorization: 'Bearer invalid' }, 401], [{ Origin: 'https://example.com' }, 403]]) {
        const pending = h.start('/images', { ...headers, 'Content-Length': envelopeLimit });
        pending.request.flushHeaders();
        assert.equal((await pending.response).status, status);
        assert.equal(h.state.timers.size, 0);
    }
    h.state.authorized = false;
    const revoked = h.start('/images', { 'Content-Length': envelopeLimit });
    revoked.request.flushHeaders();
    assert.equal((await revoked.response).status, 401);
    assert.equal(h.state.uploads.length, 0);
});

test('image reads have a bounded 120-second deadline while message reads retain 10 seconds', async (t) => {
    const h = await endpoint(t);
    for (const [route, delay] of [['/images', 120000], ['/messages', 10000]]) {
        const pending = h.start(route, { 'Transfer-Encoding': 'chunked' });
        pending.request.write('{');
        for (let attempt = 0; attempt < 100 && !h.state.timers.size; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 5));
        }
        const timer = [...h.state.timers][0];
        assert(timer, 'an incomplete request must have a body deadline');
        assert.equal(timer.delay, delay);
        timer.callback();
        const response = await pending.response;
        assert.equal(response.status, 408);
        assert.match(response.body.error, /超时/);
        assert.equal(h.state.timers.size, 0);
    }
});

test('an aborted image body clears its deadline and leaves the HTTP server usable', async (t) => {
    const h = await endpoint(t);
    const pending = h.start('/images', { 'Transfer-Encoding': 'chunked' });
    const disconnected = assert.rejects(pending.response, /socket hang up|ECONNRESET/);
    pending.request.write('{');
    for (let attempt = 0; attempt < 100 && !h.state.timers.size; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal(h.state.timers.size, 1);
    pending.request.destroy();
    await disconnected;
    for (let attempt = 0; attempt < 100 && h.state.timers.size; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal(h.state.timers.size, 0);
    assert.equal(h.state.uploads.length, 0);
    assert.equal((await h.send('/images', JSON.stringify({ file: Buffer.from('GIF89a').toString('base64') }))).status, 200);
});
