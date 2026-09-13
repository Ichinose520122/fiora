import assert from 'assert';
import { randomBytes } from 'crypto';
import { musicAction, musicGetState, musicSearch } from '../routes/music';
import { MusicProvider, MusicSnapshot, MusicTrack } from '@fiora/utils/music';

const sources = ['local', 'netease', 'qq'];
const help = '音乐指令：/music 歌名 · /music search 关键词 · /music list · /music join · /music leave · /music vote · /music login';
function song(track: MusicTrack) { return `${track.title} — ${track.artist}`; }

// Called only after sendMessage has validated chat access and permission to send.
// Replies use the same persisted system-message path as -roll; never execute credentials here.
export async function executeMusicCommand(ctx: Context<any>, input: string): Promise<string> {
    const parts = input.trim().split(/\s+/).slice(1);
    const sub = parts[0] || '';
    let source: MusicProvider = 'netease';
    const roomId = ctx.data.to;
    const context = (data: any): Context<any> => ({ ...ctx, data: { roomId, ...data } });
    try {
        if (!sub || sub === 'help') return help;
        if (sub === 'login') return '请在音乐面板的“网易云账号”中登录。请勿在聊天框输入手机号、验证码或 Cookie。';
        if (['cookie', 'captcha', 'phone', 'password'].includes(sub)) return '账号凭据仅能在音乐面板中填写，不通过聊天指令登录。';
        if (sub === 'join' || sub === 'leave' || sub === 'stop') {
            await musicGetState(context({ listening: sub === 'join' }));
            return sub === 'join' ? '加入了一起听' : '退出了一起听（不影响其他听众）';
        }
        if (sub === 'list') {
            const state = await musicGetState(context({}));
            return `正在播放：${state.current ? song(state.current) : '暂无'}；队列 ${state.queue.length} 首` +
                state.queue.slice(0, 5).map((track, index) => `\n${index + 1}. ${song(track)}`).join('');
        }
        const requestId = randomBytes(16).toString('hex');
        if (['pause', 'resume', 'next', 'vote'].includes(sub)) {
            assert(parts.length === 1, '此指令不需要额外参数');
            // Read without changing the caller's listening subscription.
            const { loadRoom, roomSerial } = await import('./service');
            const state = await roomSerial.run(roomId, () => loadRoom(roomId));
            const result = await musicAction(context({ action: sub, requestId, entryId: state.current?.entryId }));
            if (sub === 'vote') return result.current?.entryId !== state.current?.entryId ? '投票通过，已切歌' : `已投票切歌（${result.votes.length}/${result.votesNeeded}）`;
            return ({ pause: '暂停了播放', resume: '继续播放', next: '已切到下一首' } as any)[sub];
        }
        let action = 'add';
        if (sub === 'search' || sub === 'playlist') { action = sub; parts.shift(); }
        if (sources.includes(parts[0])) source = parts.shift() as MusicProvider;
        const query = parts.join(' ');
        assert(query || (action === 'playlist' && source === 'local'), '缺少歌名、关键词或歌单 ID；输入 /music help 查看用法');
        if (action === 'search') {
            const result = await musicSearch(context({ provider: source, keywords: query }));
            return result.tracks.length ? `搜索结果（${source}）：` + result.tracks.slice(0, 5)
                .map((track, index) => `\n${index + 1}. ${song(track)} [${track.id}]`).join('') + '\n使用 /music 音乐来源 ID 点歌'
                : '没有找到歌曲，请换一个关键词或音乐来源';
        }
        let track: MusicTrack | undefined;
        let id = query;
        if (action === 'add' && !(source === 'netease' && (/^\d+$/.test(query) || /^https?:/.test(query)))) {
            const found = await musicSearch(context({ provider: source, keywords: query }));
            track = found.tracks[0];
            assert(track, '没有找到歌曲，请换一个关键词或音乐来源');
            id = track!.id;
        }
        const result: MusicSnapshot = await musicAction(context({ action, requestId, provider: source, id }));
        if (action === 'playlist') return result.notice || '已将歌单加入点歌队列';
        const added = [...result.queue].reverse().find((item) => item.id === id && item.provider === source) || result.current;
        return added ? `点歌 ${song(added)}${added.entryId === result.current?.entryId ? '，开始播放' : '，已加入队列'}` : '点歌已处理';
    } catch (error) {
        return '音乐指令未完成：' + (error instanceof assert.AssertionError ? error.message : '服务暂时不可用，请稍后重试');
    }
}
