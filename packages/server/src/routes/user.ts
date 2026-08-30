import bcrypt from 'bcryptjs';
import assert, { AssertionError } from 'assert';
import jwt from 'jwt-simple';
import { Types } from '@fiora/database/mongoose';

import config from '@fiora/config/server';
import getRandomAvatar from '@fiora/utils/getRandomAvatar';
import { SALT_ROUNDS } from '@fiora/utils/const';
import {
    defaultTagStyle,
    TagParticleTypes,
    TagStyle,
    TagStylePresets,
} from '@fiora/utils/tagStyle';
import User, { UserDocument } from '@fiora/database/mongoose/models/user';
import Group, { GroupDocument } from '@fiora/database/mongoose/models/group';
import Friend, { FriendDocument } from '@fiora/database/mongoose/models/friend';
import Socket from '@fiora/database/mongoose/models/socket';
import Message, {
    handleInviteV2Messages,
} from '@fiora/database/mongoose/models/message';
import Notification from '@fiora/database/mongoose/models/notification';
import {
    getNewRegisteredUserIpKey,
    getNewUserKey,
    getRegisterAttemptIpKey,
    Redis,
} from '@fiora/database/redis/initRedis';

const { isValid } = Types.ObjectId;

/** 一天时间 */
const OneDay = 1000 * 60 * 60 * 24;
const HexColorRegExp = /^#[0-9a-f]{6}$/i;

function normalizeTagStyle(style: TagStyle): TagStyle {
    assert(style && typeof style === 'object', '标签样式格式错误');
    assert(
        TagStylePresets.includes(style.preset),
        '不支持的标签颜色模板',
    );
    assert(
        TagParticleTypes.includes(style.particle),
        '不支持的标签粒子类型',
    );

    const colors = Array.isArray(style.colors) ? style.colors.slice(0, 3) : [];
    assert(colors.every((color) => HexColorRegExp.test(color)), '标签颜色格式错误');
    if (style.preset === 'dualGradient') {
        assert(colors.length === 2, '双色渐变需要配置两个颜色');
    }
    if (style.preset === 'tripleGradient') {
        assert(colors.length === 3, '三色渐变需要配置三个颜色');
    }

    return {
        preset: style.preset,
        colors,
        particle: style.particle,
    };
}

interface Environment {
    /** 客户端系统 */
    os: string;
    /** 客户端浏览器 */
    browser: string;
    /** 客户端环境信息 */
    environment: string;
}

/**
 * 生成jwt token
 * @param user 用户
 * @param environment 客户端环境信息
 */
function generateToken(user: string, environment: string) {
    return jwt.encode(
        {
            user,
            environment,
            expires: Date.now() + config.tokenExpiresTime,
        },
        config.jwtSecret,
    );
}

/**
 * 处理注册时间不满24小时的用户
 * @param user 用户
 */
async function handleNewUser(user: UserDocument, ip = '') {
    // 将用户添加到新用户列表, 24小时后删除
    if (Date.now() - user.createTime.getTime() < OneDay) {
        const userId = user._id.toString();
        await Redis.set(getNewUserKey(userId), userId, Redis.Day);

        if (ip) {
            const registeredCount = await Redis.get(
                getNewRegisteredUserIpKey(ip),
            );
            await Redis.set(
                getNewRegisteredUserIpKey(ip),
                (parseInt(registeredCount || '0', 10) + 1).toString(),
                Redis.Day,
            );
        }
    }
}

async function getUserNotificationTokens(user: UserDocument) {
    const notifications = (await Notification.find({ user })) || [];
    return notifications.map(({ token }) => token);
}

/**
 * 注册新用户
 * @param ctx Context
 */
