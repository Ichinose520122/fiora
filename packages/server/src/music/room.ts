import assert from 'assert';
import { randomBytes } from 'crypto';
import { MusicRoomState, MusicTrack, musicPosition } from '@fiora/utils/music';

export function newRoom(roomId: string): MusicRoomState {
    return { roomId, revision: 0, current: null, queue: [], idlePlaylist: [],
        paused: false, position: 0, startedAt: Date.now(), votes: [], notice: '' };
}
export function queuedTrack(track: MusicTrack, userId: string): MusicTrack {
    return { ...track, entryId: randomBytes(12).toString('hex'), requestedBy: userId, idle: false };
}
export function enqueue(room: MusicRoomState, tracks: MusicTrack[], userId: string) {
    assert(tracks.length > 0 && tracks.length <= 50, '每次最多添加 50 首歌曲');
    assert(room.queue.length + tracks.length <= 100, '房间队列最多 100 首');
    const own = room.queue.filter((track) => track.requestedBy === userId).length;
    assert(own + tracks.length <= 50, '每人最多排队 50 首');
    room.queue.push(...tracks.map((track) => queuedTrack(track, userId)));
}
export function setPaused(room: MusicRoomState, paused: boolean, now = Date.now()) {
    room.position = musicPosition(room, now);
    room.startedAt = now;
    room.paused = paused;
}
export function voteNext(room: MusicRoomState, userId: string, listeners: string[]) {
    assert(room.current, '当前没有歌曲');
    assert(listeners.includes(userId), '加入一起听后才能投票');
    if (!room.votes.includes(userId)) room.votes.push(userId);
    room.votes = room.votes.filter((id) => listeners.includes(id));
    return room.votes.length >= Math.max(1, Math.ceil(listeners.length / 2));
}
// All room mutations (including asynchronous URL resolution) use this lock.
export class RoomSerial {
    private pending = new Map<string, Promise<any>>();
    run<T>(id: string, fn: () => Promise<T>): Promise<T> {
        const previous = this.pending.get(id) || Promise.resolve();
        const task = previous.catch(() => undefined).then(fn);
        this.pending.set(id, task);
        const clear = () => { if (this.pending.get(id) === task) this.pending.delete(id); };
        task.then(clear, clear);
        return task;
    }
}

