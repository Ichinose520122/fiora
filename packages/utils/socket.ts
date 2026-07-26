import { Socket } from 'socket.io';
import { isIP } from 'net';

function firstHeaderValue(value: string | string[] | undefined) {
    const rawValue = Array.isArray(value) ? value[0] : value;
    return rawValue ? rawValue.split(',')[0].trim() : '';
}

export function normalizeIp(value: string) {
    let ip = value.trim();
    if (ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4) {
        ip = ip.slice(7);
    }
    if (ip === '::1') {
        return '127.0.0.1';
    }
    return isIP(ip) ? ip : '';
}

export function getSocketIp(socket: Socket, trustProxyHeaders = false) {
    const remoteAddress =
        socket.handshake.address ||
        socket.request?.connection?.remoteAddress ||
        '';

    if (!trustProxyHeaders) {
        return normalizeIp(remoteAddress);
    }

    const headers = socket.handshake.headers;
    const forwardedAddress =
        firstHeaderValue(headers['x-forwarded-for']) ||
        firstHeaderValue(headers['x-real-ip']) ||
        firstHeaderValue(headers['cf-connecting-ip']);

    return normalizeIp(forwardedAddress) || normalizeIp(remoteAddress);
}