export async function register(
    ctx: Context<
        {
            username: string;
            password: string;
            inviteCode: string;
        } & Environment
    >,
) {
    assert(!config.disableRegister, '注册功能已被禁用, 请联系管理员开通账号');

    const {
        username,
        password,
        inviteCode,
        os,
        browser,
        environment,
    } = ctx.data;
    assert(username, '洛克王国 ID 不能为空');
    assert(password, '学号不能为空');
    assert(config.inviteCode, '注册邀请码尚未配置，请联系管理员');

    const registerAttemptKey = getRegisterAttemptIpKey(ctx.socket.ip);
    const registerAttemptCount = parseInt(
        (await Redis.get(registerAttemptKey)) || '0',
        10,
    );
    assert(
        registerAttemptCount < 10,
        '注册尝试次数过多，请 10 分钟后再试',
    );
    await Redis.set(
        registerAttemptKey,
        (registerAttemptCount + 1).toString(),
        Redis.Minute * 10,
    );
    assert(
        inviteCode?.trim() === config.inviteCode.trim(),
        '邀请码无效',
    );

    const user = await User.findOne({ username });
    assert(!user, '该洛克王国 ID 已存在');

    const registeredCountWithin24Hours = await Redis.get(
        getNewRegisteredUserIpKey(ctx.socket.ip),
    );
    assert(parseInt(registeredCountWithin24Hours || '0', 10) < 3, '系统错误');

    const defaultGroup = await Group.findOne({ isDefault: true });
    if (!defaultGroup) {
        // TODO: refactor when node types support "Assertion Functions" https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#assertion-functions
        throw new AssertionError({ message: '默认群组不存在' });
    }

    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(password, salt);

    let newUser = null;
    try {
        newUser = await User.create({
            username,
            salt,
            password: hash,
            avatar: getRandomAvatar(),
            lastLoginIp: ctx.socket.ip,
        } as UserDocument);
    } catch (err) {
        if ((err as Error).name === 'ValidationError') {
            return '洛克王国 ID 包含不支持的字符或者长度超过限制';
        }
        throw err;
    }

    await handleNewUser(newUser, ctx.socket.ip);

    if (!defaultGroup.creator) {
        defaultGroup.creator = newUser._id;
    }
    defaultGroup.members.push(newUser._id);
    await defaultGroup.save();

    const token = generateToken(newUser._id.toString(), environment);

    ctx.socket.user = newUser._id.toString();
    await Socket.updateOne(
        { id: ctx.socket.id },
        {
            user: newUser._id,
            os,
            browser,
            environment,
        },
    );

    return {
        _id: newUser._id,
        avatar: newUser.avatar,
        username: newUser.username,
        groups: [
            {
                _id: defaultGroup._id,
                name: defaultGroup.name,
                avatar: defaultGroup.avatar,
                creator: defaultGroup.creator,
                createTime: defaultGroup.createTime,
                messages: [],
            },
        ],
        friends: [],
        token,
        isAdmin: false,
        notificationTokens: [],
    };
}

/**
 * 管理员手动创建账号。公开注册关闭时使用此接口。
 */
export async function createUser(
    ctx: Context<{ username: string; password: string }>,
) {
    const username = ctx.data.username?.trim();
    const { password } = ctx.data;
    assert(username, '洛克王国 ID 不能为空');
    assert(password, '学号不能为空');

    const existUser = await User.findOne({ username });
    assert(!existUser, '该洛克王国 ID 已存在');

    const defaultGroup = await Group.findOne({ isDefault: true });
    if (!defaultGroup) {
        throw new AssertionError({ message: '默认群组不存在' });
    }

    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(password, salt);

    let newUser = null;
    try {
        newUser = await User.create({
            username,
            salt,
            password: hash,
            avatar: getRandomAvatar(),
        } as UserDocument);
    } catch (err) {
        if ((err as Error).name === 'ValidationError') {
            return '洛克王国 ID 包含不支持的字符或者长度超过限制';
        }
        throw err;
    }

    if (!defaultGroup.creator) {
        defaultGroup.creator = newUser._id;
    }
    defaultGroup.members.push(newUser._id);
    await defaultGroup.save();

    return {
        _id: newUser._id,
        username: newUser.username,
        avatar: newUser.avatar,
    };
}

/**
 * 账密登录
 * @param ctx Context
 */
