import assert from 'assert';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import {
    requestNetease,
    upgradeNeteaseMediaUrl,
} from './remoteNetease';
import {
    MusicProvider,
    MusicTrack,
} from '@fiora/utils/music';

export const musicDirectory = path.resolve(
    process.env.MusicDirectory ||
        path.join(__dirname, '../../music'),
);

export function safeMediaUrl(
    value: any,
    local = false,
): string {
    if (typeof value !== 'string' || value.length > 4096) {
        return '';
    }

    if (
        local &&
        /^\/music-files\/[a-zA-Z0-9._%()-]+$/.test(value)
    ) {
        return value;
    }

    try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) &&
            !url.username &&
            !url.password
            ? value
            : '';
    } catch (_) {
        return '';
    }
}

function normalize(
    track: any,
    provider: MusicProvider,
): MusicTrack {
    assert(
        track && typeof track.id !== 'undefined',
        '歌曲数据缺少 ID',
    );

    const duration = Number(track.duration);
    assert(
        Number.isFinite(duration) &&
            duration > 0 &&
            duration <= 7200,
        '歌曲时长须在 1 秒到 2 小时之间',
    );

    return {
        id: String(track.id).slice(0, 120),
        provider,
        title: String(
            track.title || '未命名歌曲',
        ).slice(0, 200),
        artist: String(
            track.artist || '未知歌手',
        ).slice(0, 200),
        duration,
        album: String(track.album || '').slice(0, 200),
        cover: safeMediaUrl(track.cover),
        url: safeMediaUrl(
            track.url,
            provider === 'local',
        ),
        lyrics:
            typeof track.lyrics === 'string'
                ? track.lyrics.slice(0, 100000)
                : '',
        translatedLyrics:
            typeof track.translatedLyrics === 'string'
                ? track.translatedLyrics.slice(0, 100000)
                : '',
    };
}

function unresolvedNeteaseTrack(id: string): MusicTrack {
    return {
        id: String(id).slice(0, 120),
        provider: 'netease',
        title: `网易云歌曲 ${id}`,
        artist: '详情将在播放时重新获取',
        duration: 1,
        album: '',
        cover: '',
        url: '',
        lyrics: '',
        translatedLyrics: '',
    };
}

async function request(
    base: string | undefined,
    endpoint: string,
    params: any = {},
) {
    assert(
        base,
        '该音乐源尚未配置，请先使用本地曲库',
    );

    try {
        const result = await axios.get(
            base!.replace(/\/$/, '') + endpoint,
            {
                params,
                timeout: 15000,
                maxContentLength: 8 * 1024 * 1024,
                maxRedirects: 0,
            },
        );

        assert(
            result.data && result.data.code !== 401,
            '音乐平台登录已失效',
        );

        return result.data;
    } catch (_) {
        throw new assert.AssertionError({
            message:
                '音乐接口暂时不可用，请稍后重试或使用本地曲库',
        });
    }
}

