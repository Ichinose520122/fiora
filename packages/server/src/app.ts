import Koa from 'koa';
import koaSend from 'koa-send';
import koaStatic from 'koa-static';
import path from 'path';
import http from 'http';
import { Server } from 'socket.io';

import logger from '@fiora/utils/logger';
import config from '@fiora/config/server';
import { getSocketIp } from '@fiora/utils/socket';
import SocketModel, {
    SocketDocument,
} from '@fiora/database/mongoose/models/socket';

import seal from './middlewares/seal';
import frequency from './middlewares/frequency';
import isLogin from './middlewares/isLogin';
import isAdmin from './middlewares/isAdmin';

import * as userRoutes from './routes/user';
import * as groupRoutes from './routes/group';
import * as messageRoutes from './routes/message';
import * as systemRoutes from './routes/system';
import * as notificationRoutes from './routes/notification';
import * as historyRoutes from './routes/history';
import registerRoutes from './middlewares/registerRoutes';
import ensureQQExpressionCache, {
    qqExpressionCacheRoot,
} from './utils/qqExpressionCache';

const app = new Koa();
app.proxy = true;

const httpServer = http.createServer(app.callback());
const io = new Server(httpServer, {
    cors: {
        origin: config.allowOrigin || '*',
        credentials: true,
    },

    maxHttpBufferSize: config.maxHttpBufferSize,
    pingTimeout: 120000,
    pingInterval: 30000,
});

// Wait for the complete local QQ expression cache before publishing its manifest.
app.use(async (ctx, next) => {
    if (ctx.path !== '/QQExpression/_index.json') {
        await next();
        return;
    }

    try {
        await ensureQQExpressionCache();
        await koaSend(ctx, '_index.json', {
            root: qqExpressionCacheRoot,
            maxage: 1000 * 60 * 60 * 24 * 7,
            gzip: true,
        });
    } catch (error) {
        logger.error('[QQExpressionCache]', (error as Error).message);
        ctx.status = 503;
        ctx.body = { message: 'QQ 表情缓存暂时不可用' };
    }
});

// serve index.html
app.use(async (ctx, next) => {
    if (
        /\/invite\/group\/[\w\d]+/.test(ctx.request.url) ||
        !/(\.)|(\/invite\/group\/[\w\d]+)/.test(ctx.request.url)
    ) {
        await koaSend(ctx, 'index.html', {
            root: path.join(__dirname, '../public'),
            maxage: 1000 * 60 * 60 * 24 * 7,
            gzip: true,
        });
    } else {
        await next();
    }
});

// serve public static files
app.use(
    koaStatic(path.join(__dirname, '../public'), {
        maxAge: 1000 * 60 * 60 * 24 * 7,
        gzip: true,
    }),
);

const routes = {
    ...userRoutes,
    ...groupRoutes,
    ...messageRoutes,
    ...systemRoutes,
    ...notificationRoutes,
    ...historyRoutes,
} as unknown as Routes;
Object.keys(routes).forEach((key) => {
    if (key.startsWith('_')) {
        routes[key] = null;
    }
});

io.on('connection', async (socket) => {
    const ip = getSocketIp(socket, config.trustProxyHeaders);
    logger.trace(`connection ${socket.id} ${ip}`);
    await SocketModel.create({
        id: socket.id,
        ip,
    } as SocketDocument);

    socket.on('disconnect', async () => {
        logger.trace(`disconnect ${socket.id}`);
        const disconnectedSocket = await SocketModel.findOneAndDelete({
            id: socket.id,
        });
        if (disconnectedSocket?.user) {
            userRoutes._invalidateUserOnlineStatusCache(
                disconnectedSocket.user.toString(),
            );
            groupRoutes._invalidateGroupOnlineMembersCache();
        }
    });

    socket.use(seal(socket));
    socket.use(isLogin(socket));
    socket.use(isAdmin(socket));
    socket.use(frequency(socket));
    socket.use(
        registerRoutes(socket, routes, {
            onUserChange: (userId) => {
                userRoutes._invalidateUserOnlineStatusCache(userId);
                groupRoutes._invalidateGroupOnlineMembersCache();
            },
        }),
    );
});

export default httpServer;