export async function login(
    ctx: Context<{ username: string; password: string } & Environment>,
) {
    const { username, password, os, browser, environment } = ctx.data;
    assert(username, '用户名不能为空');
    assert(password, '密码不能为空');

    const user = await User.findOne({ username });
    if (!user) {
        throw new AssertionError({ message: '该用户不存在' });
    }

    const isPasswordCorrect = bcrypt.compareSync(password, user.password);
    assert(isPasswordCorrect, '密码错误');

    await handleNewUser(user);

    user.lastLoginTime = new Date();
    user.lastLoginIp = ctx.socket.ip;
    await user.save();

    const groups = await Group.find(
        { members: user._id },
        {
            _id: 1,
            name: 1,
            avatar: 1,
            creator: 1,
            createTime: 1,
        },
    );
    groups.forEach((group) => {
        ctx.socket.join(group._id.toString());
    });

    const friends = await Friend.find({ from: user._id }).populate('to', {
        avatar: 1,
        username: 1,
    });

    const token = generateToken(user._id.toString(), environment);

    ctx.socket.user = user._id.toString();
    await Socket.updateOne(
        { id: ctx.socket.id },
        {
            user: user._id,
            os,
            browser,
            environment,
        },
    );

    const notificationTokens = await getUserNotificationTokens(user);
    const isAdmin =
        user.isAdmin || config.administrator.includes(user._id.toString());
    ctx.socket.isAdmin = isAdmin;

    return {
        _id: user._id,
        avatar: user.avatar,
        username: user.username,
        tag: user.tag,
        tagStyle: user.tagStyle || defaultTagStyle,
        expressions: user.expressions || [],
        groups,
        friends,
        token,
        isAdmin,
        notificationTokens,
    };
}

/**
 * token登录
 * @param ctx Context
 */
export async function loginByToken(
    ctx: Context<{ token: string } & Environment>,
) {
    const { token, os, browser, environment } = ctx.data;
    assert(token, 'token不能为空');

    let payload = null;
    try {
        payload = jwt.decode(token, config.jwtSecret);
    } catch (err) {
        return '非法token';
    }

    assert(Date.now() < payload.expires, 'token已过期');
    assert.equal(environment, payload.environment, '非法登录');

    const user = await User.findOne(
        { _id: payload.user },
        {
            _id: 1,
            avatar: 1,
            username: 1,
            tag: 1,
            tagStyle: 1,
            expressions: 1,
            createTime: 1,
            isAdmin: 1,
        },
    );
    if (!user) {
        throw new AssertionError({ message: '用户不存在' });
    }

    await handleNewUser(user);

    user.lastLoginTime = new Date();
    user.lastLoginIp = ctx.socket.ip;
    await user.save();

    const groups = await Group.find(
        { members: user._id },
        {
            _id: 1,
            name: 1,
            avatar: 1,
            creator: 1,
            createTime: 1,
        },
    );
    groups.forEach((group: GroupDocument) => {
        ctx.socket.join(group._id.toString());
    });

    const friends = await Friend.find({ from: user._id }).populate('to', {
        avatar: 1,
        username: 1,
    });

    ctx.socket.user = user._id.toString();
    await Socket.updateOne(
        { id: ctx.socket.id },
        {
            user: user._id,
            os,
            browser,
            environment,
        },
    );

    const notificationTokens = await getUserNotificationTokens(user);
    const isAdmin =
        user.isAdmin || config.administrator.includes(user._id.toString());
    ctx.socket.isAdmin = isAdmin;

    return {
        _id: user._id,
        avatar: user.avatar,
        username: user.username,
        tag: user.tag,
        tagStyle: user.tagStyle || defaultTagStyle,
        expressions: user.expressions || [],
        groups,
        friends,
        isAdmin,
        notificationTokens,
    };
}

/**
 * 游客登录, 只能获取默认群组信息
 * @param ctx Context
 */
