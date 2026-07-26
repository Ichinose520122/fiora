import { Socket } from 'socket.io';
import { getSocketIp, normalizeIp } from '../socket';

function createSocket(
    headers: Record<string, string | string[]> = {},
    address = '::ffff:10.0.0.2',
) {
    return ({
        handshake: {
            address,
            headers,
        },
        request: {
            connection: {
                remoteAddress: address,
            },
        },
    } as unknown) as Socket;
}

describe('utils/socket.ts', () => {
    it('normalizes IPv4-mapped IPv6 and loopback addresses', () => {
        expect(normalizeIp('::ffff:192.0.2.1')).toBe('192.0.2.1');
        expect(normalizeIp('::1')).toBe('127.0.0.1');
    });

    it('ignores forwarded headers unless they are explicitly trusted', () => {
        const socket = createSocket({
            'x-real-ip': '198.51.100.10',
        });
        expect(getSocketIp(socket)).toBe('10.0.0.2');
    });

    it('uses the first forwarded address from a trusted proxy', () => {
        const socket = createSocket({
            'x-forwarded-for': '198.51.100.10, 10.0.0.3',
        });
        expect(getSocketIp(socket, true)).toBe('198.51.100.10');
    });

    it('prefers the proxy-managed forwarded chain over optional vendor headers', () => {
        const socket = createSocket({
            'x-forwarded-for': '198.51.100.10, 10.0.0.3',
            'cf-connecting-ip': '203.0.113.99',
        });
        expect(getSocketIp(socket, true)).toBe('198.51.100.10');
    });

    it('falls back to the socket address for invalid forwarded values', () => {
        const socket = createSocket({
            'x-real-ip': 'not-an-ip',
        });
        expect(getSocketIp(socket, true)).toBe('10.0.0.2');
    });
});
