import assert from 'assert';
import config from '@fiora/config/server';
import User from '@fiora/database/mongoose/models/user';
import { AdminUsersPage } from '@fiora/utils/adminUsers';

/** Only expose the fields needed by the administrator's account directory. */
export async function getAdminUsers(
    ctx: Context<{ page?: number; keyword?: string }>,
): Promise<AdminUsersPage> {
    assert(ctx.socket.user, '请先登录');
    const actor = await User.findById(ctx.socket.user, { isAdmin: 1 }).lean();
    assert(actor && (actor.isAdmin || config.administrator.includes(String(actor._id))), '你不是管理员');
    const { page = 1, keyword = '' } = ctx.data;
    assert(Number.isSafeInteger(page) && page > 0, '页码格式错误');
    assert(typeof keyword === 'string' && keyword.length <= 64, '搜索内容最多 64 个字符');
    const search = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = search ? { username: { $regex: search, $options: 'i' } } : {};
    const pageSize = 20;
    const total = await User.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, pages);
    const users = await User.find(filter, {
        _id: 1, username: 1, isAdmin: 1, createTime: 1, lastLoginTime: 1, lastLoginIp: 1,
    }).sort({ lastLoginTime: -1, _id: -1 }).skip((currentPage - 1) * pageSize).limit(pageSize).lean();
    const timestamp = (value: unknown) => {
        const date = value ? new Date(value as string) : null;
        return date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
    };
    return {
        total, pages, page: currentPage, pageSize,
        users: users.map((user) => ({
            _id: String(user._id), username: user.username,
            isAdmin: Boolean(user.isAdmin || config.administrator.includes(String(user._id))),
            createTime: timestamp(user.createTime),
            // Old admin-created accounts received a default date without ever logging in.
            lastLoginTime: user.lastLoginIp ? timestamp(user.lastLoginTime) : null,
        })),
    };
}