export async function guest(ctx: Context<Environment>) {
    const { os, browser, environment } = ctx.data;

    await Socket.updateOne(
        { id: ctx.socket.id },
        {
            os,
            browser,
            environment,
        },
    );

    const group = await Group.findOne(
        { isDefault: true },
        {
            _id: 1,
            name: 1,
            avatar: 1,
            createTime: 1,
            creator: 1,
        },
    );
    if (!group) {
        throw new AssertionError({ message: '默认群组不存在' });
    }
    ctx.socket.join(group._id.toString());

    const messages = await Message.find(
        { to: group._id },
        {
            type: 1,
            content: 1,
            from: 1,
            createTime: 1,
            deleted: 1,
        },
        { sort: { createTime: -1 }, limit: 15 },
    ).populate('from', { username: 1, avatar: 1 });
    await handleInviteV2Messages(messages);
    messages.reverse();

    return { messages, ...group.toObject() };
}

/**
 * 修改用户头像
 * @param ctx Context
 */
export async function changeAvatar(ctx: Context<{ avatar: string }>) {
    const { avatar } = ctx.data;
    assert(avatar, '新头像链接不能为空');

    await User.updateOne(
        { _id: ctx.socket.user },
        {
            avatar,
        },
    );

    return {};
}

/**
 * 添加好友, 单向添加
 * @param ctx Context
 */
export async function addFriend(ctx: Context<{ userId: string }>) {
    const { userId } = ctx.data;
    assert(isValid(userId), '无效的用户ID');
    assert(ctx.socket.user !== userId, '不能添加自己为好友');

    const user = await User.findOne({ _id: userId });
    if (!user) {
        throw new AssertionError({ message: '添加好友失败, 用户不存在' });
    }

    const friend = await Friend.find({ from: ctx.socket.user, to: user._id });
    assert(friend.length === 0, '你们已经是好友了');

    const newFriend = await Friend.create({
        from: ctx.socket.user as string,
        to: user._id,
    } as FriendDocument);

    return {
        _id: user._id,
        username: user.username,
        avatar: user.avatar,
        from: newFriend.from,
        to: newFriend.to,
    };
}

/**
 * 删除好友, 单向删除
 * @param ctx Context
 */
export async function deleteFriend(ctx: Context<{ userId: string }>) {
    const { userId } = ctx.data;
    assert(isValid(userId), '无效的用户ID');

    const user = await User.findOne({ _id: userId });
    if (!user) {
        throw new AssertionError({ message: '用户不存在' });
    }

    await Friend.deleteOne({ from: ctx.socket.user, to: user._id });
    return {};
}

/**
 * 修改用户密码
 * @param ctx Context
 */
export async function changePassword(
    ctx: Context<{ oldPassword: string; newPassword: string }>,
) {
    const { oldPassword, newPassword } = ctx.data;
    assert(newPassword, '新密码不能为空');
    assert(oldPassword !== newPassword, '新密码不能与旧密码相同');

    const user = await User.findOne({ _id: ctx.socket.user });
    if (!user) {
        throw new AssertionError({ message: '用户不存在' });
    }
    const isPasswordCorrect = bcrypt.compareSync(oldPassword, user.password);
    assert(isPasswordCorrect, '旧密码不正确');

    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(newPassword, salt);

    user.password = hash;
    await user.save();

    return {
        msg: 'ok',
    };
}

/**
 * 修改用户名
 * @param ctx Context
 */
export async function changeUsername(ctx: Context<{ username: string }>) {
    const { username } = ctx.data;
    assert(username, '新用户名不能为空');

    const user = await User.findOne({ username });
    assert(!user, '该用户名已存在, 换一个试试吧');

    const self = await User.findOne({ _id: ctx.socket.user });
    if (!self) {
        throw new AssertionError({ message: '用户不存在' });
    }

    self.username = username;
    await self.save();

    return {
        msg: 'ok',
    };
}

/**
 * 重置用户密码, 需要管理员权限
 * @param ctx Context
 */
export async function resetUserPassword(ctx: Context<{ username: string }>) {
    const { username } = ctx.data;
    assert(username !== '', 'username不能为空');

    const user = await User.findOne({ username });
    if (!user) {
        throw new AssertionError({ message: '用户不存在' });
    }

    const newPassword = 'helloworld';
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(newPassword, salt);

    user.salt = salt;
    user.password = hash;
    await user.save();

    return {
        newPassword,
    };
}

/**
 * 更新用户标签, 需要管理员权限
 * @param ctx Context
 */
