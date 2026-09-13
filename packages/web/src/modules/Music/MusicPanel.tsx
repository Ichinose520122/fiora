import React, { useState } from 'react';
import { MusicProvider, MusicTrack } from '@fiora/utils/music';
import Dialog from '../../components/Dialog';
import { useMusic } from './MusicSession';
import { formatTime } from './MusicPlayer';
import Style from './Music.less';
export default function MusicPanel() {
    const music = useMusic();
    const [tab, setTab] = useState('search');
    const [playlist, setPlaylist] = useState('');
    const [pending, setPending] = useState(false);
    if (!music.panel) return null;
    const source = music.sources.find((item) => item.id === music.selectedSource);
    async function add(track: MusicTrack) {
        if (pending) return;
        setPending(true); music.join();
        await music.act('add', { provider: track.provider, id: track.id });
        setPending(false);
    }
    async function importList(action: string) {
        if (pending) return;
        setPending(true); music.join();
        await music.act(action, { provider: music.selectedSource, id: playlist });
        setPending(false);
    }
    return (
        <Dialog visible title="一起听 · 音乐空间" onClose={music.close} animation="zoom"
            maskAnimation="fade" className={Style.dialog} style={{ width: 'min(720px, 94vw)' }}>
            <div className={Style.panel}>
                <p className={Style.hint}>当前聊天独立队列 · 第一首立即播放，后续点歌按顺序排队</p>
                <div className={Style.tabs}>
                    {[['search', '搜索 / 点歌'], ['queue', '播放队列'], ['playlist', '导入歌单']].map(([id, name]) =>
                        <button type="button" key={id} className={tab === id ? Style.active : ''} onClick={() => setTab(id)}>{name}{id === 'queue' ? ' (' + (music.room?.queue.length || 0) + ')' : ''}</button>)}
                </div>
                {tab !== 'queue' && <label className={Style.source}>音乐来源
                    <select aria-label="音乐来源" value={music.selectedSource} onChange={(event) => music.setSource(event.target.value as MusicProvider)}>
                        {music.sources.map((item) => <option key={item.id} value={item.id}>{item.name}{item.enabled ? '' : ' · 未配置'}</option>)}
                    </select>
                </label>}
                {tab === 'search' && <>
                    <form className={Style.search} onSubmit={(event) => { event.preventDefault(); music.search(); }}>
                        <input aria-label="搜索歌曲" placeholder={music.selectedSource === 'local' ? '搜索本地曲库，留空查看全部' : '歌曲名 / 歌手'} value={music.keywords} onChange={(event) => music.setKeywords(event.target.value)} />
                        <button type="submit" disabled={music.busy || !source?.enabled}>{music.busy ? '搜索中…' : '搜索'}</button>
                    </form>
                    {!source?.enabled && <p className={Style.notice}>此音乐源尚未配置，当前可以使用本地曲库。</p>}
                    <div className={Style.results}>
                        {!music.busy && music.searchResults.length === 0 && <p className={Style.empty}>搜索喜欢的歌，或者切换到本地曲库查看服务器歌曲。</p>}
                        {music.searchResults.map((track) => <div className={Style.song} key={track.provider + track.id}>
                            <div className={Style.songCover}>{track.cover ? <img src={track.cover} alt="" /> : '♪'}</div>
                            <div className={Style.songText}><strong>{track.title}</strong><span>{track.artist} · {formatTime(track.duration)}</span></div>
                            <button type="button" disabled={pending} onClick={() => add(track)}>点歌</button>
                        </div>)}
                    </div>
                    <p className={Style.hint}>快捷点歌：/music 歌名 · /music local 歌名 · /music search 关键词</p>
                </>}
                {tab === 'queue' && <>
                    <p className={Style.hint}>正在播放：{music.room?.current?.title || '暂无'}{music.room?.current?.idle ? '（空闲歌单）' : ''}</p>
                    <div className={Style.results}>
                        {!music.room?.queue.length && <p className={Style.empty}>还没有排队的歌曲，去点一首吧。</p>}
                        {music.room?.queue.map((track, index) => <div className={Style.song} key={track.entryId}>
                            <span>{index + 1}</span><div className={Style.songText}><strong>{track.title}</strong><span>{track.artist}</span></div>
                            <button type="button" onClick={() => music.act('remove', { entryId: track.entryId })}>移除</button>
                        </div>)}
                    </div>
                    {music.room?.canControl && music.room?.current && <button type="button" onClick={() => music.act('next')}>立即切到下一首</button>}
                </>}
                {tab === 'playlist' && <div className={Style.import}>
                    <p>粘贴平台歌单 ID 或网易云完整歌单链接。每次最多导入前 50 首；本地曲库无需填写。</p>
                    <input aria-label="歌单链接" placeholder="歌单 ID / 链接" value={playlist} onChange={(event) => setPlaylist(event.target.value)} />
                    <div className={Style.controls}>
                        <button type="button" disabled={pending || !source?.enabled} onClick={() => importList('playlist')}>加入点歌队列</button>
                        {music.room?.canControl && <button type="button" disabled={pending || !source?.enabled} onClick={() => importList('idle')}>设为空闲歌单</button>}
                        {music.room?.canControl && <button type="button" onClick={() => music.act('clearIdle')}>清空空闲歌单</button>}
                    </div>
                    <p className={Style.hint}>空闲歌单 {music.room?.idlePlaylist.length || 0} 首。有人点歌时优先播放点歌，队列结束后继续空闲歌单。</p>
                </div>}
            </div>
        </Dialog>
    );
}

