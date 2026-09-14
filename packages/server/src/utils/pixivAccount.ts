import assert from 'assert';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';

const accountFile = process.env.PixivAccountFile || path.resolve(__dirname, '../../pixiv-auth/account.json');
export const pixivHeaders = { Referer: 'https://www.pixiv.net/', 'User-Agent': 'Mozilla/5.0' };
let changing = false;

export function parsePixivSession(value: unknown): string {
    assert(typeof value === 'string' && value.length <= 1024, '请输入 PHPSESSID 的值');
    const session = (value as string).trim().replace(/^PHPSESSID=/, '');
    assert(/^[1-9]\d{0,15}_[a-zA-Z0-9_-]{16,128}$/.test(session),
        'PHPSESSID 格式错误，请只复制这一项的值，不要粘贴整段 Cookie');
    return session;
}

async function readAccount(): Promise<{ session: string; verifiedAt: number } | null> {
    try {
        const saved = JSON.parse(await fs.promises.readFile(accountFile, 'utf8'));
        return { session: parsePixivSession(saved.session), verifiedAt: Number(saved.verifiedAt) || 0 };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        assert.fail('Pixiv 登录信息读取失败，请管理员检查凭据存储');
    }
}

export async function getPixivSession() {
    return (await readAccount())?.session || '';
}

export async function pixivAccountStatus() {
    const saved = await readAccount();
    // A saved session may expire at Pixiv; only a live check establishes validity.
    return { configured: !!saved, verifiedAt: saved?.verifiedAt || 0 };
}

export async function verifyPixivSession(session: string) {
    try {
        const response = await axios.get('https://www.pixiv.net/ajax/user/extra', {
            headers: { ...pixivHeaders, Cookie: 'PHPSESSID=' + session },
            timeout: 15000, maxRedirects: 0, maxContentLength: 32768,
        });
        assert(response.data?.error === false && response.data.body &&
            Number.isInteger(response.data.body.following), 'Pixiv 登录凭据无效或已失效，请重新从官方网页获取');
    } catch (error) {
        if (error instanceof assert.AssertionError) throw error;
        // Never expose Axios errors, which contain the Cookie request header.
        assert.fail('无法验证 Pixiv 登录，请检查聊天服务器到 Pixiv 的网络或稍后重试');
    }
}

export async function savePixivSession(value: unknown) {
    const session = parsePixivSession(value);
    assert(!changing, 'Pixiv 账号正在更新，请稍候');
    changing = true;
    let temporary = '';
    try {
        await verifyPixivSession(session);
        const verifiedAt = Date.now();
        temporary = accountFile + '.' + randomBytes(12).toString('hex') + '.tmp';
        try {
            await fs.promises.mkdir(path.dirname(accountFile), { recursive: true, mode: 0o700 });
            await fs.promises.writeFile(temporary, JSON.stringify({ session, verifiedAt }), { mode: 0o600, flag: 'wx' });
            await fs.promises.rename(temporary, accountFile);
        } catch (_) {
            assert.fail('Pixiv 登录信息保存失败，请管理员检查凭据目录写入权限');
        }
        return { configured: true, verifiedAt };
    } finally {
        if (temporary) await fs.promises.unlink(temporary).catch(() => undefined);
        changing = false;
    }
}

export async function clearPixivSession() {
    assert(!changing, 'Pixiv 账号正在更新，请稍候');
    changing = true;
    try {
        await fs.promises.unlink(accountFile).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') assert.fail('Pixiv 登录信息移除失败，请检查存储权限');
        });
        return { configured: false, verifiedAt: 0 };
    } finally {
        changing = false;
    }
}
