import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jwt-simple';
import { Types } from 'mongoose';
import koaStatic from 'koa-static';
import config from '@fiora/config/server';
import User from '@fiora/database/mongoose/models/user';
import Group from '@fiora/database/mongoose/models/group';
import Message from '@fiora/database/mongoose/models/message';
import { sendMessage } from '../src/routes/message';
import { uploadFile } from '../src/routes/system';
import { register, login, loginByToken, changePassword, resetUserPassword } from '../src/routes/user';
import '../src/app';

jest.mock('@fiora/config/server', () => ({
    inviteCode: 'test-invite', jwtSecret: 'regression-test-only',
    tokenExpiresTime: 60000, administrator: [], aliyunOSS: { enable: false },
}));
jest.mock('@fiora/utils/logger', () => ({ error: jest.fn() }));
jest.mock('@fiora/utils/getRandomAvatar', () => () => '/avatar/0.jpg');
jest.mock('@fiora/database/mongoose', () => ({ Types: jest.requireActual('mongoose').Types }));
jest.mock('@fiora/database/mongoose/models/user', () => ({ findOne: jest.fn(), create: jest.fn(), updateOne: jest.fn() }));
jest.mock('@fiora/database/mongoose/models/group', () => ({ findOne: jest.fn(), find: jest.fn() }));
jest.mock('@fiora/database/mongoose/models/friend', () => ({ find: () => ({ populate: async () => [] }) }));
jest.mock('@fiora/database/mongoose/models/socket', () => ({ updateOne: jest.fn() }));
jest.mock('@fiora/database/mongoose/models/notification', () => ({ find: async () => [] }));
jest.mock('@fiora/database/mongoose/models/history', () => ({ createOrUpdateHistory: jest.fn() }));
jest.mock('@fiora/database/redis/initRedis', () => ({
    Redis: { get: async () => null, set: jest.fn(), Day: 86400, Minute: 60 },
    getRegisterAttemptIpKey: () => 'attempt',
    getNewRegisteredUserIpKey: () => 'ip', getNewUserKey: () => 'new',
}));
jest.mock('expo-server-sdk', () => ({}), { virtual: true });
jest.mock('axios', () => ({}), { virtual: true });
jest.mock('ali-oss', () => ({}), { virtual: true });
jest.mock('regex-escape', () => (value: string) => value, { virtual: true });
jest.mock('string-hash', () => () => 0, { virtual: true });
jest.mock('socket.io', () => ({ Server: jest.fn(() => ({ on: jest.fn() })) }), { virtual: true });
jest.mock('koa-static', () => jest.fn(() => async () => {}));

const userId = '111111111111111111111111';
const groupId = '222222222222222222222222';
function context(data: any, user = userId): any {
    return { data, socket: { user, id: 'test', ip: '127.0.0.1', isAdmin: false, join: jest.fn(), emit: jest.fn() } };
}

