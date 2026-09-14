import assert from 'assert';
import { randomBytes } from 'crypto';
import {
    MusicRoomState,
    MusicTrack,
    musicPosition,
} from '@fiora/utils/music';

export function newRoom(roomId: string): MusicRoomState {
    return {
        roomId,
        revision: 0,
        current: null,
        queue: [],
        idlePlaylist: [],
        idleMode: 'sequential',
        idleCursor: 0,
        savedPlaylists: [],
        paused: false,
        position: 0,
        startedAt: Date.now(),
        votes: [],
        notice: '',
    };
}

// Keep the imported order intact so switching back to sequential is predictable.
export function idleTrackOrder(room: MusicRoomState, random = Math.random) {
    const length = room.idlePlaylist.length;
    const order = Array.from({ length }, (_, i) => (room.idleCursor + i) % length);
    if (room.idleMode === 'random') {
        for (let i = order.length - 1; i > 0; i -= 1) {
            const j = Math.floor(random() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
        }
        const first = room.idlePlaylist[order[0]];
        if (order.length > 1 && first?.id === room.current?.id &&
            first?.provider === room.current?.provider) {
            order.push(order.shift()!);
        }
    }
    return order;
}

export function queuedTrack(
    track: MusicTrack,
    userId: string,
): MusicTrack {
    return {
        ...track,
        entryId: randomBytes(12).toString('hex'),
        requestedBy: userId,
        idle: false,
    };
}

export function enqueue(
    room: MusicRoomState,
    tracks: MusicTrack[],
    userId: string,
) {
    assert(tracks.length > 0, '没有可加入的歌曲');
    room.queue.push(
        ...tracks.map((track) => queuedTrack(track, userId)),
    );
}

export function setPaused(
    room: MusicRoomState,
    paused: boolean,
    now = Date.now(),
) {
    room.position = musicPosition(room, now);
    room.startedAt = now;
    room.paused = paused;
}

export function voteNext(
    room: MusicRoomState,
    userId: string,
    listeners: string[],
) {
    assert(room.current, '当前没有歌曲');
    assert(listeners.includes(userId), '加入一起听后才能投票');
    if (!room.votes.includes(userId)) room.votes.push(userId);
    room.votes = room.votes.filter((id) =>
        listeners.includes(id),
    );
    return (
        room.votes.length >=
        Math.max(1, Math.ceil(listeners.length / 2))
    );
}

// All room mutations (including asynchronous URL resolution) use this lock.
export class RoomSerial {
    private pending = new Map<string, Promise<any>>();

    run<T>(id: string, fn: () => Promise<T>): Promise<T> {
        const previous =
            this.pending.get(id) || Promise.resolve();
        const task = previous.catch(() => undefined).then(fn);
        this.pending.set(id, task);

        const clear = () => {
            if (this.pending.get(id) === task) {
                this.pending.delete(id);
            }
        };

        task.then(clear, clear);
        return task;
    }
}
