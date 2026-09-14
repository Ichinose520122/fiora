const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function createMusicAuth({ api, token, accountFile, legacyCookieFile }) {
    let pending = Promise.resolve();
    const sent = new Map();
    const serial = (fn) => {
        const task = pending.catch(() => {}).then(fn);
        pending = task;
        return task;
    };
    async function readAccount() {
        try {
            return JSON.parse(await fs.promises.readFile(accountFile, 'utf8'));
        } catch (accountError) {
            if (accountError.code !== 'ENOENT') throw accountError;
            let cookie = '';
            try {
                cookie = (await fs.promises.readFile(legacyCookieFile, 'utf8')).trim();
            } catch (legacyError) {
                if (legacyError.code !== 'ENOENT') throw legacyError;
            }
            return { cookie, nickname: '' };
        }
    }
    async function save(account) {
        await fs.promises.mkdir(path.dirname(accountFile), {
            recursive: true,
            mode: 0o700,
        });
        const temporary = `${accountFile}.${crypto
            .randomBytes(8)
            .toString('hex')}.tmp`;
        try {
            await fs.promises.writeFile(temporary, JSON.stringify(account), {
                mode: 0o600,
                flag: 'wx',
            });
            await fs.promises.rename(temporary, accountFile);
        } finally {
            await fs.promises.unlink(temporary).catch(() => {});
        }
    }
    const result = (res, data, status = 200) => {
        res.writeHead(status, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
        });
        res.end(JSON.stringify(data));
    };
    function authorized(req) {
        const received = req.headers['x-music-auth'];
        return (
            typeof token === 'string' &&
            token.length >= 32 &&
            typeof received === 'string' &&
            Buffer.byteLength(received) === Buffer.byteLength(token) &&
            crypto.timingSafeEqual(Buffer.from(received), Buffer.from(token))
        );
    }
    function hasSessionCookie(cookie) {
        return typeof cookie === 'string' && /(?:^|;\s*)MUSIC_U=/.test(cookie);
    }
    function normalizeSessionCookie(value) {
        if (
            typeof value !== 'string' ||
            value.length > 4096 ||
            /[\r\n]/.test(value)
        ) {
            throw new Error('invalid_cookie');
        }
        const source = value.trim();
        const match = /(?:^|;\s*)MUSIC_U=([^;\s]+)/.exec(source);
        let sessionToken = '';
        if (match) {
            [, sessionToken] = match;
        }
        else if (/^[^=;\s]+$/.test(source)) sessionToken = source;
        if (sessionToken.length < 20 || sessionToken.length > 2048) {
            throw new Error('invalid_cookie');
        }
        return `MUSIC_U=${sessionToken}`;
    }
    async function body(req) {
        let value = '';
        // The request object is an async iterator in Node's HTTP server.
        // eslint-disable-next-line no-restricted-syntax
        for await (const chunk of req) {
            value += chunk;
            if (Buffer.byteLength(value) > 8192) throw new Error('invalid_body');
        }
        const data = JSON.parse(value || '{}');
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('invalid_body');
        }
        return data;
    }
    function validate(data) {
        if (
            typeof data.phone !== 'string' ||
            !/^\d{5,15}$/.test(data.phone) ||
            typeof data.countryCode !== 'string' ||
            !/^\d{1,4}$/.test(data.countryCode)
        ) {
            throw new Error('invalid_body');
        }
    }
    function failure(error, fallback) {
        const code = error?.body?.code || error?.code;
        if ([405, 415, 460, 8821].includes(Number(code))) return 'challenge';
        if ([509].includes(Number(code))) return 'rate_limit';
        if ([503].includes(Number(code)) && fallback === 'login_failed') {
            return 'invalid_code';
        }
        return fallback;
    }
    async function handle(req, res, url) {
        if (!url.pathname.startsWith('/auth/')) return false;
        if (!authorized(req)) {
            result(res, { ok: false }, 403);
            return true;
        }
        if (req.method !== 'POST') {
            result(res, { ok: false }, 405);
            return true;
        }
        try {
            const data = await body(req);
            if (url.pathname === '/auth/status') {
                const account = await readAccount();
                if (!hasSessionCookie(account.cookie)) {
                    result(res, { ok: true, loggedIn: false });
                } else {
                    try {
                        const status = await api.login_status({ cookie: account.cookie });
                        const profile = status.body?.data?.profile;
                        if (profile) {
                            const nickname = String(
                                profile.nickname || account.nickname || '',
                            ).slice(0, 80);
                            if (nickname && nickname !== account.nickname) {
                                await save({ ...account, nickname }).catch(() => {});
                            }
                            result(res, { ok: true, loggedIn: true, nickname });
                        } else {
                            result(res, {
                                ok: true,
                                loggedIn: true,
                                unverified: true,
                                nickname: String(account.nickname || '').slice(0, 80),
                            });
                        }
                    } catch (_) {
                        result(res, {
                            ok: true,
                            loggedIn: true,
                            unverified: true,
                            nickname: String(account.nickname || '').slice(0, 80),
                        });
                    }
                }
            } else if (url.pathname === '/auth/send-code') {
                validate(data);
                const key = `${data.countryCode}:${data.phone}`;
                const now = Date.now();
                sent.forEach((until, id) => {
                    if (until <= now) sent.delete(id);
                });
                if (sent.has(key)) {
                    result(res, { ok: false, error: 'rate_limit' });
                    return true;
                }
                sent.set(key, now + 60000);
                try {
                    const response = await api.captcha_sent({
                        phone: data.phone,
                        ctcode: data.countryCode,
                        platform: 'mobile',
                    });
                    if (response.body?.code !== 200) throw response;
                    result(res, { ok: true });
                } catch (error) {
                    const reason = failure(error, 'send_failed');
                    if (reason !== 'rate_limit') {
                        sent.delete(key);
                    }
                    result(res, {
                        ok: false,
                        error: reason,
                    });
                }
            } else if (url.pathname === '/auth/login') {
                validate(data);
                if (
                    typeof data.captcha !== 'string' ||
                    !/^\d{4,8}$/.test(data.captcha)
                ) {
                    throw new Error('invalid_body');
                }
                await serial(async () => {
                    let account;
                    try {
                        const response = await api.login_cellphone({
                            phone: data.phone,
                            countrycode: data.countryCode,
                            captcha: data.captcha,
                            platform: 'mobile',
                        });
                        const payload = response.body;
                        if (
                            payload?.code !== 200 ||
                            !hasSessionCookie(payload.cookie)
                        ) {
                            throw response;
                        }
                        account = {
                            cookie: payload.cookie,
                            nickname: String(
                                payload.profile?.nickname ||
                                    payload.account?.userName ||
                                    payload.account?.nickname ||
                                    '',
                            ).slice(0, 80),
                        };
                    } catch (error) {
                        result(res, {
                            ok: false,
                            error: failure(error, 'login_failed'),
                        });
                        return;
                    }
                    try {
                        await save(account);
                    } catch (_) {
                        result(res, { ok: false, error: 'storage_failed' });
                        return;
                    }
                    result(res, {
                        ok: true,
                        nickname: account.nickname,
                        unverified: !account.nickname,
                    });
                });
            } else if (url.pathname === '/auth/cookie') {
                await serial(async () => {
                    let account;
                    try {
                        const cookie = normalizeSessionCookie(data.cookie);
                        const status = await api.login_status({ cookie });
                        const profile = status.body?.data?.profile;
                        if (!profile) {
                            result(res, { ok: false, error: 'invalid_cookie' });
                            return;
                        }
                        account = {
                            cookie,
                            nickname: String(profile.nickname || '').slice(0, 80),
                        };
                    } catch (_) {
                        result(res, { ok: false, error: 'invalid_cookie' });
                        return;
                    }
                    try {
                        await save(account);
                    } catch (_) {
                        result(res, { ok: false, error: 'storage_failed' });
                        return;
                    }
                    result(res, {
                        ok: true,
                        nickname: account.nickname,
                    });
                });
            } else if (url.pathname === '/auth/logout') {
                await serial(() => save({ cookie: '', nickname: '' }));
                result(res, { ok: true });
            } else {
                result(res, { ok: false }, 404);
            }
        } catch (_) {
            result(res, { ok: false, error: 'unavailable' });
        }
        return true;
    }
    return {
        handle,
        readCookie: async () => (await readAccount()).cookie || '',
    };
}

module.exports = { createMusicAuth };
