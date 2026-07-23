import { Socket } from 'socket.io';
import {
    getNewUserKey,
    getSealUserKey,
    Redis,
} from '@fiora/database/redis/initRedis';

export const CALL_SERVICE_FREQUENTLY = '发消息过于频繁，请 10 秒后再试';
export const NEW_USER_CALL_SERVICE_FREQUENTLY =
    '发消息过于频繁，请 10 秒后再试';

const MaxCallPerMinutes = 30;
const NewUserMaxCallPerMinutes = 30;
const ClearDataInterval = 60000;

export const AutoSealDuration = 10; // seconds

type Options = {
    maxCallPerMinutes?: number;
    newUserMaxCallPerMinutes?: number;
    clearDataInterval?: number;
};

/**
 * 限制接口调用频率
 * 新用户和普通用户均限制每分钟30次
 */
export default function frequency(
    socket: Socket,
    {
        maxCallPerMinutes = MaxCallPerMinutes,
        newUserMaxCallPerMinutes = NewUserMaxCallPerMinutes,
        clearDataInterval = ClearDataInterval,
    }: Options = {},
) {
    let callTimes: Record<string, number> = {};

    // 每60s清空一次次数统计
    const clearDataTimer = setInterval(() => {
        callTimes = {};
    }, clearDataInterval);
    socket.once?.('disconnect', () => clearInterval(clearDataTimer));

    return async ([event, , cb]: MiddlewareArgs, next: MiddlewareNext) => {
        if (event !== 'sendMessage') {
            next();
        } else {
            const socketId = socket.id;
            const count = callTimes[socketId] || 0;

            const isNewUser =
                socket.data.user &&
                (await Redis.has(getNewUserKey(socket.data.user)));
            if (isNewUser && count >= newUserMaxCallPerMinutes) {
                // new user limit
                cb(NEW_USER_CALL_SERVICE_FREQUENTLY);
                callTimes[socketId] = 0;
                await Redis.set(
                    getSealUserKey(socket.data.user),
                    socket.data.user,
                    AutoSealDuration,
                );
            } else if (count >= maxCallPerMinutes) {
                // normal user limit
                cb(CALL_SERVICE_FREQUENTLY);
                callTimes[socketId] = 0;
                await Redis.set(
                    getSealUserKey(socket.data.user),
                    socket.data.user,
                    AutoSealDuration,
                );
            } else {
                callTimes[socketId] = count + 1;
                next();
            }
        }
    };
}
