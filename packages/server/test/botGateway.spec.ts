import http from 'http';
import { EventEmitter } from 'events';
import Socket from '@fiora/database/mongoose/models/socket';
import { _invalidateUserOnlineStatusCache } from '../src/routes/user';
import { _invalidateGroupOnlineMembersCache } from '../src/routes/group';
import { authorizeBot, hash } from '../src/bot/config';
import { handleBotRequest } from '../src/bot/http';
import {
    installBotGateway,
    dispatchBotMessage,
    activeBotSessions,
} from '../src/bot/gateway';

// Use require for ws
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WebSocket = require('ws');

jest.mock('@fiora/config/server', () => ({ __esModule: true, default: { trustProxyHeaders: false } }));
jest.mock('@fiora/utils/logger', () => ({
    __esModule: true,
    default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), trace: jest.fn() },
}));
jest.mock('@fiora/database/mongoose/models/socket', () => ({
    __esModule: true,
    default: {
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({}),
    },
}));
jest.mock('../src/routes/user', () => ({
    __esModule: true,
    _invalidateUserOnlineStatusCache: jest.fn(),
}));
jest.mock('../src/routes/group', () => ({
    __esModule: true,
    _invalidateGroupOnlineMembersCache: jest.fn(),
}));
jest.mock('../src/bot/config', () => ({
    __esModule: true,
    hash: (v: string) => v,
    authorizeBot: jest.fn(),
}));
jest.mock('../src/bot/http', () => ({
    __esModule: true,
    handleBotRequest: jest.fn(),
}));

const botId = 'b'.repeat(24);
const groupId = 'c'.repeat(24);
const token = 'fiora_bot_' + '1'.repeat(64);

let server: http.Server;
let io: any;

beforeEach(() => {
    jest.clearAllMocks();
    activeBotSessions.clear();
    io = { to: jest.fn().mockReturnValue({ emit: jest.fn() }) };
    (authorizeBot as jest.Mock).mockResolvedValue({
        settings: {
            userId: botId,
            allowedGroupIds: [groupId],
            allowPrivate: true,
        },
        user: {
            username: 'DaFeiYu',
            avatar: 'avatar.png',
        },
    });
    (handleBotRequest as jest.Mock).mockResolvedValue({
        id: 'msg_' + '1'.repeat(24),
        conversationId: groupId,
    });
});

afterEach((done) => {
    if (server && server.listening) {
        server.close(done);
    } else {
        done();
    }
});

test('bot gateway registers online in Socket and cleans up on disconnect', async () => {
    server = http.createServer((req, res) => res.end('ok'));
    installBotGateway(server, io);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    // Connect with valid token query param
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/bot/v1/ws?token=${token}`);

    const readyMessage = await new Promise<any>((resolve) => {
        ws.on('message', (data: any) => {
            const parsed = JSON.parse(data.toString());
            if (parsed.type === 'ready') resolve(parsed);
        });
    });

    expect(readyMessage).toMatchObject({
        type: 'ready',
        user: { id: botId, name: 'DaFeiYu' },
        scope: { allowedGroupIds: [groupId], allowPrivate: true },
    });

    // Verify online presence was registered in Fiora's Socket model
    expect(Socket.create).toHaveBeenCalledWith(expect.objectContaining({
        user: botId,
        environment: 'bot',
        browser: 'DaFeiYu Bot',
    }));
    expect(_invalidateUserOnlineStatusCache).toHaveBeenCalledWith(botId);
    expect(_invalidateGroupOnlineMembersCache).toHaveBeenCalled();
    expect(activeBotSessions.size).toBe(1);

    // Test ping-pong
    ws.send(JSON.stringify({ type: 'ping' }));
    const pongMessage = await new Promise<any>((resolve) => {
        ws.on('message', (data: any) => {
            const parsed = JSON.parse(data.toString());
            if (parsed.type === 'pong') resolve(parsed);
        });
    });
    expect(pongMessage.type).toBe('pong');

    // Test dispatchBotMessage real-time delivery
    const incomingMessage = {
        _id: 'm1',
        to: groupId,
        from: { _id: 'user1', username: 'ChatUser' },
        type: 'text',
        content: '@大肥鱼 你好呀',
        createTime: new Date(),
    };
    dispatchBotMessage(incomingMessage);

    const eventReceived = await new Promise<any>((resolve) => {
        ws.on('message', (data: any) => {
            const parsed = JSON.parse(data.toString());
            if (parsed.type === 'message.created') resolve(parsed);
        });
    });
    expect(eventReceived.message).toMatchObject({
        id: 'm1',
        conversationId: groupId,
        user: { id: 'user1', name: 'ChatUser' },
        content: '@大肥鱼 你好呀',
    });

    // Test sending reply over WS
    ws.send(JSON.stringify({
        action: 'send',
        conversationId: groupId,
        content: '你好，我是大肥鱼！',
        requestId: '12345678-1234-1234-1234-123456789abc',
    }));

    const sentReceipt = await new Promise<any>((resolve) => {
        ws.on('message', (data: any) => {
            const parsed = JSON.parse(data.toString());
            if (parsed.type === 'sent') resolve(parsed);
        });
    });
    expect(sentReceipt).toMatchObject({
        type: 'sent',
        id: 'msg_' + '1'.repeat(24),
        conversationId: groupId,
        requestId: '12345678-1234-1234-1234-123456789abc',
    });

    // Close WS and verify cleanup
    ws.close();
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    expect(Socket.deleteMany).toHaveBeenCalled();
    expect(_invalidateUserOnlineStatusCache).toHaveBeenCalledWith(botId);
    expect(_invalidateGroupOnlineMembersCache).toHaveBeenCalled();
    expect(activeBotSessions.size).toBe(0);
});

test('bot gateway rejects unauthorized upgrade requests', async () => {
    server = http.createServer((req, res) => res.end('ok'));
    installBotGateway(server, io);

    (authorizeBot as jest.Mock).mockRejectedValueOnce(new Error('Invalid token'));

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as any).port;

    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/bot/v1/ws?token=invalid_token`);

    const errorHappened = await new Promise<boolean>((resolve) => {
        ws.on('error', () => resolve(true));
        ws.on('open', () => resolve(false));
    });

    expect(errorHappened).toBe(true);
    expect(Socket.create).not.toHaveBeenCalled();
});
