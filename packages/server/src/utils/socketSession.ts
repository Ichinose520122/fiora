import { Socket } from 'socket.io';
import User from '@fiora/database/mongoose/models/user';

export const SESSION_EXPIRED = 'token已过期';

export function expireSocketSession(socket: Socket) {
    const alreadyExpired = socket.data.sessionExpired;
    socket.data.sessionExpired = true;
    delete socket.data.user;
    delete socket.data.tokenVersion;
    socket.data.isAdmin = false;
    // Stop room broadcasts immediately, including messages addressed to the socket ID.
    socket.rooms.forEach((room) => socket.leave(room));
    // Let the password-change acknowledgement flush first. Closing the transport
    // allows existing web/App clients to reconnect and reject their expired token.
    if (!alreadyExpired) setImmediate(() => socket.conn.close());
}

export function expireUserSessions(socket: Socket, userId: string) {
    socket.nsp.sockets.forEach((connected) => {
        if (connected.data.user === userId) expireSocketSession(connected);
    });
}

export async function validateSocketSession(socket: Socket) {
    const { user: userId, tokenVersion } = socket.data;
    if (!userId || socket.data.sessionExpired) {
        if (socket.data.sessionExpired) expireSocketSession(socket);
        return false;
    }
    const user = await User.findById(userId, { tokenVersion: 1 });
    // A concurrent password reset may have cleared the session during the query.
    if (
        socket.data.sessionExpired || socket.data.user !== userId ||
        !user || tokenVersion !== (user.tokenVersion ?? 0)
    ) {
        expireSocketSession(socket);
        return false;
    }
    return true;
}
