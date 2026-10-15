import { createHmac } from 'crypto';
import config from '@fiora/config/server';
import User from '@fiora/database/mongoose/models/user';
import getLinkmanAccess from '../src/utils/linkmanAccess';
import { _watchInvitation, watchJoin } from '../src/routes/watch';

jest.mock('../src/utils/linkmanAccess', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@fiora/database/mongoose/models/user', () => ({ __esModule: true, default: { findById: jest.fn() } }));
beforeEach(() => {
    config.watch = { url: 'https://watch.example.com', issuer: 'https://chat.example.com', secret: 'test-only-0123456789abcdef0123456789abcdef' };
    (getLinkmanAccess as jest.Mock).mockResolvedValue({ group: null, user: {} });
    (User.findById as jest.Mock).mockReturnValue({ select: () => ({ lean: async () => ({ username: 'Alice', avatar: '/Avatar/a.png' }) }) });
});
test('invitation contains no credentials and accepts optional URL', () => {
    const result = _watchInvitation('/watch https://example.com/video');
    expect(result).toMatchObject({ invite: true, source: 'https://example.com/video' });
    expect(JSON.stringify(result)).not.toContain('ticket');
    expect(() => _watchInvitation('/watch javascript:alert(1)')).toThrow();
    config.watch.url = '';
    expect(() => _watchInvitation('/watch')).toThrow('影院未配置');
});
test('join checks current membership and signs short audience-bound claims', async () => {
    const ctx: any = { socket: { user: 'a'.repeat(24), isAdmin: false }, data: { roomId: 'b'.repeat(24) } };
    const result = await watchJoin(ctx);
    const ticket = new URLSearchParams(new URL(result.url).hash.slice(1)).get('ticket')!;
    const [body, signature] = ticket.split('.');
    const expected = createHmac('sha256', config.watch.secret).update(body).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    expect(signature).toBe(expected);
    const claims = JSON.parse(Buffer.from(body, 'base64').toString());
    expect(claims.exp - claims.iat).toBe(60);
    expect(claims).toMatchObject({ sub: ctx.socket.user, room: ctx.data.roomId, aud: 'https://watch.example.com', admin: false, canControl: true });
    expect(getLinkmanAccess).toHaveBeenCalledWith(ctx.socket.user, ctx.data.roomId);
    (getLinkmanAccess as jest.Mock).mockRejectedValue(new Error('你不在该群组中'));
    await expect(watchJoin(ctx)).rejects.toThrow('你不在该群组中');
});
test('ordinary group member gets view-only grant', async () => {
    (getLinkmanAccess as jest.Mock).mockResolvedValue({ group: { creator: 'c'.repeat(24) } });
    const result = await watchJoin({ socket: { user: 'a'.repeat(24), isAdmin: false }, data: { roomId: 'b'.repeat(24) } } as any);
    const ticket = new URLSearchParams(new URL(result.url).hash.slice(1)).get('ticket')!;
    expect(JSON.parse(Buffer.from(ticket.split('.')[0], 'base64').toString()).canControl).toBe(false);
});
