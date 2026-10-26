import assert from 'assert';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import config from '@fiora/config/server';
import BotConfig, { BotConfigDocument } from '@fiora/database/mongoose/models/botConfig';
import User from '@fiora/database/mongoose/models/user';
import Group from '@fiora/database/mongoose/models/group';
import { Redis, getSealUserKey } from '@fiora/database/redis/initRedis';

export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const identifier = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{24}$/.test(value);
export const revision = () => randomBytes(16).toString('hex');
export const defaultConfig = { enabled: false, userId: '', allowedGroupIds: [] as string[], allowPrivate: false, apiKeyPrefix: '', revision: '', updatedAt: null };

export function publicConfig(value: any) {
    return {
        enabled: !!value.enabled, userId: value.userId || '',
        allowedGroupIds: [...(value.allowedGroupIds || [])], allowPrivate: !!value.allowPrivate,
        hasApiKey: !!value.apiKeyHash, apiKeyPrefix: value.apiKeyPrefix || '',
        updatedAt: value.updatedAt ? new Date(value.updatedAt).toISOString() : null,
    };
}

export async function assertAdministrator(userId: string) {
    assert(identifier(userId), '请先登录');
    const actor = await User.findById(userId, { isAdmin: 1 }).lean();
    assert(actor && (actor.isAdmin || config.administrator.includes(String(actor._id))), '你不是管理员');
}

export async function assertBotUser(userId: string) {
    assert(identifier(userId), '请选择机器人账号');
    const user = await User.findById(userId, { username: 1, avatar: 1, isAdmin: 1 }).lean();
    assert(user && !user.isAdmin && !config.administrator.includes(userId), '机器人必须使用现有非管理员账号');
    assert(!(await Redis.has(getSealUserKey(userId))), '机器人账号已被封禁');
    return user!;
}

export async function storedConfig() {
    return BotConfig.findOne({ singleton: 'default' }).select('+apiKeyHash').lean();
}

export async function managementResult(value: any, candidate?: string) {
    const users = await User.find({ isAdmin: { $ne: true }, _id: { $nin: config.administrator } }, { username: 1 }).sort({ username: 1 }).limit(500).lean();
    const selected = candidate || value.userId;
    if (selected && identifier(selected) && !users.some(user => String(user._id) === selected)) {
        const current = await User.findById(selected, { username: 1 }).lean();
        if (current) users.push(current as any);
    }
    const groups = selected && identifier(selected)
        ? await Group.find({ members: selected }, { name: 1 }).sort({ name: 1 }).limit(500).lean() : [];
    return { config: publicConfig(value), options: {
        users: users.map(user => ({ _id: String(user._id), username: user.username })),
        groups: groups.map(group => ({ _id: String(group._id), name: group.name })),
    } };
}

export class BotError extends Error {
    status: number;
    constructor(status: number, message: string) { super(message); this.status = status; }
}

export async function authorizeBot(token: string) {
    if (!/^fiora_bot_[a-f0-9]{64}$/.test(token)) throw new BotError(401, '机器人凭据无效');
    const value = await storedConfig();
    if (!value || !value.enabled || !value.apiKeyHash || !timingSafeEqual(Buffer.from(hash(token)), Buffer.from(value.apiKeyHash))) {
        throw new BotError(401, '机器人凭据无效或已停用');
    }
    const user = await assertBotUser(value.userId);
    assert(value.allowedGroupIds.length > 0 || value.allowPrivate, '机器人尚未配置会话范围');
    return { settings: value as BotConfigDocument, user };
}
