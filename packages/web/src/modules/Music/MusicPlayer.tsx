import React from 'react';
import { parseLyrics } from '@fiora/utils/music';
import { useMusic } from './MusicSession';
import Style from './Music.less';
export function formatTime(value: number) {
    const seconds = Math.max(0, Math.floor(value || 0));
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}
export default function MusicPlayer() {
    const music = useMusic();
    const track = music.room?.current;
    if (!music.room) return null;
    const lyrics = parseLyrics(track?.lyrics);
    let index = -1;
    lyrics.forEach((line, i) => { if (line.time <= music.position) index = i; });
    return (
        <section className={Style.player} aria-label="一起听播放器">
            <div className={Style.disc + ' ' + (music.playing ? Style.spinning : '')} aria-hidden="true">
                {track?.cover ? <img src={track.cover} alt="" /> : <span>♪</span>}
                <i />
            </div>
            <div className={Style.trackInfo}>
                <div className={Style.eyebrow}>一起听 · {music.room.listeners} 人{track?.idle ? ' · 空闲歌单' : ''}</div>
                <strong className={Style.title}>{track?.title || '让音乐陪你聊天'}</strong>
                <span className={Style.artist}>{track ? track.artist : '点一首歌，邀请 TA 一起听'}</span>
                <div className={Style.lyrics} aria-live="off">
                    <div>{index > 0 ? lyrics[index - 1].text : ''}</div>
                    <p>{lyrics[index]?.text || (track ? '纯音乐 / 暂无歌词' : '每个聊天，都有自己的歌单')}</p>
                    <div>{lyrics[index + 1]?.text || ''}</div>
                </div>
                <div className={Style.progressRow}>
                    <span>{formatTime(music.position)}</span>
                    <progress value={music.position} max={track?.duration || 1} aria-label="播放进度" />
                    <span>{formatTime(track?.duration || 0)}</span>
                </div>
                <div className={Style.controls}>
                    <button type="button" onClick={music.error || !music.listening ? music.join : music.leave}>
                        {music.error ? '加入 / 重试播放' : music.listening ? '退出一起听' : '加入一起听'}
                    </button>
                    {track && music.room.canControl && <button type="button" onClick={() => music.act(music.room!.paused ? 'resume' : 'pause')}>
                        {music.room.paused ? '继续播放' : '暂停'}
                    </button>}
                    {track && <button type="button" disabled={!music.listening} onClick={() => music.act('vote')}>
                        切歌投票 {music.room.votes.length}/{music.room.votesNeeded}
                    </button>}
                    <button type="button" onClick={() => music.open()}>点歌 · {music.room.queue.length}</button>
                    <label className={Style.volume}>音量
                        <input aria-label="个人音量" type="range" min="0" max="1" step="0.01"
                            value={music.volume} onChange={(event) => music.setVolume(Number(event.target.value))} />
                        <span>{Math.round(music.volume * 100)}%</span>
                    </label>
                </div>
                {(music.error || music.room.notice) && <div className={Style.notice} role="status">{music.error || music.room.notice}</div>}
            </div>
        </section>
    );
}

