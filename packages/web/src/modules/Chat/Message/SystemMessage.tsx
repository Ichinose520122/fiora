import React, { useState } from 'react';
import { MusicProvider } from '@fiora/utils/music';
import { getPerRandomColor } from '@fiora/utils/getRandomColor';
import { useMusic } from '../../Music/MusicSession';
import Style from './SystemMessage.less';

interface SystemMessageProps {
    message: string;
    username: string;
}

type SearchItem = {
    index: string;
    title: string;
    id: string;
};

function isMusicReply(message: string) {
    return /^(音乐指令|音乐指令未完成|点歌 |搜索结果（|没有找到歌曲|正在播放：|加入了一起听|退出了一起听|已投票切歌|投票通过|暂停了播放|继续播放|已切到下一首|请在音乐面板|账号凭据仅能)/.test(
        message,
    );
}

function parseSearch(message: string): {
    provider: MusicProvider;
    items: SearchItem[];
} | null {
    const header = /^搜索结果（(local|netease|qq)）：/.exec(message);
    if (!header) return null;

    const items = message
        .split('\n')
        .slice(1)
        .map((line) => {
            const match = /^(\d+)\.\s+(.+?)\s+\[([^\]]+)\]$/.exec(
                line.trim(),
            );
            if (!match) return null;
            return {
                index: match[1],
                title: match[2],
                id: match[3],
            };
        })
        .filter(Boolean) as SearchItem[];

    return {
        provider: header[1] as MusicProvider,
        items,
    };
}

function SystemMessage(props: SystemMessageProps) {
    const { message, username } = props;
    const music = useMusic();
    const isMusic = isMusicReply(message);
    const search = parseSearch(message);
    const [pendingId, setPendingId] = useState('');
    const [addedId, setAddedId] = useState('');

    async function add(provider: MusicProvider, id: string) {
        if (pendingId) return;
        setPendingId(id);
        music.join();
        const ok = await music.act('add', { provider, id });
        setPendingId('');
        if (ok) {
            setAddedId(id);
        }
    }

    if (search && search.items.length > 0) {
        return (
            <div className={`${Style.system} ${Style.musicSystem}`}>
                <span className={Style.username}>{username}</span>
                <span className={Style.searchTitle}>
                    搜索结果（{search.provider}）
                </span>

                <div className={Style.searchResults}>
                    {search.items.map((item) => (
                        <div className={Style.searchItem} key={item.id}>
                            <span className={Style.index}>{item.index}.</span>
                            <span className={Style.songName}>
                                {item.title}
                            </span>
                            <button
                                type="button"
                                className={Style.songId}
                                disabled={Boolean(pendingId)}
                                onClick={() =>
                                    add(search.provider, item.id)
                                }
                                title="点击直接点歌"
                            >
                                {pendingId === item.id
                                    ? '点歌中…'
                                    : addedId === item.id
                                      ? `✓ ${item.id}`
                                      : item.id}
                            </button>
                        </div>
                    ))}
                </div>
                <div className={Style.searchHint}>
                    点击歌曲 ID 即可直接加入点歌队列
                </div>
            </div>
        );
    }

    return (
        <div
            className={`system ${Style.system} ${
                isMusic ? Style.musicSystem : ''
            }`}
            style={{
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                color: isMusic ? '#202124' : undefined,
                lineHeight: isMusic ? 1.55 : undefined,
                fontWeight: isMusic ? 500 : undefined,
                textShadow: isMusic ? 'none' : undefined,
            }}
        >
            <span
                style={{
                    color: isMusic
                        ? '#2f5d62'
                        : getPerRandomColor(username),
                }}
            >
                {username}
            </span>
            &nbsp;
            {message}
        </div>
    );
}

export default SystemMessage;