async function localTracks() {
    try {
        const content = await fs.promises.readFile(
            path.join(musicDirectory, 'library.json'),
            'utf8',
        );
        const data = JSON.parse(content);

        assert(
            Array.isArray(data) && data.length <= 10000,
            '本地曲库格式错误',
        );

        return data.map((item: any) =>
            normalize(
                {
                    ...item,
                    url: item.file
                        ? '/music-files/' +
                          encodeURIComponent(
                              path.basename(item.file),
                          )
                        : item.url,
                },
                'local',
            ),
        );
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
}

export function musicSources() {
    return [
        {
            id: 'local',
            name: '本地曲库',
            enabled: true,
        },
        {
            id: 'netease',
            name: '网易云音乐',
            enabled: !!process.env.NeteaseMusicApi,
        },
        {
            id: 'qq',
            name: 'QQ 音乐',
            enabled: !!process.env.QQMusicApi,
        },
    ];
}

function neteaseTrack(item: any): MusicTrack {
    return normalize(
        {
            id: item.id,
            title: item.name,
            artist: (item.ar || item.artists || [])
                .map((artist: any) => artist.name)
                .join(' / '),
            duration: (item.dt || item.duration) / 1000,
            album: (item.al || item.album || {}).name,
            cover: (item.al || item.album || {}).picUrl,
        },
        'netease',
    );
}

export async function searchMusic(
    provider: MusicProvider,
    keywords: string,
): Promise<MusicTrack[]> {
    if (provider === 'local') {
        const tracks = await localTracks();

        return tracks
            .filter(
                (track) =>
                    track.id === keywords ||
                    (
                        track.title +
                        ' ' +
                        track.artist
                    )
                        .toLowerCase()
                        .includes(
                            keywords.toLowerCase(),
                        ),
            )
            .slice(0, 50);
    }

    assert(keywords.trim(), '请输入歌曲名称');

    if (provider === 'netease') {
        const result = await requestNetease(
            '/search',
            {
                keywords,
                limit: 30,
                type: 1,
            },
        );

        return (result.result?.songs || []).map(
            neteaseTrack,
        );
    }

    const result = await request(
        process.env.QQMusicApi,
        '/search',
        {
            keywords,
            limit: 30,
        },
    );

    return (result.tracks || [])
        .slice(0, 30)
        .map((item: any) =>
            normalize(item, provider),
        );
}

export function extractMusicId(
    value: string,
    playlist = false,
) {
    if (/^\d+$/.test(value.trim())) {
        return value.trim();
    }

    try {
        const url = new URL(value);

        assert(
            [
                'music.163.com',
                'y.music.163.com',
            ].includes(url.hostname),
            '请粘贴网易云歌曲或歌单完整链接',
        );

        const source = url.hash
            ? url.hash.slice(1)
            : url.pathname + url.search;

        assert(
            source.includes(
                playlist ? 'playlist' : 'song',
            ),
            '链接类型不匹配',
        );

        const match = /[?&]id=(\d+)/.exec(source);
        assert(match, '链接中没有歌曲或歌单 ID');

        return match![1];
    } catch (_) {
        throw new assert.AssertionError({
            message:
                '请输入有效的网易云 ID 或完整分享链接',
        });
    }
}

export async function getTrack(
    provider: MusicProvider,
    id: string,
) {
    if (provider === 'local') {
        const track = (await localTracks()).find(
            (item) => item.id === id,
        );
        assert(track, '本地曲库中没有这首歌');
        return track!;
    }

    if (provider === 'netease') {
        const result = await requestNetease(
            '/song/detail',
            {
                ids: extractMusicId(id),
            },
        );

        assert(
            result.songs?.length,
            '未找到这首歌曲',
        );

        return neteaseTrack(result.songs[0]);
    }

    const result = await request(
        process.env.QQMusicApi,
        '/track',
        { id },
    );

    return normalize(result.track, provider);
}

async function pagedPlaylist(
    endpoint: string,
    base: string | undefined,
    params: Record<string, any>,
    convert: (item: any) => MusicTrack,
): Promise<MusicTrack[]> {
    const pageSize = 200;
    let offset = 0;
    const tracks: MusicTrack[] = [];
    const seen = new Set<string>();
    let emptyPages = 0;

    for (;;) {
        const result = await request(base, endpoint, {
            ...params,
            limit: pageSize,
            offset,
        });

        const songs =
            result.songs ||
            result.tracks ||
            result.data?.songs ||
            result.data?.tracks ||
            [];

        if (!Array.isArray(songs) || songs.length === 0) {
            emptyPages += 1;
            if (emptyPages >= 1) break;
            offset += pageSize;
            continue;
        }

        emptyPages = 0;
        let added = 0;

        for (const item of songs) {
            const track = convert(item);
            const key = `${track.provider}:${track.id}`;

            if (!seen.has(key)) {
                seen.add(key);
                tracks.push(track);
                added += 1;
            }
        }

        // The provider may filter some songs from a page. A short page is not
        // necessarily the final page, so always advance by the requested page size.
        // If the provider ignores offset and returns only duplicates, stop safely.
        if (added === 0) break;
        offset += pageSize;
    }

    return tracks;
}

async function getNeteasePlaylist(
    value: string,
): Promise<MusicTrack[]> {
    const id = extractMusicId(value, true);

    const detail = await requestNetease(
        '/playlist/detail',
        {
            id,
            s: 0,
        },
    );

    const rawIds = detail.playlist?.trackIds;
    assert(
        Array.isArray(rawIds) && rawIds.length > 0,
        '歌单为空或无权访问',
    );

    const orderedIds = rawIds
        .map((item: any) => String(item?.id || '').trim())
        .filter((item: string) => /^\d+$/.test(item));

    assert(
        orderedIds.length > 0,
        '歌单为空或无权访问',
    );

    const details = new Map<string, MusicTrack>();
    const batchSize = 100;

    for (
        let start = 0;
        start < orderedIds.length;
        start += batchSize
    ) {
        const batch = orderedIds.slice(
            start,
            start + batchSize,
        );

        try {
            const result = await requestNetease(
                '/song/detail',
                {
                    ids: batch.join(','),
                },
            );

            for (const item of result.songs || []) {
                try {
                    const track = neteaseTrack(item);
                    details.set(track.id, track);
                } catch (_) {
                    // Keep the track ID below and retry metadata when it is played.
                }
            }
        } catch (_) {
            // Keep all IDs from this batch. Missing metadata is resolved lazily.
        }
    }

    return orderedIds.map(
        (trackId) =>
            details.get(trackId) ||
            unresolvedNeteaseTrack(trackId),
    );
}

export async function getPlaylist(
    provider: MusicProvider,
    id: string,
): Promise<MusicTrack[]> {
    if (provider === 'local') {
        return localTracks();
    }

    if (provider === 'netease') {
        return getNeteasePlaylist(id);
    }

    const tracks = await pagedPlaylist(
        '/playlist',
        process.env.QQMusicApi,
        { id },
        (item: any) => normalize(item, provider),
    );

    assert(tracks.length, '歌单为空或无权访问');
    return tracks;
}

export async function resolveTrack(
    track: MusicTrack,
): Promise<MusicTrack> {
    if (track.provider === 'local') {
        const current = await getTrack(
            'local',
            track.id,
        );

        assert(
            current.url,
            '本地歌曲未配置播放地址',
        );

        return {
            ...track,
            ...current,
        };
    }

    if (track.provider === 'netease') {
        // Refresh metadata at play time. This is important for playlist entries
        // preserved from trackIds when song/detail was filtered or temporarily failed.
        const metadata = await getTrack(
            'netease',
            track.id,
        );

        const result = await requestNetease(
            '/song/url/v1',
            {
                id: track.id,
                level: 'standard',
            },
        );

        const item = result.data?.[0];

        assert(
            item?.url && !item.freeTrialInfo,
            '此歌曲暂不可完整播放（需登录、会员或仅有试听）',
        );

        const lyric = await requestNetease(
            '/lyric',
            { id: track.id },
        ).catch(() => ({}));

        const url = safeMediaUrl(
            upgradeNeteaseMediaUrl(item.url),
        );
        assert(url, '无效的播放地址');

        return {
            ...track,
            ...metadata,
            url,
            lyrics: String(
                lyric.lrc?.lyric || '',
            ).slice(0, 100000),
            translatedLyrics: String(
                lyric.tlyric?.lyric || '',
            ).slice(0, 100000),
        };
    }

    const result = await request(
        process.env.QQMusicApi,
        '/resolve',
        { id: track.id },
    );

    assert(!result.trial, '此歌曲仅有试听');

    const resolved = normalize(
        {
            ...track,
            ...result.track,
        },
        'qq',
    );

    assert(
        resolved.url,
        '歌曲暂不可播放',
    );

    return {
        ...track,
        ...resolved,
    };
}
