import assert from 'assert';
import { Server, Socket } from 'socket.io';
import MusicRoom from '@fiora/database/mongoose/models/musicRoom';
import { MusicRoomState, MusicSnapshot } from '@fiora/utils/music';
import getLinkmanAccess from '../utils/linkmanAccess';
import { newRoom, RoomSerial } from './room';
import { resolveTrack } from './providers';

export const roomSerial = new RoomSerial();
const rooms = new Map<string, MusicRoomState>();
const touched = new Map<string, number>();
const ticking = new Set<string>();
const subscribers = new Map<string, { socket: Socket; roomId: string; userId: string; listening: boolean }>();
export async function loadRoom(id: string) {
    if (!rooms.has(id)) {
        const saved = await MusicRoom.findById(id).lean();
        const state = saved?.state as MusicRoomState | undefined;
        const room = state || newRoom(id);
        // Resume explicitly after server restart; never silently skip the saved queue.
        if (room.current) {
            room.position = Math.min(room.current.duration, room.position);
            room.paused = true;
            room.notice = '服务已重启，点击继续播放';
        }
        rooms.set(id, room);
    }
    touched.set(id, Date.now());
    // Mutate a draft; failed validation or persistence must not change the live queue.
    return JSON.parse(JSON.stringify(rooms.get(id)!)) as MusicRoomState;
}
export function listenerIds(id: string) {
    return Array.from(new Set(Array.from(subscribers.values())
        .filter((sub) => sub.roomId === id && sub.listening && sub.socket.connected)
        .map((sub) => sub.userId)));
}
export function snapshot(room: MusicRoomState, canControl: boolean): MusicSnapshot {
    const listeners = listenerIds(room.roomId).length;
    return { ...room, serverTime: Date.now(), listeners,
        votesNeeded: Math.max(1, Math.ceil(listeners / 2)), canControl };
}
export async function nextTrack(room: MusicRoomState) {
    const fromQueue = room.queue.length > 0;
    // Bound API attempts so a bad idle playlist cannot loop forever.
    let attempts = Math.min(5, fromQueue ? room.queue.length : room.idlePlaylist.length);
    room.current = null;
    room.position = 0;
    room.votes = [];
    room.paused = false;
    while (attempts-- > 0) {
        let candidate = room.queue.shift();
        if (!candidate && room.idlePlaylist.length) {
            candidate = { ...room.idlePlaylist.shift()!, idle: true, entryId: Date.now() + '-' + attempts };
            room.idlePlaylist.push(candidate);
        }
        if (!candidate) break;
        try {
            room.current = await resolveTrack(candidate);
            room.startedAt = Date.now();
            return;
        } catch (_) { room.notice = '部分歌曲无法完整播放，已跳过；可在曲库中重新点歌'; }
    }
}
export async function publish(room: MusicRoomState) {
    room.revision += 1;
    await MusicRoom.updateOne({ _id: room.roomId },
        { $set: { state: room, updatedAt: new Date() } }, { upsert: true });
    rooms.set(room.roomId, JSON.parse(JSON.stringify(room)));
    // Recheck membership before exposing a private room snapshot, including after kicks.
    await Promise.all(Array.from(subscribers.entries()).filter(([, sub]) => sub.roomId === room.roomId)
        .map(async ([id, sub]) => {
            try {
                assert(sub.socket.data.user === sub.userId);
                const access = await getLinkmanAccess(sub.userId, room.roomId);
                sub.socket.emit('musicState', snapshot(room,
                    !access.group || access.group.creator?.toString() === sub.userId || !!sub.socket.data.isAdmin));
            } catch (_) {
                sub.socket.emit('musicAccessLost', { roomId: room.roomId });
                subscribers.delete(id);
            }
        }));
}
export function subscribe(socketId: string, roomId: string, userId: string, listening: boolean) {
    const socket = musicIo?.sockets.sockets.get(socketId);
    assert(socket && socket.data.user === userId, '连接已失效');
    const existing = subscribers.get(socketId);
    subscribers.set(socketId, { socket: socket!, roomId, userId, listening });
    return existing?.roomId;
}
export function unsubscribe(socketId: string) {
    const previous = subscribers.get(socketId);
    subscribers.delete(socketId);
    return previous?.roomId;
}
let musicIo: Server | undefined;
export function installMusic(io: Server) {
    musicIo = io;
    io.on('connection', (socket) => {
        socket.on('disconnect', () => { unsubscribe(socket.id); });
    });
    const timer = setInterval(() => {
        rooms.forEach((room, id) => {
            const ended = room.current && !room.paused &&
                room.position + (Date.now() - room.startedAt) / 1000 >= room.current.duration;
            const pendingQueue = !room.current && room.queue.length > 0;
            if ((ended || pendingQueue) && !ticking.has(id)) {
                ticking.add(id);
                roomSerial.run(id, async () => {
                    const room = await loadRoom(id);
                    // Recheck under lock: multiple scheduled ticks must not skip two songs.
                    if ((!room.current && room.queue.length > 0) || (room.current && !room.paused &&
                        room.position + (Date.now() - room.startedAt) / 1000 >= room.current.duration)) {
                        await nextTrack(room);
                        await publish(room);
                    }
                }).catch(() => undefined).finally(() => ticking.delete(id));
            }
            if (!room.current && Date.now() - (touched.get(id) || 0) > 300000 &&
                !Array.from(subscribers.values()).some((sub) => sub.roomId === id)) {
                rooms.delete(id);
                touched.delete(id);
            }
        });
    }, 1000);
    timer.unref();
}
