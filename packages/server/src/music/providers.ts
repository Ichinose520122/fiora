import assert from 'assert';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { MusicProvider, MusicTrack } from '@fiora/utils/music';

export const musicDirectory = path.resolve(process.env.MusicDirectory || path.join(__dirname, '../../music'));
export function safeMediaUrl(value: any, local = false): string {
    if (typeof value !== 'string' || value.length > 4096) return '';
    if (local && /^\/music-files\/[a-zA-Z0-9._%()-]+$/.test(value)) return value;
    try {
        const url = new URL(value);
        return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? value : '';
    } catch (_) { return ''; }
}
function normalize(track: any, provider: MusicProvider): MusicTrack {
    assert(track && typeof track.id !== 'undefined', '歌曲数据缺少 ID');
    const duration = Number(track.duration);
    assert(Number.isFinite(duration) && duration > 0 && duration <= 7200, '歌曲时长须在 1 秒到 2 小时之间');
    return { id: String(track.id).slice(0, 120), provider,
        title: String(track.title || '未命名歌曲').slice(0, 200),
        artist: String(track.artist || '未知歌手').slice(0, 200), duration,
        cover: safeMediaUrl(track.cover), url: safeMediaUrl(track.url, provider === 'local'),
        lyrics: typeof track.lyrics === 'string' ? track.lyrics.slice(0, 100000) : '' };
}
async function request(base: string | undefined, endpoint: string, params: any = {}) {
    assert(base, '该音乐源尚未配置，请先使用本地曲库');
    try {
        const result = await axios.get(base!.replace(/\/$/, '') + endpoint, {
            params, timeout: 10000, maxContentLength: 2 * 1024 * 1024,
            maxRedirects: 0,
        });
        assert(result.data && result.data.code !== 401, '音乐平台登录已失效');
        return result.data;
    } catch (_) {
        throw new assert.AssertionError({ message: '音乐接口暂时不可用，请稍后重试或使用本地曲库' });
    }
}
async function localTracks() {
    try {
        const content = await fs.promises.readFile(path.join(musicDirectory, 'library.json'), 'utf8');
        const data = JSON.parse(content);
        assert(Array.isArray(data) && data.length <= 10000, '本地曲库格式错误');
        return data.map((item: any) => normalize({
            ...item, url: item.file ? '/music-files/' + encodeURIComponent(path.basename(item.file)) : item.url,
        }, 'local'));
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
}
export function musicSources() {
    return [
        { id: 'local', name: '本地曲库', enabled: true },
        { id: 'netease', name: '网易云音乐', enabled: !!process.env.NeteaseMusicApi },
        { id: 'qq', name: 'QQ 音乐', enabled: !!process.env.QQMusicApi },
    ];
}
function neteaseTrack(item: any): MusicTrack {
    return normalize({ id: item.id, title: item.name,
        artist: (item.ar || item.artists || []).map((artist: any) => artist.name).join(' / '),
        duration: (item.dt || item.duration) / 1000,
        cover: (item.al || item.album || {}).picUrl }, 'netease');
}
export async function searchMusic(provider: MusicProvider, keywords: string): Promise<MusicTrack[]> {
    if (provider === 'local') {
        const tracks = await localTracks();
        return tracks.filter((track) => (track.title + ' ' + track.artist).toLowerCase().includes(keywords.toLowerCase())).slice(0, 50);
    }
    assert(keywords.trim(), '请输入歌曲名称');
    if (provider === 'netease') {
        const result = await request(process.env.NeteaseMusicApi, '/search', { keywords, limit: 30, type: 1 });
        return (result.result?.songs || []).map(neteaseTrack);
    }
    const result = await request(process.env.QQMusicApi, '/search', { keywords, limit: 30 });
    return (result.tracks || []).slice(0, 30).map((item: any) => normalize(item, provider));
}
export function extractMusicId(value: string, playlist = false) {
    if (/^\d+$/.test(value.trim())) return value.trim();
    try {
        const url = new URL(value);
        assert(['music.163.com', 'y.music.163.com'].includes(url.hostname), '请粘贴网易云歌曲或歌单完整链接');
        const source = url.hash ? url.hash.slice(1) : url.pathname + url.search;
        assert(source.includes(playlist ? 'playlist' : 'song'), '链接类型不匹配');
        const match = /[?&]id=(\d+)/.exec(source);
        assert(match, '链接中没有歌曲或歌单 ID');
        return match![1];
    } catch (_) {
        throw new assert.AssertionError({ message: '请输入有效的网易云 ID 或完整分享链接' });
    }
}
export async function getTrack(provider: MusicProvider, id: string) {
    if (provider === 'local') {
        const track = (await localTracks()).find((item) => item.id === id);
        assert(track, '本地曲库中没有这首歌');
        return track!;
    }
    if (provider === 'netease') {
        const result = await request(process.env.NeteaseMusicApi, '/song/detail', { ids: extractMusicId(id) });
        assert(result.songs?.length, '未找到这首歌曲');
        return neteaseTrack(result.songs[0]);
    }
    const result = await request(process.env.QQMusicApi, '/track', { id });
    return normalize(result.track, provider);
}
export async function getPlaylist(provider: MusicProvider, id: string): Promise<MusicTrack[]> {
    if (provider === 'local') return (await localTracks()).slice(0, 50);
    if (provider === 'netease') {
        const result = await request(process.env.NeteaseMusicApi, '/playlist/track/all', {
            id: extractMusicId(id, true), limit: 50, offset: 0,
        });
        assert(result.songs?.length, '歌单为空或无权访问');
        return result.songs.map(neteaseTrack).slice(0, 50);
    }
    const result = await request(process.env.QQMusicApi, '/playlist', { id, limit: 50 });
    return (result.tracks || []).slice(0, 50).map((item: any) => normalize(item, provider));
}
export async function resolveTrack(track: MusicTrack): Promise<MusicTrack> {
    if (track.provider === 'local') {
        const current = await getTrack('local', track.id);
        assert(current.url, '本地歌曲未配置播放地址');
        return { ...track, ...current };
    }
    if (track.provider === 'netease') {
        const result = await request(process.env.NeteaseMusicApi, '/song/url/v1', {
            id: track.id, level: 'standard',
        });
        const item = result.data?.[0];
        assert(item?.url && !item.freeTrialInfo, '此歌曲暂不可完整播放（需登录、会员或仅有试听）');
        const lyric = await request(process.env.NeteaseMusicApi, '/lyric', { id: track.id }).catch(() => ({}));
        const url = safeMediaUrl(item.url);
        assert(url, '无效的播放地址');
        return { ...track, url, lyrics: String(lyric.lrc?.lyric || '').slice(0, 100000) };
    }
    const result = await request(process.env.QQMusicApi, '/resolve', { id: track.id });
    assert(!result.trial, '此歌曲仅有试听');
    const resolved = normalize({ ...track, ...result.track }, 'qq');
    assert(resolved.url, '歌曲暂不可播放');
    return { ...track, ...resolved };
}

