import assert from 'assert';
import axios from 'axios';

const cooldown = new Map<string, { until: number; count: number; reset: number }>();
function configured() { return !!process.env.NeteaseMusicApi && !!process.env.MusicAuthToken; }
function authorize(ctx: Context<any>) {
    assert(ctx.socket.user, '请先登录聊天室');
    assert(ctx.socket.isAdmin, '只有站点管理员可以管理服务器的网易云账号');
    assert(configured(), '网易云账号登录接口尚未配置');
}
function checkLimit(key: string, interval: number, maximum: number) {
    const now = Date.now();
    cooldown.forEach((value, id) => { if (value.reset <= now) cooldown.delete(id); });
    const item = cooldown.get(key) || { until: 0, count: 0, reset: now + 3600000 };
    assert(now >= item.until, '操作过于频繁，请稍后再试');
    assert(item.count < maximum, '本小时操作次数已达上限，请稍后再试');
    item.until = now + interval; item.count += 1; cooldown.set(key, item);
}
function credentials(ctx: Context<any>) {
    const { phone, countryCode = '86' } = ctx.data || {};
    assert(typeof countryCode === 'string' && /^\d{1,4}$/.test(countryCode), '请输入有效的国家区号');
    assert(typeof phone === 'string' && /^\d{5,15}$/.test(phone), '请输入有效的手机号');
    assert(countryCode !== '86' || /^1\d{10}$/.test(phone), '请输入 11 位中国大陆手机号');
    return { phone, countryCode };
}
async function request(endpoint: string, data = {}) {
    try {
        const response = await axios.post(process.env.NeteaseMusicApi!.replace(/\/$/, '') + '/auth/' + endpoint, data, {
            headers: { 'X-Music-Auth': process.env.MusicAuthToken }, timeout: 15000,
            maxRedirects: 0, maxContentLength: 32768,
        });
        const result = response.data;
        // Only fixed error codes cross the service boundary. Never relay cookies or SDK errors.
        const messages: Record<string, string> = {
            rate_limit: '验证码发送过于频繁，请稍后再试',
            challenge: '网易云要求额外验证，请在官方客户端完成验证后重试',
            invalid_code: '验证码错误或已过期，请重新输入',
            send_failed: '验证码发送失败，请检查手机号或稍后重试',
            login_failed: '网易云登录失败，请确认账号已注册并重试',
            storage_failed: '登录信息保存失败，请联系管理员检查存储',
        };
        assert(result?.ok, messages[result?.error] || '网易云账号服务暂时不可用，请稍后重试');
        return result;
    } catch (error) {
        if (error instanceof assert.AssertionError) throw error;
        throw new assert.AssertionError({ message: '网易云账号服务暂时不可用，请稍后重试' });
    }
}
export async function musicAccountStatus(ctx: Context<any>) {
    assert(ctx.socket.user, '请先登录聊天室');
    if (!ctx.socket.isAdmin || !configured()) return { canManage: !!ctx.socket.isAdmin, configured: configured(), loggedIn: false };
    const result = await request('status');
    return { canManage: true, configured: true, loggedIn: result.loggedIn === true,
        nickname: typeof result.nickname === 'string' ? result.nickname.slice(0, 80) : '', unverified: result.unverified === true };
}
export async function musicSendCode(ctx: Context<any>) {
    authorize(ctx);
    const input = credentials(ctx);
    checkLimit('send:' + ctx.socket.user, 60000, 6);
    await request('send-code', input);
    return { ok: true, retryAfter: 60 };
}
export async function musicLogin(ctx: Context<any>) {
    authorize(ctx);
    const input = credentials(ctx);
    const { captcha } = ctx.data;
    assert(typeof captcha === 'string' && /^\d{4,8}$/.test(captcha), '请输入短信验证码');
    checkLimit('login:' + ctx.socket.user, 2000, 20);
    const result = await request('login', { ...input, captcha });
    return { ok: true, nickname: typeof result.nickname === 'string' ? result.nickname.slice(0, 80) : '' };
}
export async function musicLogout(ctx: Context<any>) {
    authorize(ctx);
    await request('logout');
    return { ok: true };
}
