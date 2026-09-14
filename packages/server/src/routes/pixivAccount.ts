import assert from 'assert';
import {
    pixivAccountStatus as status, savePixivSession, clearPixivSession,
    getPixivSession, verifyPixivSession,
} from '../utils/pixivAccount';

let nextVerification = 0;
function authorize(ctx: Context<any>) {
    assert(ctx.socket.user, '请先登录聊天室');
    assert(ctx.socket.isAdmin, '只有站点管理员可以管理 Pixiv 账号');
}
function limitVerification() {
    assert(Date.now() >= nextVerification, '验证过于频繁，请 5 秒后再试');
    nextVerification = Date.now() + 5000;
}
export async function pixivAccountStatus(ctx: Context<any>) {
    authorize(ctx);
    return status();
}
export async function pixivAccountLogin(ctx: Context<any>) {
    authorize(ctx);
    limitVerification();
    return savePixivSession(ctx.data?.session);
}
export async function pixivAccountVerify(ctx: Context<any>) {
    authorize(ctx);
    limitVerification();
    const session = await getPixivSession();
    assert(session, '尚未配置 Pixiv 账号');
    await verifyPixivSession(session);
    return { valid: true };
}
export async function pixivAccountLogout(ctx: Context<any>) {
    authorize(ctx);
    return clearPixivSession();
}