describe('security regressions', () => {
    let account: any;
    let savedMessages: any[];
    beforeEach(() => {
        account = { _id: userId, username: 'tester', avatar: '', createTime: new Date(0),
            password: bcrypt.hashSync('old-password', 4), tokenVersion: 0,
            save: jest.fn(), toObject() { return this; } };
        (User.findOne as jest.Mock).mockImplementation(async (query, projection) => {
            if (!projection) { return account; }
            // Respect the real token-login projection, including tokenVersion.
            return Object.keys(projection).reduce((result, key) => ({ ...result, [key]: account[key] }), {
                _id: account._id, save: jest.fn(), toObject() { return this; },
            });
        });
        (User.create as jest.Mock).mockImplementation(async (data) => { Object.assign(account, data); return account; });
        (User.updateOne as jest.Mock).mockImplementation(async (query, update) => {
            Object.assign(account, update.$set);
            account.tokenVersion = (account.tokenVersion || 0) + update.$inc.tokenVersion;
        });
        (Group.findOne as jest.Mock).mockResolvedValue({ _id: groupId, members: [new Types.ObjectId(userId)], save: jest.fn() });
        (Group.find as jest.Mock).mockResolvedValue([]);
        savedMessages = [];
        jest.spyOn(Message, 'create').mockImplementation(async (data: any) => {
            const message = new Message(data);
            const error = message.validateSync();
            if (error) { throw error; }
            savedMessages.push(message);
            return message;
        });
    });
    afterEach(() => jest.restoreAllMocks());

    it('sanitizes omitted and explicit text types before persistence and broadcast', async () => {
        for (const type of [undefined, 'text']) {
            const ctx = context({ to: groupId, type, content: '<img src=x onerror="alert(1)">' });
            const result = await sendMessage(ctx);
            expect(result.type).toBe('text');
            expect(result.content).not.toMatch(/onerror/i);
            expect(savedMessages[savedMessages.length - 1].content).toBe(result.content);
            expect(ctx.socket.emit).toHaveBeenCalledWith(groupId, 'message', result);
        }
    });

    it.each(['system', null, 'unknown', {}])('rejects client message type %p', async (type) => {
        await expect(sendMessage(context({ to: groupId, type, content: 'not-json' }))).rejects.toThrow('不支持的消息类型');
        expect(savedMessages).toHaveLength(0);
    });

    it('keeps server-generated roll and rps messages working', async () => {
        for (const content of ['-roll 6', '-rps']) {
            const result = await sendMessage(context({ to: groupId, type: 'text', content }));
            expect(result.type).toBe('system');
            expect(['roll', 'rps']).toContain(JSON.parse(result.content).command);
        }
    });

    it('subscribes a newly registered socket to the default room', async () => {
        (User.findOne as jest.Mock).mockResolvedValueOnce(null);
        const ctx = context({ username: 'tester', password: 'old-password', inviteCode: 'test-invite', environment: 'test' });
        const result: any = await register(ctx);
        expect(result.groups[0]._id).toBe(groupId);
        expect(ctx.socket.join).toHaveBeenCalledWith(groupId);
    });

    it('keeps legacy tokens valid until a password change, then rejects both old token formats', async () => {
        delete account.tokenVersion;
        const legacy = jwt.encode({ user: userId, environment: 'test', expires: Date.now() + 60000 }, config.jwtSecret);
        await expect(loginByToken(context({ token: legacy, environment: 'test' }))).resolves.toMatchObject({ _id: userId });
        const before: any = await login(context({ username: 'tester', password: 'old-password', environment: 'test' }));
        await changePassword(context({ oldPassword: 'old-password', newPassword: 'new-password' }));
        for (const token of [legacy, before.token]) {
            await expect(loginByToken(context({ token, environment: 'test' }))).rejects.toThrow('token已过期');
        }
        const after: any = await login(context({ username: 'tester', password: 'new-password', environment: 'test' }));
        await expect(loginByToken(context({ token: after.token, environment: 'test' }))).resolves.toMatchObject({ _id: userId });
        await resetUserPassword(context({ username: 'tester' }));
        await expect(loginByToken(context({ token: after.token, environment: 'test' }))).rejects.toThrow('token已过期');
        expect(account.tokenVersion).toBe(2);
        expect(bcrypt.compareSync('helloworld', account.password)).toBe(true);
    });

    it('does not invalidate tokens when the old password is incorrect', async () => {
        await expect(changePassword(context({ oldPassword: 'wrong', newPassword: 'new' }))).rejects.toThrow('旧密码不正确');
        expect(account.tokenVersion).toBe(0);
    });

    it('prevents cross-user uploads and atomically refuses an existing filename', async () => {
        const directory = fs.mkdtempSync(path.join(process.cwd(), '.security-test-'));
        const originalWrite = fs.promises.writeFile.bind(fs.promises);
        jest.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
        jest.spyOn(fs.promises, 'writeFile').mockImplementation((file, data, options) =>
            originalWrite(path.join(directory, path.basename(String(file))), data, options));
        const fileName = `Avatar/${userId}_123.png`;
        try {
            await expect(uploadFile(context({ fileName, file: Buffer.from('original') }))).resolves.toMatchObject({ url: `/${fileName}` });
            const crossUser = await uploadFile(context({ fileName, file: Buffer.from('attacker') }, '444444444444444444444444'));
            expect(crossUser).toMatch(/不能上传其他用户的文件/);
            expect(await uploadFile(context({ fileName, file: Buffer.from('replacement') }))).toMatch(/EEXIST/);
            expect(fs.readFileSync(path.join(directory, path.basename(fileName)), 'utf8')).toBe('original');
        } finally {
            fs.readdirSync(directory).forEach((file) => fs.unlinkSync(path.join(directory, file)));
            fs.rmdirSync(directory);
        }
    });

    it('isolates uploaded documents while keeping raster images inline', () => {
        const [publicRoot, options] = (koaStatic as jest.Mock).mock.calls[0];
        for (const file of ['FileMessage/test.html', 'Avatar/test.svg', 'ImageMessage/test.png']) {
            const res = { setHeader: jest.fn() };
            options.setHeaders(res, path.join(publicRoot, file));
            expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
            expect(res.setHeader).toHaveBeenCalledWith('Content-Security-Policy', "sandbox; default-src 'none'");
            if (file.endsWith('.png')) {
                expect(res.setHeader).not.toHaveBeenCalledWith('Content-Disposition', 'attachment');
            } else {
                expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment');
            }
        }
        const res = { setHeader: jest.fn() };
        options.setHeaders(res, path.join(publicRoot, 'index.html'));
        expect(res.setHeader).not.toHaveBeenCalled();
    });
});
