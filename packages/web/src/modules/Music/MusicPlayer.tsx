import MusicIcon from '../../components/MusicIcon';
import React, { useMemo } from 'react';
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
    const lyrics = useMemo(() => parseLyrics(track?.lyrics), [track?.lyrics]);
    const translation = useMemo(
        () => parseLyrics(track?.translatedLyrics),
        [track?.translatedLyrics],
    );

    if (!music.room || !track) return null;

    let index = -1;
    lyrics.forEach((line, i) => {
        if (line.time <= music.position) index = i;
    });

    const translated =
        index >= 0
            ? translation.find(
                  (line) => Math.abs(line.time - lyrics[index].time) < 0.2,
              )?.text
            : '';

    const currentLyric =
        lyrics[index]?.text ||
        '纯音乐 / 暂无歌词';
    const secondLyric =
        translated ||
        lyrics[index + 1]?.text ||
        '';

    return (
        <section className={Style.player} aria-label="一起听播放器">
            <div
                className={`${Style.disc} ${
                    music.playing ? Style.spinning : ''
                }`}
                aria-hidden="true"
            >
                {track?.cover ? (
                    <img src={track.cover} alt="" />
                ) : (
                    <MusicIcon size={24} />
                )}
                <i />
            </div>

            <div className={Style.trackInfo}>
                <div className={Style.songLine}>
                    <strong>{track.title}</strong>
                    <span className={Style.artist}>
                        {track?.artist || '等待点歌'}
                    </span>
                </div>

                <div className={Style.lyricViewport} aria-live="off">
                    <div
                        key={`${track?.entryId || 'idle'}-${index}`}
                        className={Style.lyricSlide}
                    >
                        <p title={currentLyric}>{currentLyric}</p>
                        <span title={secondLyric}>{secondLyric}</span>
                    </div>
                </div>

                {(music.error || music.room.notice) && (
                    <div className={Style.playerNotice} role="status">
                        {music.error || music.room.notice}
                    </div>
                )}
            </div>

            <div className={Style.playerActions}>
                <div className={Style.actionButtons}>
                    <button
                        type="button"
                        onClick={
                            music.error || !music.listening
                                ? music.join
                                : music.leave
                        }
                    >
                        {music.error
                            ? '重试'
                            : music.listening
                              ? '退出'
                              : '加入'}
                    </button>

                    {track && music.room.canControl && (
                        <button
                            type="button"
                            onClick={() =>
                                music.act(
                                    music.room!.paused
                                        ? 'resume'
                                        : 'pause',
                                )
                            }
                        >
                            {music.room.paused ? '继续' : '暂停'}
                        </button>
                    )}

                    {track && (
                        <button
                            type="button"
                            disabled={!music.listening}
                            onClick={() => music.act('vote')}
                            title={`切歌投票 ${music.room.votes.length}/${music.room.votesNeeded}`}
                        >
                            切歌
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => music.open()}
                        title={`待播 ${music.room.queue.length} 首`}
                    >
                        点歌
                    </button>
                </div>

                <label className={Style.volume}>
                    <span>音量</span>
                    <input
                        aria-label="个人音量"
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={music.volume}
                        onChange={(event) =>
                            music.setVolume(Number(event.target.value))
                        }
                    />
                    <b>{Math.round(music.volume * 100)}%</b>
                </label>
            </div>
        </section>
    );
}
