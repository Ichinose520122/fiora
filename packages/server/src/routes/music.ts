import assert from 'assert';
import {
    MusicProvider,
    MusicRoomState,
} from '@fiora/utils/music';
import User from '@fiora/database/mongoose/models/user';
import getLinkmanAccess from '../utils/linkmanAccess';
import {
    enqueue,
    setPaused,
    voteNext,
} from '../music/room';
import {
    loadRoom,
    roomSerial,
    snapshot,
    publish,
    nextTrack,
    listenerIds,
    subscribe,
    unsubscribe,
} from '../music/service';
import {
    searchMusic,
    getTrack,
    getPlaylist,
    musicSources,
    resolveTrack,
} from '../music/providers';

const limits = new Map<
    string,
    { count: number; since: number }
>();
const results = new Map<
    string,
    { time: number; result: any }
>();

function checkRate(userId: string) {
    const now = Date.now();

    if (limits.size > 1000) {
        limits.forEach((value, key) => {
            if (now - value.since > 60000) {
                limits.delete(key);
            }
        });
    }

    const item = limits.get(userId);

    if (!item || now - item.since > 60000) {
        limits.set(userId, {
            count: 1,
            since: now,
        });
    } else {
        item.count += 1;
        assert(
            item.count <= 60,
            '音乐操作过于频繁，请稍后再试',
        );
    }
}

function text(value: any, max = 200) {
    assert(
        typeof value === 'string' &&
            value.length <= max,
        '参数格式错误',
    );
    return value.trim();
}

function provider(value: any): MusicProvider {
    assert(
        ['local', 'netease', 'qq'].includes(value),
        '不支持的音乐源',
    );
    return value;
}

function rememberPlaylist(
    room: MusicRoomState,
    source: MusicProvider,
    id: string,
    trackCount: number,
    mode: 'queue' | 'idle' | 'saved',
) {
    if (!Array.isArray(room.savedPlaylists)) {
        room.savedPlaylists = [];
    }

    const key = `${source}:${id}`;
    room.savedPlaylists = room.savedPlaylists.filter(
        (item) => item.key !== key,
    );

    room.savedPlaylists.unshift({
        key,
        provider: source,
        id,
        trackCount,
        mode,
        updatedAt: Date.now(),
    });
}

async function access(ctx: Context<any>) {
    assert(
        ctx.data && typeof ctx.data === 'object',
        '参数格式错误',
    );
    assert(ctx.socket.user, '请先登录');

    const roomId = text(
        ctx.data.roomId,
        48,
    ).toLowerCase();

    const granted = await getLinkmanAccess(
        ctx.socket.user,
        roomId,
    );

    const canControl =
        !granted.group ||
        granted.group.creator?.toString() ===
            ctx.socket.user ||
        !!ctx.socket.isAdmin;

    return {
        roomId,
        canControl,
    };
}

export async function musicGetState(
    ctx: Context<any>,
) {
    const { roomId, canControl } =
        await access(ctx);

    return roomSerial.run(roomId, async () => {
        subscribe(
            ctx.socket.id,
            roomId,
            ctx.socket.user,
            typeof ctx.data.listening === 'boolean'
                ? ctx.data.listening
                : undefined,
        );

        return {
            ...snapshot(
                await loadRoom(roomId),
                canControl,
            ),
            sources: musicSources(),
        };
    });
}

export async function musicLeave(ctx: Context<any>) {
    unsubscribe(ctx.socket.id);
    return { ok: true };
}

export async function musicSearch(
    ctx: Context<any>,
) {
    await access(ctx);
    checkRate(ctx.socket.user);

    return {
        tracks: await searchMusic(
            provider(ctx.data.provider),
            text(ctx.data.keywords),
        ),
    };
}

