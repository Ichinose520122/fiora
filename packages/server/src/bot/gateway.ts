import http from 'http';
import { randomBytes } from 'crypto';
import config from '@fiora/config/server';
import logger from '@fiora/utils/logger';
import Socket from '@fiora/database/mongoose/models/socket';
import { normalizeIp } from '@fiora/utils/socket';
import { BotConfigDocument } from '@fiora/database/mongoose/models/botConfig';
import { _invalidateUserOnlineStatusCache } from '../routes/user';
import { _invalidateGroupOnlineMembersCache } from '../routes/group';
import { authorizeBot } from './config';
import { handleBotRequest } from './http';

// Use require for ws to avoid missing @types/ws compile issues.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WebSocket = require('ws');

export interface ActiveBotSession {
    socketId: string;
    userId: string;
    token: string;
    settings: BotConfigDocument;
    ws: any;
    ip: string;
    connectedAt: Date;
}

export const activeBotSessions = new Map<string, ActiveBotSession>();

function firstHeaderValue(value: string | string[] | undefined) {
    const rawValue = Array.isArray(value) ? value[0] : value;
    return rawValue ? rawValue.split(',')[0].trim() : '';
}

function getUpgradeIp(req: http.IncomingMessage, trustProxyHeaders = false): string {
    const remoteAddress = req.socket?.remoteAddress || '';
    if (!trustProxyHeaders) return normalizeIp(remoteAddress) || '127.0.0.1';
    const headers = req.headers || {};
    const forwarded = firstHeaderValue(headers['x-forwarded-for']) ||
        firstHeaderValue(headers['x-real-ip']) ||
        firstHeaderValue(headers['cf-connecting-ip']);
    return normalizeIp(forwarded) || normalizeIp(remoteAddress) || '127.0.0.1';
}

function formatMessageEvent(messageData: any) {
    return {
        type: 'message.created',
        message: {
            id: String(messageData._id),
            conversationId: String(messageData.to),
            user: {
                id: String(messageData.from?._id || ''),
                name: messageData.from?.username || '未知用户',
            },
            type: messageData.type,
            content: messageData.deleted ? '' : messageData.content,
            deleted: !!messageData.deleted,
            createdAt: messageData.createTime ? new Date(messageData.createTime).toISOString() : new Date().toISOString(),
        },
    };
}

/**
 * Dispatch an incoming message event to all active bot connections
 * whose scope covers the conversation. Excludes the bot's own messages.
 */
export function dispatchBotMessage(messageData: any) {
    if (!messageData || activeBotSessions.size === 0) return;
    const toId = String(messageData.to);
    const fromId = String(messageData.from?._id || '');

    const eventPayload = JSON.stringify(formatMessageEvent(messageData));

    for (const session of activeBotSessions.values()) {
        // Do not echo the bot's own message back to itself
        if (fromId === session.userId) continue;

        const isGroupAllowed = session.settings.allowedGroupIds?.includes(toId);
        const isPrivateAllowed = session.settings.allowPrivate && (
            toId.length === 48 && (toId.startsWith(session.userId) || toId.endsWith(session.userId))
        );

        if (!isGroupAllowed && !isPrivateAllowed) continue;

        try {
            if (session.ws && session.ws.readyState === WebSocket.OPEN) {
                session.ws.send(eventPayload);
            }
        } catch (error) {
            logger.warn('[BotGateway]', `Failed to send event to bot ${session.userId}:`, (error as Error).message);
        }
    }
}

/**
 * Installs the WebSocket bot gateway on Fiora's HTTP server.
 * Handles /api/bot/v1/ws and registers active bot sockets into Fiora's online registry.
 */
