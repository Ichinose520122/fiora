import { enqueue, newRoom, queuedTrack, RoomSerial, setPaused, voteNext } from '../src/music/room';
import { musicPosition, parseLyrics, MusicTrack } from '@fiora/utils/music';
import { commandSuggestions } from '../../web/src/modules/Music/commands';

const song: MusicTrack = { id: 'one', provider: 'local', title: 'One', artist: 'Test', duration: 120 };
test('group and private room queues never share arrays', () => {
    const group = newRoom('group'); const privateRoom = newRoom('private');
    enqueue(group, [song], 'a'); enqueue(group, [{ ...song, id: 'two' }], 'b');
    expect(group.queue.map((track) => track.id)).toEqual(['one', 'two']);
    expect(privateRoom.queue).toEqual([]);
    expect(group.queue[0].entryId).not.toEqual(group.queue[1].entryId);
});
test('pause/resume computes actual elapsed time and clamps at end', () => {
    const room = newRoom('x'); room.current = song; room.startedAt = 1000;
    expect(musicPosition(room, 6500)).toBe(5.5);
    setPaused(room, true, 6500);
    expect(musicPosition(room, 65000)).toBe(5.5);
    setPaused(room, false, 65000);
    expect(musicPosition(room, 70000)).toBe(10.5);
    expect(musicPosition(room, 999999)).toBe(120);
});
test('votes count distinct participating users, not browser tabs', () => {
    const room = newRoom('x'); room.current = queuedTrack(song, 'a');
    expect(() => voteNext(room, 'outside', ['a', 'b', 'c'])).toThrow();
    expect(voteNext(room, 'a', ['a', 'b', 'c'])).toBe(false);
    expect(voteNext(room, 'a', ['a', 'b', 'c'])).toBe(false);
    expect(room.votes).toEqual(['a']);
    expect(voteNext(room, 'b', ['a', 'b', 'c'])).toBe(true);
});
test('queue bounds reject entire request without partial addition', () => {
    const room = newRoom('x'); enqueue(room, Array(50).fill(song), 'a');
    expect(() => enqueue(room, [song], 'a')).toThrow();
    expect(room.queue.length).toBe(50);
});
test('asynchronous commands serialize per room and recover from errors', async () => {
    const lock = new RoomSerial(); const order: number[] = [];
    const a = lock.run('a', async () => { await new Promise((resolve) => setTimeout(resolve, 15)); order.push(1); });
    const b = lock.run('a', async () => { order.push(2); throw new Error('expected'); });
    const c = lock.run('a', async () => { order.push(3); });
    await Promise.all([a, b.catch(() => undefined), c]);
    expect(order).toEqual([1, 2, 3]);
});
test('LRC supports multiple timestamps and offsets', () => {
    expect(parseLyrics('[offset:100]\n[00:01.20][00:03.00]hello')).toEqual([
        { time: 1.3, text: 'hello' }, { time: 3.1, text: 'hello' },
    ]);
});
test('autocomplete distinguishes command prefixes from ordinary chat and song arguments', () => {
    expect(commandSuggestions('/mu')[0].value).toBe('/music ');
    expect(commandSuggestions('/music lo')[0].value).toBe('/music local ');
    expect(commandSuggestions('/music 一首歌')).toEqual([]);
    expect(commandSuggestions('普通聊天')).toEqual([]);
    expect(commandSuggestions('-rp')[0].value).toBe('-rps');
});