export async function musicAction(
    ctx: Context<any>,
) {
    const { roomId, canControl } =
        await access(ctx);

    checkRate(ctx.socket.user);

    const requestId = text(
        ctx.data.requestId,
        80,
    );
    assert(requestId, '缺少请求编号');

    const cacheKey =
        roomId +
        ':' +
        ctx.socket.user +
        ':' +
        requestId;

    return roomSerial.run(roomId, async () => {
        const cached = results.get(cacheKey);

        if (
            cached &&
            Date.now() - cached.time < 60000
        ) {
            return cached.result;
        }

        const room = await loadRoom(roomId);
        const action = text(ctx.data.action, 30);

        const requester = [
            'add',
            'playlist',
        ].includes(action)
            ? await User.findById(ctx.socket.user)
                  .select('username')
                  .lean()
            : null;

        if (
            [
                'next',
                'pause',
                'resume',
                'seek',
                'vote',
            ].includes(action)
        ) {
            assert(
                room.current &&
                    room.current.entryId ===
                        ctx.data.entryId,
                '歌曲已切换，请刷新后操作',
            );
        }

        room.notice = '';

        switch (action) {
            case 'add': {
                const track = await getTrack(
                    provider(ctx.data.provider),
                    text(ctx.data.id, 2048),
                );

                enqueue(
                    room,
                    [
                        {
                            ...track,
                            requestedByName:
                                requester?.username ||
                                '用户',
                        },
                    ],
                    ctx.socket.user,
                );

                if (
                    !room.current ||
                    room.current.idle
                ) {
                    await nextTrack(room);
                    assert(
                        room.current,
                        '歌曲暂不可播放，请换一首或使用本地曲库',
                    );
                }
                break;
            }

            case 'playlist': {
                const source = provider(
                    ctx.data.provider,
                );
                const playlistId = text(
                    ctx.data.id,
                    2048,
                );
                const tracks = await getPlaylist(
                    source,
                    playlistId,
                );

                enqueue(
                    room,
                    tracks.map((track) => ({
                        ...track,
                        requestedByName:
                            requester?.username ||
                            '用户',
                    })),
                    ctx.socket.user,
                );

                rememberPlaylist(
                    room,
                    source,
                    playlistId,
                    tracks.length,
                    'queue',
                );

                if (
                    !room.current ||
                    room.current.idle
                ) {
                    await nextTrack(room);
                }

                room.notice =
                    '已添加 ' +
                    tracks.length +
                    ' 首';
                break;
            }

            case 'idle': {
                assert(
                    canControl,
                    '只有群主或管理员可以设置空闲歌单',
                );

                const source = provider(
                    ctx.data.provider,
                );
                const playlistId = text(
                    ctx.data.id,
                    2048,
                );
                const tracks = await getPlaylist(
                    source,
                    playlistId,
                );

                room.idlePlaylist = tracks;
                room.idleCursor = 0;

                rememberPlaylist(
                    room,
                    source,
                    playlistId,
                    tracks.length,
                    'idle',
                );

                if (!room.current) {
                    await nextTrack(room);
                }
                break;
            }

            case 'savePlaylist': {
                assert(
                    canControl,
                    '只有群主或管理员可以保存歌单',
                );

                const source = provider(
                    ctx.data.provider,
                );
                const playlistId = text(
                    ctx.data.id,
                    2048,
                );
                const tracks = await getPlaylist(
                    source,
                    playlistId,
                );

                rememberPlaylist(
                    room,
                    source,
                    playlistId,
                    tracks.length,
                    'saved',
                );

                room.notice =
                    '已保存 ' +
                    tracks.length +
                    ' 首，不影响播放队列和空闲歌单';
                break;
            }

            case 'refreshSavedPlaylist': {
                assert(
                    canControl,
                    '只有群主或管理员可以更新已保存歌单',
                );

                const key = text(
                    ctx.data.key,
                    2200,
                );
                const saved =
                    room.savedPlaylists.find(
                        (item) => item.key === key,
                    );

                assert(
                    saved,
                    '已保存歌单不存在',
                );

                const tracks = await getPlaylist(
                    saved!.provider,
                    saved!.id,
                );

                rememberPlaylist(
                    room,
                    saved!.provider,
                    saved!.id,
                    tracks.length,
                    saved!.mode || 'saved',
                );

                room.notice =
                    '已更新保存的歌单，共 ' +
                    tracks.length +
                    ' 首';
                break;
            }

            case 'removeSavedPlaylist': {
                assert(
                    canControl,
                    '只有群主或管理员可以移除已保存歌单',
                );

                const key = text(
                    ctx.data.key,
                    2200,
                );
                const index =
                    room.savedPlaylists.findIndex(
                        (item) => item.key === key,
                    );

                assert(
                    index >= 0,
                    '已保存歌单不存在',
                );

                room.savedPlaylists.splice(
                    index,
                    1,
                );
                room.notice =
                    '已移除保存的歌单';
                break;
            }

            case 'idleMode':
                assert(canControl, '只有群主或管理员可以修改空闲歌单播放模式');
                assert(['sequential', 'random'].includes(ctx.data.mode), '无效的播放模式');
                room.idleMode = ctx.data.mode;
                break;

            case 'clearIdle':
                assert(
                    canControl,
                    '只有群主或管理员可以修改空闲歌单',
                );
                room.idlePlaylist = [];
                room.idleCursor = 0;
                break;

            case 'next':
                assert(
                    canControl,
                    '请通过投票切歌',
                );
                await nextTrack(room);
                break;

            case 'vote':
                if (
                    voteNext(
                        room,
                        ctx.socket.user,
                        listenerIds(roomId),
                    )
                ) {
                    await nextTrack(room);
                }
                break;

            case 'pause':
            case 'resume':
                assert(
                    canControl,
                    '只有群主或管理员可以控制播放',
                );

                if (
                    action === 'resume' &&
                    room.paused &&
                    room.current
                ) {
                    room.current =
                        await resolveTrack(
                            room.current,
                        );
                }

                setPaused(
                    room,
                    action === 'pause',
                );
                break;

            case 'seek': {
                assert(
                    canControl,
                    '只有群主或管理员可以控制进度',
                );

                const position =
                    ctx.data.position;

                assert(
                    typeof position ===
                        'number' &&
                        Number.isFinite(position) &&
                        position >= 0 &&
                        position <=
                            room.current!.duration,
                    '无效的播放进度',
                );

                room.position = position;
                room.startedAt = Date.now();
                break;
            }

            case 'remove': {
                const index =
                    room.queue.findIndex(
                        (track) =>
                            track.entryId ===
                            ctx.data.entryId,
                    );

                assert(
                    index >= 0,
                    '歌曲已不在队列中',
                );

                assert(
                    canControl ||
                        room.queue[index]
                            .requestedBy ===
                            ctx.socket.user,
                    '只能取消自己的点歌',
                );

                room.queue.splice(index, 1);
                break;
            }

            case 'top': {
                assert(
                    canControl,
                    '只有群主或管理员可以调整队列顺序',
                );

                const index =
                    room.queue.findIndex(
                        (track) =>
                            track.entryId ===
                            ctx.data.entryId,
                    );

                assert(
                    index >= 0,
                    '歌曲已不在队列中',
                );

                if (index > 0) {
                    const [track] =
                        room.queue.splice(
                            index,
                            1,
                        );
                    room.queue.unshift(track);
                }
                break;
            }

            case 'clearQueue':
                assert(
                    canControl,
                    '只有群主或管理员可以清空队列',
                );
                room.queue = [];
                break;

            default:
                assert(false, '未知音乐操作');
        }

        await publish(room);

        const result = snapshot(
            room,
            canControl,
        );

        results.forEach((value, key) => {
            if (
                Date.now() - value.time >
                60000
            ) {
                results.delete(key);
            }
        });

        if (results.size >= 2000) {
            results.delete(
                results.keys().next().value,
            );
        }

        results.set(cacheKey, {
            time: Date.now(),
            result,
        });

        return result;
    });
}