export function installBotGateway(httpServer: http.Server, io: any) {
    const wss = new WebSocket.Server({ noServer: true });

    httpServer.on('upgrade', async (req: http.IncomingMessage, socket: any, head: Buffer) => {
        const url = new URL(req.url || '', 'http://localhost');
        if (url.pathname !== '/api/bot/v1/ws') {
            return;
        }

        const authHeader = req.headers.authorization;
        const queryToken = url.searchParams.get('token');
        let token = queryToken || '';
        if (!token && authHeader && /^Bearer\s+/i.test(authHeader)) {
            token = authHeader.replace(/^Bearer\s+/i, '').trim();
        }

        if (!token) {
            socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{"error":"缺少机器人 API Key"}\r\n');
            socket.destroy();
            return;
        }

        let auth: any;
        try {
            auth = await authorizeBot(token);
        } catch (error) {
            socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n{"error":"机器人凭据无效或已停用"}\r\n');
            socket.destroy();
            return;
        }

        wss.handleUpgrade(req, socket, head, (ws: any) => {
            wss.emit('connection', ws, req, auth, token);
        });
    });

    wss.on('connection', async (ws: any, req: http.IncomingMessage, auth: any, token: string) => {
        const ip = getUpgradeIp(req, config.trustProxyHeaders);
        const socketId = `bot_${auth.settings.userId}_${randomBytes(8).toString('hex')}`;

        // Register in Fiora's real-time Socket collection so the bot is online just like a real user
        const presence = {
            id: socketId,
            user: auth.settings.userId,
            ip,
            os: 'Windows',
            browser: 'DaFeiYu Bot',
            environment: 'bot',
            createTime: new Date(),
        };
        try {
            await Socket.create(presence);
            if (ws.readyState !== WebSocket.OPEN) {
                await Socket.deleteMany({ id: socketId });
                return;
            }
            _invalidateUserOnlineStatusCache(auth.settings.userId);
            _invalidateGroupOnlineMembersCache();
            logger.info('[BotGateway]', `Bot connected: ${auth.user.username} (${auth.settings.userId}) socketId=${socketId}`);
        } catch (error) {
            logger.error('[BotGateway]', 'Failed to create Socket record for bot:', (error as Error).message);
            ws.close(1011, 'Failed to initialize session');
            return;
        }

        const session: ActiveBotSession = {
            socketId,
            userId: auth.settings.userId,
            token,
            settings: auth.settings,
            ws,
            ip,
            connectedAt: new Date(),
        };
        activeBotSessions.set(socketId, session);

        // Send ready message
        try {
            ws.send(JSON.stringify({
                type: 'ready',
                user: {
                    id: auth.settings.userId,
                    name: auth.user.username,
                    avatar: auth.user.avatar || '',
                },
                scope: {
                    allowedGroupIds: [...auth.settings.allowedGroupIds],
                    allowPrivate: auth.settings.allowPrivate,
                },
            }));
        } catch {
            // handle in close
        }

        ws.on('message', async (raw: any) => {
            let data: any;
            try {
                data = JSON.parse(raw.toString());
            } catch {
                ws.send(JSON.stringify({ type: 'error', error: 'JSON 格式错误' }));
                return;
            }

            if (!data || typeof data !== 'object') return;

            // Handle ping / heartbeat
            if (data.type === 'ping' || data.action === 'ping') {
                try {
                    const current = await authorizeBot(token);
                    if (current.settings.userId !== session.userId) throw new Error('Bot identity changed');
                    if (!activeBotSessions.has(socketId) || ws.readyState !== WebSocket.OPEN) return;
                    session.settings = current.settings;
                    await Socket.updateOne({ id: socketId }, { $setOnInsert: presence }, { upsert: true });
                    if (!activeBotSessions.has(socketId) || ws.readyState !== WebSocket.OPEN) {
                        await Socket.deleteMany({ id: socketId });
                        return;
                    }
                    _invalidateUserOnlineStatusCache(session.userId);
                    _invalidateGroupOnlineMembersCache();
                    ws.send(JSON.stringify({ type: 'pong', time: Date.now() }));
                } catch (error) {
                    logger.warn('[BotGateway]', 'Bot heartbeat validation failed:', (error as Error).message);
                    ws.close(1008, 'Bot authentication or presence check failed');
                }
                return;
            }

            // Handle upload_image action
            if (data.action === 'upload_image' || data.action === 'upload') {
                const { file, fileName, requestId } = data;
                try {
                    const result: any = await handleBotRequest(
                        token,
                        'POST',
                        '/images',
                        {},
                        { file, fileName },
                        (target: string | string[], event: string, value: any) => io.to(target).emit(event, value),
                    );
                    ws.send(JSON.stringify({
                        type: 'uploaded',
                        url: result.url,
                        requestId,
                    }));
                } catch (err) {
                    const error = err as any;
                    ws.send(JSON.stringify({
                        type: 'error',
                        requestId,
                        error: error.message || '上传图片失败',
                        status: error.status || 500,
                    }));
                }
                return;
            }

            // Handle send action
            if (data.action === 'send' || data.type === 'send') {
                const { conversationId, content, requestId, type = 'text' } = data;
                if (!requestId || typeof requestId !== 'string') {
                    ws.send(JSON.stringify({ type: 'error', error: 'requestId 必填且需为 UUID' }));
                    return;
                }
                try {
                    const result: any = await handleBotRequest(
                        token,
                        'POST',
                        '/messages',
                        {},
                        { conversationId, content, requestId, type },
                        (target: string | string[], event: string, value: any) => io.to(target).emit(event, value),
                    );
                    ws.send(JSON.stringify({
                        type: 'sent',
                        id: result.id,
                        conversationId: result.conversationId,
                        requestId,
                    }));
                } catch (err) {
                    const error = err as any;
                    ws.send(JSON.stringify({
                        type: 'error',
                        requestId,
                        error: error.message || '发送失败',
                        status: error.status || 500,
                    }));
                }
            }
        });

        let cleanedUp = false;
        const cleanup = async () => {
            if (cleanedUp) return;
            cleanedUp = true;
            activeBotSessions.delete(socketId);
            try {
                await Socket.deleteMany({ id: socketId });
                _invalidateUserOnlineStatusCache(auth.settings.userId);
                _invalidateGroupOnlineMembersCache();
                logger.info('[BotGateway]', `Bot disconnected: ${auth.user.username} (${auth.settings.userId})`);
            } catch (error) {
                logger.error('[BotGateway]', 'Failed to clean up bot socket record:', (error as Error).message);
            }
        };

        ws.on('close', cleanup);
        ws.on('error', cleanup);
    });

    return wss;
}
