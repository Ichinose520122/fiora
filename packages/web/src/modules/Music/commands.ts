export const chatCommands = [
    { value: '/music ', description: '点歌：歌名、ID 或完整链接' },
    { value: '/music search ', description: '搜索歌曲并选择' },
    { value: '/music local ', description: '从本地曲库点歌' },
    { value: '/music netease ', description: '从网易云点歌' },
    { value: '/music qq ', description: '从 QQ 音乐点歌' },
    { value: '/music playlist ', description: '导入歌单 ID 或链接（最多 50 首）' },
    { value: '/music list', description: '打开音乐面板和队列' },
    { value: '/music join', description: '加入当前聊天的一起听' },
    { value: '/music leave', description: '退出一起听' },
    { value: '/music vote', description: '投票切歌' },
    { value: '/music next', description: '群主 / 私聊参与者切歌' },
    { value: '/music pause', description: '群主 / 私聊参与者暂停' },
    { value: '/music resume', description: '继续播放' },
    { value: '-roll', description: '掷骰子 0–100；可追加上限' },
    { value: '-rps', description: '石头剪刀布' },
];
export function commandSuggestions(value: string) {
    if (!value || !/^[/-]/.test(value)) return [];
    return chatCommands.filter((item) => item.value.startsWith(value) && item.value !== value).slice(0, 7);
}

