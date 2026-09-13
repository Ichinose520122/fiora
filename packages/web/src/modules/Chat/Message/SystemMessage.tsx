import React from 'react';
import { getPerRandomColor } from '@fiora/utils/getRandomColor';

interface SystemMessageProps {
    message: string;
    username: string;
}

function isMusicReply(message: string) {
    return /^(音乐指令|音乐指令未完成|点歌 |搜索结果（|没有找到歌曲|正在播放：|加入了一起听|退出了一起听|已投票切歌|投票通过|暂停了播放|继续播放|已切到下一首|请在音乐面板|账号凭据仅能)/.test(message);
}

function SystemMessage(props: SystemMessageProps) {
    const { message, username } = props;
    const music = isMusicReply(message);

    return (
        <div
            className="system"
            style={{
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                color: music ? '#355f69' : undefined,
                lineHeight: music ? 1.55 : undefined,
                fontWeight: music ? 500 : undefined,
            }}
        >
            <span style={{ color: music ? '#4d9394' : getPerRandomColor(username) }}>
                {username}
            </span>
            &nbsp;
            {message}
        </div>
    );
}

export default SystemMessage;
