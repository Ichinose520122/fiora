import assert from 'assert';
import { randomBytes } from 'crypto';
import BotConfig from '@fiora/database/mongoose/models/botConfig';
import Group from '@fiora/database/mongoose/models/group';
import { assertAdministrator, assertBotUser, defaultConfig, hash, identifier, managementResult, publicConfig, revision, storedConfig } from '../bot/config';

export async function getBotConfig(ctx: Context<{ userId?: string }>) {
    await assertAdministrator(ctx.socket.user);
    const candidate = ctx.data && ctx.data.userId;
    if (candidate) await assertBotUser(candidate);
    return managementResult((await storedConfig()) || defaultConfig, candidate);
}

export async function saveBotConfig(ctx: Context<{ enabled: boolean; userId: string; allowedGroupIds: string[]; allowPrivate: boolean }>) {
    await assertAdministrator(ctx.socket.user);
    const data = ctx.data;
    assert(data && typeof data.enabled === 'boolean' && typeof data.allowPrivate === 'boolean', '机器人配置格式错误');
    await assertBotUser(data.userId);
    assert(Array.isArray(data.allowedGroupIds) && data.allowedGroupIds.length <= 100 && data.allowedGroupIds.every(identifier), '群组范围格式错误');
    const groupIds = [...new Set(data.allowedGroupIds)];
    const groups = await Group.find({ _id: { $in: groupIds }, members: data.userId }, { _id: 1 }).lean();
    assert(groups.length === groupIds.length, '机器人必须已加入全部授权群组');
    await BotConfig.init();
    const existing = await storedConfig();
    const changedUser = !existing || existing.userId !== data.userId;
    const updated = await BotConfig.findOneAndUpdate({ singleton: 'default', ...(existing ? { revision: existing.revision } : { revision: { $exists: false } }) }, {
        $set: { enabled: data.enabled, userId: data.userId,
            allowedGroupIds: changedUser ? [] : groupIds, allowPrivate: changedUser ? false : data.allowPrivate,
            revision: revision(), updatedAt: new Date(),
            ...(changedUser ? { apiKeyHash: '', apiKeyPrefix: '' } : {}),
        },
    }, { new: true, upsert: !existing, setDefaultsOnInsert: true }).select('+apiKeyHash').lean();
    assert(updated, '配置已被其他管理员修改，请刷新后重试');
    return managementResult(updated);
}

export async function rotateBotApiKey(ctx: Context<{}>) {
    await assertAdministrator(ctx.socket.user);
    const existing = await storedConfig();
    assert(existing, '请先保存机器人配置');
    await assertBotUser(existing!.userId);
    assert(existing!.allowedGroupIds.length > 0 || existing!.allowPrivate, '请先配置会话范围');
    const apiKey = `fiora_bot_${randomBytes(32).toString('hex')}`;
    const updated = await BotConfig.findOneAndUpdate({ singleton: 'default', revision: existing!.revision }, {
        $set: { apiKeyHash: hash(apiKey), apiKeyPrefix: apiKey.slice(0, 18), revision: revision(), updatedAt: new Date() },
    }, { new: true }).select('+apiKeyHash').lean();
    assert(updated, '配置已被其他管理员修改，请刷新后重试');
    return { config: publicConfig(updated!), apiKey };
}

export async function revokeBotApiKey(ctx: Context<{}>) {
    await assertAdministrator(ctx.socket.user);
    const updated = await BotConfig.findOneAndUpdate({ singleton: 'default' }, {
        $set: { apiKeyHash: '', apiKeyPrefix: '', revision: revision(), updatedAt: new Date() },
    }, { new: true }).select('+apiKeyHash').lean();
    return { config: publicConfig(updated || defaultConfig) };
}
