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
const WebSocket = require('ws');
const userId = 'b'.repeat(24);

async function gateway(t) {
    const records = new Map();
    const state = { authorized: true, beforeUpdate: async () => {} };
    const socketModel = {
        create: async (value) => { records.set(value.id, { ...value }); return value; },
        deleteMany: async (query) => {
            for (const [id, value] of records) {
                if (Object.entries(query).every(([key, expected]) => value[key] === expected)) records.delete(id);
            }
        },
        updateOne: async (query, update) => {
            await state.beforeUpdate();
            if (!records.has(query.id)) records.set(query.id, { ...update.$setOnInsert, ...query });
        },
    };
    const modules = {
        http: { default: http }, crypto: { randomBytes: crypto.randomBytes },
        '@fiora/config/server': { default: { trustProxyHeaders: false } },
        '@fiora/utils/logger': { default: { info() {}, warn() {}, error() {} } },
        '@fiora/database/mongoose/models/socket': { default: socketModel },
        '@fiora/utils/socket': { normalizeIp: (value) => value },
        '@fiora/database/mongoose/models/botConfig': { BotConfigDocument: {} },
        '../routes/user': { _invalidateUserOnlineStatusCache() {} },
        '../routes/group': { _invalidateGroupOnlineMembersCache() {} },
        './config': { authorizeBot: async () => {
            if (!state.authorized) throw new Error('Bot disabled');
            return { settings: { userId, allowedGroupIds: ['c'.repeat(24)], allowPrivate: true }, user: { username: 'Test Bot' } };
        } },
        './http': { handleBotRequest: async () => ({}) },
    };
    const context = vm.createContext({ require, Buffer, URL, console, setTimeout, clearTimeout, setInterval, clearInterval });
    const source = fs.readFileSync(new URL('../src/bot/gateway.ts', import.meta.url), 'utf8');
    const module = new vm.SourceTextModule(stripTypeScriptTypes(source), { context });
    await module.link((specifier) => {
        const exports = modules[specifier];
        assert(exports, `Unexpected import: ${specifier}`);
        return new vm.SyntheticModule(Object.keys(exports), function () {
            for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
        }, { context });
    });
    await module.evaluate();
    const server = http.createServer();
    const wss = module.namespace.installBotGateway(server, { to: () => ({ emit() {} }) });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const clients = [];
    t.after(async () => {
        for (const ws of clients) ws.terminate();
        for (const ws of wss.clients) ws.terminate();
        await new Promise((resolve) => server.close(resolve));
        wss.close();
    });
    return { records, state, sessions: module.namespace.activeBotSessions, async connect() {
        const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/api/bot/v1/ws?token=test`);
        clients.push(ws);
        const message = await once(ws, 'message');
        assert.equal(JSON.parse(message[0]).type, 'ready');
        return ws;
    } };
}

test('closing a newer bot connection keeps an older live connection online', { timeout: 5000 }, async (t) => {
    const h = await gateway(t);
    const first = await h.connect();
    const second = await h.connect();
    const closed = once(second, 'close');
    second.close(); await closed;
    for (let attempt = 0; attempt < 100 && h.sessions.size !== 1; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal(first.readyState, WebSocket.OPEN);
    assert.equal(h.sessions.size, 1);
    assert.equal(h.records.size, 1, 'one live socket must still have one online record');
});

test('heartbeat restores a missing online record for an active authenticated connection', { timeout: 5000 }, async (t) => {
    const h = await gateway(t);
    const ws = await h.connect();
    h.records.clear();
    const reply = once(ws, 'message');
    ws.send(JSON.stringify({ type: 'ping' }));
    assert.equal(JSON.parse((await reply)[0]).type, 'pong');
    assert.equal(h.records.size, 1);
    assert.equal([...h.records.values()][0].user, userId);
});

test('a revoked bot cannot recreate its online record through a heartbeat', { timeout: 5000 }, async (t) => {
    const h = await gateway(t);
    const ws = await h.connect();
    h.records.clear();
    h.state.authorized = false;
    const closed = once(ws, 'close');
    ws.send(JSON.stringify({ type: 'ping' }));
    assert.equal((await closed)[0], 1008);
    assert.equal(h.records.size, 0);
});

test('a heartbeat finishing after disconnection does not leave a ghost online record', { timeout: 5000 }, async (t) => {
    const h = await gateway(t);
    const ws = await h.connect();
    let resume;
    const pending = new Promise((resolve) => { resume = resolve; });
    const updating = new Promise((resolve) => {
        h.state.beforeUpdate = async () => { resolve(); await pending; };
    });
    ws.send(JSON.stringify({ type: 'ping' }));
    await updating;
    const closed = once(ws, 'close');
    ws.close();
    await closed;
    for (let attempt = 0; attempt < 100 && h.sessions.size; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
    resume();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(h.records.size, 0);
    assert.equal(h.sessions.size, 0);
});
