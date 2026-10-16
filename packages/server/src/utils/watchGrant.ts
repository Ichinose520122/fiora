import { createHmac, timingSafeEqual } from 'crypto';
import assert from 'assert';
import config from '@fiora/config/server';

const encode = (value: Buffer) => value.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
export function issueWatchChatGrant(user: string, room: string, tokenVersion: number, now = Date.now()) {
    const body = encode(Buffer.from(JSON.stringify({ purpose: 'watch-chat', sub: user, room, tokenVersion,
        iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 180 * 60 })));
    return `${body}.${encode(createHmac('sha256', config.watch.secret).update(body).digest())}`;
}
export function verifyWatchChatGrant(token: string, now = Date.now()) {
    assert(config.watch.secret.length >= 32 && typeof token === 'string' && token.length <= 4096, '影院授权无效');
    const [body, signature, extra] = token.split('.');
    const actual = Buffer.from(signature || '', 'base64');
    const expected = createHmac('sha256', config.watch.secret).update(body || '').digest();
    assert(!extra && actual.length === expected.length && timingSafeEqual(actual, expected), '影院授权无效');
    const grant = JSON.parse(Buffer.from(body, 'base64').toString());
    const seconds = Math.floor(now / 1000);
    assert(grant && grant.purpose === 'watch-chat' && /^[a-f0-9]{24}$/.test(grant.sub) &&
        /^(?:[a-f0-9]{24}|[a-f0-9]{48})$/.test(grant.room) &&
        Number.isInteger(grant.tokenVersion) && grant.tokenVersion >= 0 &&
        Number.isInteger(grant.iat) && Number.isInteger(grant.exp) && grant.iat <= seconds + 10 &&
        grant.exp > seconds && grant.exp > grant.iat && grant.exp - grant.iat <= 180 * 60, '影院授权已过期');
    return grant as { sub: string; room: string; tokenVersion: number; exp: number };
}
