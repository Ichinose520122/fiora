import MusicIcon from '../../components/MusicIcon';
import React, { useState } from 'react';
import { MusicProvider, MusicTrack, SavedMusicPlaylist } from '@fiora/utils/music';
import Dialog from '../../components/Dialog';
import { useMusic } from './MusicSession';
import { formatTime } from './MusicPlayer';
import Style from './Music.less';
import MusicAccount from './MusicAccount';

const sourceNames: Record<MusicProvider, string> = {
    local: '本地',
    netease: '网易云',
    qq: 'QQ',
};

export default function MusicPanel() {
    const music = useMusic();
    const tab = music.panelTab;
    const setTab = music.setPanelTab;
    const [playlist, setPlaylist] = useState('');
    const [pending, setPending] = useState(false);

    if (!music.panel) return null;

    const source = music.sources.find(
        (item) => item.id === music.selectedSource,
    );

    async function add(track: MusicTrack) {
        if (pending) return;
        setPending(true);
        music.join();
        await music.act('add', {
            provider: track.provider,
            id: track.id,
        });
        setPending(false);
    }

    async function importList(
        action: 'playlist' | 'idle' | 'savePlaylist',
        provider = music.selectedSource,
        id = playlist,
    ) {
        if (pending) return;
        setPending(true);
        if (action !== 'savePlaylist') {
            music.join();
        }
        await music.act(action, { provider, id });
        setPending(false);
    }

    async function refreshSaved(item: SavedMusicPlaylist) {
        if (pending) return;
        setPending(true);
        await music.act('refreshSavedPlaylist', {
            key: item.key,
        });
        setPending(false);
    }

    async function removeSaved(item: SavedMusicPlaylist) {
        if (pending) return;
        setPending(true);
        await music.act('removeSavedPlaylist', {
            key: item.key,
        });
        setPending(false);
    }

    async function top(entryId?: string) {
        if (!entryId || pending) return;
        setPending(true);
        await music.act('top', { entryId });
        setPending(false);
    }

    async function clearQueue() {
        if (pending) return;
        setPending(true);
        await music.act('clearQueue');
        setPending(false);
    }

    function savedLabel(item: SavedMusicPlaylist) {
        const mode =
            item.mode === 'idle'
                ? '空闲歌单'
                : item.mode === 'saved'
                  ? '仅保存'
                  : '加入队列';
        return `${sourceNames[item.provider]} · ${item.trackCount} 首 · ${mode}`;
    }

    return (
        <Dialog
            visible
            title="一起听 · 音乐空间"
            onClose={music.close}
            animation="zoom"
            maskAnimation="fade"
            className={Style.dialog}
            style={{ width: 'min(720px, 94vw)' }}
        >
            <div className={Style.panel}>
                <p className={Style.hint}>
                    当前聊天独立队列 · 第一首立即播放，后续点歌按顺序排队
                </p>

                <div className={Style.tabs}>
                    {[
                        ['search', '搜索 / 点歌'],
                        ['queue', '播放队列'],
                        ['playlist', '导入歌单'],
                        ['account', '网易云账号'],
                    ].map(([id, name]) => (
                        <button
                            type="button"
                            key={id}
                            className={tab === id ? Style.active : ''}
                            onClick={() => setTab(id)}
                        >
                            {name}
                            {id === 'queue'
                                ? ` (${music.room?.queue.length || 0})`
                                : ''}
                        </button>
                    ))}
                </div>

                {['search', 'playlist'].includes(tab) && (
                    <label className={Style.source}>
                        音乐来源
                        <select
                            aria-label="音乐来源"
                            value={music.selectedSource}
                            onChange={(event) =>
                                music.setSource(
                                    event.target.value as MusicProvider,
                                )
                            }
                        >
                            {music.sources.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name}
                                    {item.enabled ? '' : ' · 未配置'}
                                </option>
                            ))}
                        </select>
                    </label>
                )}

                {tab === 'account' && <MusicAccount />}

                {tab === 'search' && (
                    <>
                        <form
                            className={Style.search}
                            onSubmit={(event) => {
                                event.preventDefault();
                                music.search();
                            }}
                        >
                            <input
                                aria-label="搜索歌曲"
                                placeholder={
                                    music.selectedSource === 'local'
                                        ? '搜索本地曲库，留空查看全部'
                                        : '歌曲名 / 歌手'
                                }
                                value={music.keywords}
                                onChange={(event) =>
                                    music.setKeywords(event.target.value)
                                }
                            />
                            <button
                                type="submit"
                                disabled={music.busy || !source?.enabled}
                            >
                                {music.busy ? '搜索中…' : '搜索'}
                            </button>
                        </form>

                        {!source?.enabled && (
                            <p className={Style.notice}>
                                此音乐源尚未配置，当前可以使用本地曲库。
                            </p>
                        )}

                        <div className={Style.results}>
                            {!music.busy &&
                                music.searchResults.length === 0 && (
                                    <p className={Style.empty}>
                                        搜索喜欢的歌，或者切换到本地曲库查看服务器歌曲。
                                    </p>
                                )}

                            {music.searchResults.map((track) => (
                                <div
                                    className={Style.song}
                                    key={track.provider + track.id}
                                >
                                    <div className={Style.songCover}>
                                        {track.cover ? (
                                            <img
                                                src={track.cover}
                                                alt=""
                                            />
                                        ) : (
                                            <MusicIcon size={24} />
                                        )}
                                    </div>
                                    <div className={Style.songText}>
                                        <strong>{track.title}</strong>
                                        <span>
                                            {track.artist} ·{' '}
                                            {formatTime(track.duration)}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={pending}
                                        onClick={() => add(track)}
                                    >
                                        点歌
                                    </button>
                                </div>
                            ))}
                        </div>


                        <p className={Style.hint}>
                            快捷点歌：/music 歌名 · /music local 歌名 · /music search 关键词
                        </p>
                    </>
                )}

                {tab === 'queue' && (
                    <>
                        <p className={Style.hint}>
                            正在播放：
                            {music.room?.current?.title || '暂无'}
                            {music.room?.current?.idle
                                ? '（空闲歌单）'
                                : ''}
                        </p>

                        <div className={Style.results}>
                            {!music.room?.queue.length && (
                                <p className={Style.empty}>
                                    还没有排队的歌曲，去点一首吧。
                                </p>
                            )}

                            {music.room?.queue.map((track, index) => (
                                <div
                                    className={Style.song}
                                    key={track.entryId}
                                >
                                    <span>{index + 1}</span>
                                    <div className={Style.songText}>
                                        <strong>{track.title}</strong>
                                        <span>{track.artist}</span>
                                    </div>
                                    <div className={Style.songActions}>
                                        {music.room?.canControl &&
                                            index > 0 && (
                                                <button
                                                    type="button"
                                                    disabled={pending}
                                                    onClick={() =>
                                                        top(track.entryId)
                                                    }
                                                >
                                                    置顶
                                                </button>
                                            )}
                                        <button
                                            type="button"
                                            disabled={pending}
                                            onClick={() =>
                                                music.act('remove', {
                                                    entryId:
                                                        track.entryId,
                                                })
                                            }
                                        >
                                            移除
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {music.room?.canControl &&
                            Boolean(music.room?.queue.length) && (
                                <div className={Style.queueFooter}>
                                    <button
                                        type="button"
                                        disabled={pending}
                                        className={Style.dangerButton}
                                        onClick={clearQueue}
                                    >
                                        全部清除
                                    </button>
                                </div>
                            )}

                        {music.room?.canControl &&
                            music.room?.current && (
                                <div className={Style.controls}>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            music.act('next')
                                        }
                                    >
                                        立即切到下一首
                                    </button>
                                </div>
                            )}
                    </>
                )}

                {tab === 'playlist' && (
                    <div className={Style.import}>
                        <p>
                            粘贴平台歌单 ID 或网易云完整歌单链接。网易云歌单会按完整 trackIds 保存；支持仅保存、更新和移除。
                        </p>
                        <input
                            aria-label="歌单链接"
                            placeholder="歌单 ID / 链接"
                            value={playlist}
                            onChange={(event) =>
                                setPlaylist(event.target.value)
                            }
                        />

                        <div className={Style.controls}>
                            <button
                                type="button"
                                disabled={pending || !source?.enabled}
                                onClick={() =>
                                    importList('playlist')
                                }
                            >
                                加入点歌队列
                            </button>

                            {music.room?.canControl && (
                                <button
                                    type="button"
                                    disabled={
                                        pending || !source?.enabled
                                    }
                                    onClick={() =>
                                        importList('savePlaylist')
                                    }
                                >
                                    仅保存
                                </button>
                            )}

                            {music.room?.canControl && (
                                <button
                                    type="button"
                                    disabled={
                                        pending || !source?.enabled
                                    }
                                    onClick={() => importList('idle')}
                                >
                                    设为空闲歌单
                                </button>
                            )}

                            {music.room?.canControl && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        music.act('clearIdle')
                                    }
                                >
                                    清空空闲歌单
                                </button>
                            )}
                        </div>

                        <label className={Style.controls}>
                            空闲播放模式
                            <select
                                aria-label="空闲播放模式"
                                value={music.room?.idleMode || 'sequential'}
                                disabled={!music.room?.canControl || music.busy}
                                onChange={(event) => music.act('idleMode', { mode: event.target.value })}
                            >
                                <option value="sequential">顺序播放</option>
                                <option value="random">随机播放</option>
                            </select>
                        </label>
                        <p className={Style.hint}>
                            空闲歌单{' '}
                            {music.room?.idlePlaylist.length || 0}{' '}
                            首。有人点歌时优先播放点歌，队列结束后继续空闲歌单。
                        </p>

                        <div className={Style.savedSection}>
                            <h4>已保存的歌单</h4>

                            {!music.room?.savedPlaylists?.length && (
                                <p className={Style.hint}>
                                    还没有导入过歌单。
                                </p>
                            )}

                            {music.room?.savedPlaylists?.map(
                                (item) => (
                                    <div
                                        className={
                                            Style.savedPlaylist
                                        }
                                        key={item.key}
                                    >
                                        <div
                                            className={
                                                Style.savedText
                                            }
                                        >
                                            <strong>
                                                {sourceNames[
                                                    item.provider
                                                ]}{' '}
                                                · {item.id}
                                            </strong>
                                            <span>
                                                {savedLabel(item)}
                                            </span>
                                        </div>
                                        <div
                                            className={
                                                Style.savedActions
                                            }
                                        >
                                            <button
                                                type="button"
                                                disabled={pending}
                                                onClick={() =>
                                                    importList(
                                                        'playlist',
                                                        item.provider,
                                                        item.id,
                                                    )
                                                }
                                            >
                                                加入队列
                                            </button>
                                            {music.room?.canControl && (
                                                <button
                                                    type="button"
                                                    disabled={pending}
                                                    onClick={() =>
                                                        importList(
                                                            'idle',
                                                            item.provider,
                                                            item.id,
                                                        )
                                                    }
                                                >
                                                    设为空闲
                                                </button>
                                            )}
                                            {music.room?.canControl && (
                                                <button
                                                    type="button"
                                                    disabled={pending}
                                                    onClick={() =>
                                                        refreshSaved(item)
                                                    }
                                                >
                                                    更新
                                                </button>
                                            )}
                                            {music.room?.canControl && (
                                                <button
                                                    type="button"
                                                    disabled={pending}
                                                    className={
                                                        Style.dangerButton
                                                    }
                                                    onClick={() =>
                                                        removeSaved(item)
                                                    }
                                                >
                                                    移除
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ),
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Dialog>
    );
}
