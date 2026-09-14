import fs from 'fs';
import path from 'path';

const { createMusicAuth } = require('../../../deploy/netease-auth.cjs');

const token = 'internal-music-token-that-is-long-enough';

function requestBody(data: object) {
    return {
        method: 'POST',
        headers: { 'x-music-auth': token },
        async *[Symbol.asyncIterator]() {
            yield Buffer.from(JSON.stringify(data));
        },
    };
}

async function call(auth: any, endpoint: string, data: object) {
    let status = 0;
    let body: any;
    const response = {
        writeHead(code: number) { status = code; },
        end(value: string) { body = JSON.parse(value); },
    };
    await auth.handle(
        requestBody(data),
        response,
        new URL(`http://localhost/auth/${endpoint}`),
    );
    return { status, body };
}

describe('netease authentication adapter', () => {
    let directory: string;
    let accountFile: string;
    let api: Record<string, jest.Mock>;
    let auth: any;

    beforeEach(() => {
        directory = path.join(
            process.cwd(),
            `.netease-auth-test-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        );
        accountFile = path.join(directory, 'account.json');
        api = {
            captcha_sent: jest.fn(),
            login_cellphone: jest.fn(),
            login_status: jest.fn(),
        };
        auth = createMusicAuth({
            api,
            token,
            accountFile,
            legacyCookieFile: path.join(directory, 'legacy-cookie.txt'),
        });
    });

    afterEach(() => {
        fs.rmSync(directory, { recursive: true, force: true });
    });

    it('uses the mobile SMS flow and permits a retry after an adapter failure', async () => {
        api.captcha_sent
            .mockRejectedValueOnce({ body: { code: 502 } })
            .mockResolvedValueOnce({ body: { code: 200 } });

        await expect(call(auth, 'send-code', {
            phone: '13800138000', countryCode: '86',
        })).resolves.toMatchObject({ body: { ok: false, error: 'send_failed' } });
        await expect(call(auth, 'send-code', {
            phone: '13800138000', countryCode: '86',
        })).resolves.toMatchObject({ body: { ok: true } });
        expect(api.captcha_sent).toHaveBeenLastCalledWith({
            phone: '13800138000', ctcode: '86', platform: 'mobile',
        });
    });

    it('uses the mobile login flow and persists a successful session', async () => {
        api.login_cellphone.mockResolvedValue({
            body: {
                code: 200,
                cookie: 'MUSIC_U=mobile-session-token-value',
                profile: { nickname: 'tester' },
            },
        });

        await expect(call(auth, 'login', {
            phone: '13800138000', countryCode: '86', captcha: '123456',
        })).resolves.toMatchObject({ body: { ok: true, nickname: 'tester' } });
        expect(api.login_cellphone).toHaveBeenCalledWith({
            phone: '13800138000',
            countrycode: '86',
            captcha: '123456',
            platform: 'mobile',
        });
        expect(JSON.parse(fs.readFileSync(accountFile, 'utf8'))).toEqual({
            cookie: 'MUSIC_U=mobile-session-token-value',
            nickname: 'tester',
        });
    });

    it('does not misreport a gateway failure as an invalid verification code', async () => {
        api.login_cellphone.mockRejectedValue({ body: { code: 502 } });

        await expect(call(auth, 'login', {
            phone: '13800138000', countryCode: '86', captcha: '123456',
        })).resolves.toMatchObject({
            body: { ok: false, error: 'login_failed' },
        });
    });

    it('accepts a verified MUSIC_U fallback and stores only that cookie', async () => {
        api.login_status.mockResolvedValue({
            body: { data: { profile: { nickname: 'cookie-user' } } },
        });
        const musicU = 'cookie-session-token-that-is-long-enough';

        await expect(call(auth, 'cookie', {
            cookie: `other=discarded; MUSIC_U=${musicU}; __csrf=discarded`,
        })).resolves.toMatchObject({
            status: 200,
            body: { ok: true, nickname: 'cookie-user' },
        });
        expect(api.login_status).toHaveBeenCalledWith({
            cookie: `MUSIC_U=${musicU}`,
        });
        expect(JSON.parse(fs.readFileSync(accountFile, 'utf8'))).toEqual({
            cookie: `MUSIC_U=${musicU}`,
            nickname: 'cookie-user',
        });
    });
});
