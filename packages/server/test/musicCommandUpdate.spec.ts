import assert from 'assert';
import axios from 'axios';
import { executeMusicCommand } from '../src/music/commands';
import { musicSearch } from '../src/routes/music';
import {
    musicLogin,
    musicLoginWithCookie,
    musicSendCode,
} from '../src/routes/musicAccount';

jest.mock('../src/routes/music', () => ({ musicAction: jest.fn(), musicGetState: jest.fn(), musicSearch: jest.fn() }));
jest.mock('axios');

test('commands return readable system replies for invalid arguments and failed searches', async () => {
    const ctx: any = { data: { to: 'room' }, socket: { user: 'user' } };
    expect(await executeMusicCommand(ctx, '/music search')).toContain('缺少');
    (musicSearch as jest.Mock).mockRejectedValue(new assert.AssertionError({ message: '音乐源未配置' }));
    expect(await executeMusicCommand(ctx, '/music local example')).toContain('音乐源未配置');
    expect(await executeMusicCommand(ctx, '/music login private-input')).not.toContain('private-input');
});
test('ordinary chat users cannot send login codes or change the shared music account', async () => {
    const ctx: any = { data: {}, socket: { user: 'user', isAdmin: false } };
    await expect(musicSendCode(ctx)).rejects.toThrow('只有站点管理员');
    await expect(musicLogin(ctx)).rejects.toThrow('只有站点管理员');
    await expect(musicLoginWithCookie(ctx)).rejects.toThrow('只有站点管理员');
});
test('an upstream send failure does not leave the user in a local cooldown', async () => {
    process.env.NeteaseMusicApi = 'http://music-adapter';
    process.env.NeteaseMusicApiToken = 'test-token-that-is-at-least-32-characters';
    const ctx: any = {
        data: { phone: '13800138000', countryCode: '86' },
        socket: { user: 'retry-user', isAdmin: true },
    };
    (axios.post as jest.Mock)
        .mockRejectedValueOnce(new Error('upstream unavailable'))
        .mockResolvedValueOnce({ data: { ok: true } });

    await expect(musicSendCode(ctx)).rejects.toThrow('网易云账号服务暂时不可用');
    await expect(musicSendCode(ctx)).resolves.toEqual({ ok: true, retryAfter: 60 });
});
