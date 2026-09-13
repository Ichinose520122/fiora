jest.mock('@fiora/database/mongoose/models/musicRoom', () => ({
    __esModule: true,
    default: { findById: jest.fn(() => ({ lean: async () => null })), updateOne: jest.fn() },
}));
jest.mock('../src/utils/linkmanAccess', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../src/music/providers', () => ({ resolveTrack: jest.fn(async (track) => track) }));

import MusicRoom from '@fiora/database/mongoose/models/musicRoom';
import { loadRoom, publish } from '../src/music/service';
import { enqueue } from '../src/music/room';

test('failed persistence leaves the live queue unchanged and retries do not duplicate songs', async () => {
    const draft = await loadRoom('persistence-test');
    const track = { id: 'one', provider: 'local' as const, title: 'One', artist: 'Test', duration: 120 };
    enqueue(draft, [track], 'a');
    (MusicRoom.updateOne as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    await expect(publish(draft)).rejects.toThrow('disk full');
    const retry = await loadRoom('persistence-test');
    expect(retry.queue).toEqual([]);
    expect(retry.revision).toBe(0);
    enqueue(retry, [track], 'a');
    (MusicRoom.updateOne as jest.Mock).mockResolvedValueOnce({ ok: 1 });
    await publish(retry);
    const committed = await loadRoom('persistence-test');
    expect(committed.queue).toHaveLength(1);
    committed.queue.splice(0, 1);
    expect((await loadRoom('persistence-test')).queue).toHaveLength(1);
});
