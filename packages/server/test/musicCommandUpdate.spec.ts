jest.mock('../src/routes/music', () => ({ musicAction: jest.fn(), musicGetState: jest.fn(), musicSearch: jest.fn() }));
import assert from 'assert';
import { executeMusicCommand } from '../src/music/commands';
import { musicSearch } from '../src/routes/music';
import { musicLogin, musicSendCode } from '../src/routes/musicAccount';

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
});
