export type MusicProvider = 'local' | 'netease' | 'qq';
export interface MusicTrack {
    id: string;
    provider: MusicProvider;
    title: string;
    artist: string;
    duration: number; // seconds
    cover?: string;
    lyrics?: string;
    url?: string;
    entryId?: string;
    requestedBy?: string;
    idle?: boolean;
}
export interface MusicRoomState {
    roomId: string;
    revision: number;
    current: MusicTrack | null;
    queue: MusicTrack[];
    idlePlaylist: MusicTrack[];
    paused: boolean;
    position: number;
    startedAt: number;
    votes: string[];
    notice: string;
}
export interface MusicSnapshot extends MusicRoomState {
    serverTime: number;
    listeners: number;
    votesNeeded: number;
    canControl: boolean;
}
export function musicPosition(room: MusicRoomState, now = Date.now()) {
    return Math.min(room.current ? room.current.duration : 0,
        Math.max(0, room.position + (room.paused ? 0 : (now - room.startedAt) / 1000)));
}
export function parseLyrics(text = '') {
    const lines: { time: number; text: string }[] = [];
    let offset = 0;
    const match = /\[offset:([+-]?\d+)\]/i.exec(text);
    if (match) offset = Number(match[1]) / 1000;
    text.split(/\r?\n/).forEach((line) => {
        const content = line.replace(/\[[^\]]*\]/g, '').trim();
        const regex = /\[(\d+):(\d+(?:\.\d+)?)\]/g;
        let stamp;
        while ((stamp = regex.exec(line))) {
            lines.push({ time: Number(stamp[1]) * 60 + Number(stamp[2]) + offset, text: content });
        }
    });
    return lines.sort((a, b) => a.time - b.time);
}