export async function setUserTag(
    ctx: Context<{ username: string; tag: string; tagStyle?: TagStyle }>,
) {
    const { username, tag, tagStyle } = ctx.data;
    assert(username !== '', 'username不能为空');
    assert(tag !== '', 'tag不能为空');
    assert(
        /^([0-9a-zA-Z]{1,2}|[\u4e00-\u9eff]){1,5}$/.test(tag),
        '标签不符合要求, 允许5个汉字或者10个字母',
    );

    const user = await User.findOne({ username });
    if (!user) {
        throw new AssertionError({ message: '用户不存在' });
    }

    user.tag = tag;
    if (tagStyle) {
        user.tagStyle = normalizeTagStyle(tagStyle);
    }
    await user.save();

    const sockets = await Socket.find({ user: user._id });
    const socketIdList = sockets.map((socket) => socket.id);
    if (socketIdList.length) {
        ctx.socket.emit(socketIdList, 'changeTag', user.tag);
        ctx.socket.emit(
            socketIdList,
            'changeTagStyle',
            user.tagStyle || defaultTagStyle,
        );
    }

    return {
        msg: 'ok',
    };
}

/**
 * 收藏自己已经发送成功的图片消息, 后续可直接作为表情再次发送
 */
export async function addExpression(
    ctx: Context<{ messageId: string }>,
) {
    const { messageId } = ctx.data;
    assert(messageId && isValid(messageId), '无效的消息ID');

    const message = await Message.findOne({
        _id: messageId,
        from: ctx.socket.user,
        type: 'image',
        deleted: { $ne: true },
    });
    assert(message, '只能收藏自己已经发送的图片消息');

    const user = await User.findOne({ _id: ctx.socket.user });
    assert(user, '用户不存在');
    const expressions = user.expressions || [];
    if (!expressions.includes(message.content)) {
        expressions.unshift(message.content);
        user.expressions = expressions.slice(0, 100);
        await user.save();
    }
    return user.expressions;
}

/** 删除收藏的图片表情 */
export async function removeExpression(
    ctx: Context<{ expression: string }>,
) {
    const { expression } = ctx.data;
    assert(expression, '表情地址不能为空');

    const user = await User.findOne({ _id: ctx.socket.user });
    assert(user, '用户不存在');
    user.expressions = (user.expressions || []).filter(
        (item) => item !== expression,
    );
    await user.save();
    return user.expressions;
}

/**
 * 获取指定在线用户 ip
 */
export async function getUserIps(
    ctx: Context<{ userId: string }>,
): Promise<string[]> {
    const { userId } = ctx.data;
    assert(userId, 'userId不能为空');
    assert(isValid(userId), '不合法的userId');

    const sockets = await Socket.find({ user: userId });
    const ipList = sockets.map((socket) => socket.ip) || [];
    return Array.from(new Set(ipList));
}

const UserOnlineStatusCacheExpireTime = 1000 * 10;
const userOnlineStatusCache: Record<
    string,
    {
        value: boolean;
        expireTime: number;
    }
> = {};

export function _invalidateUserOnlineStatusCache(userId?: string) {
    if (userId) {
        delete userOnlineStatusCache[userId];
        return;
    }
    Object.keys(userOnlineStatusCache).forEach(
        (cachedUserId) => delete userOnlineStatusCache[cachedUserId],
    );
}

export async function getUserOnlineStatus(
    ctx: Context<{ userId: string }>,
) {
    const { userId } = ctx.data;
    assert(userId, 'userId不能为空');
    assert(isValid(userId), '不合法的userId');

    const cachedStatus = userOnlineStatusCache[userId];
    if (cachedStatus && cachedStatus.expireTime > Date.now()) {
        return {
            isOnline: cachedStatus.value,
        };
    }

    const isOnline = !!(await Socket.findOne({ user: userId }, { _id: 1 }).lean());
    userOnlineStatusCache[userId] = {
        value: isOnline,
        expireTime: Date.now() + UserOnlineStatusCacheExpireTime,
    };
    return {
        isOnline,
    };
}
