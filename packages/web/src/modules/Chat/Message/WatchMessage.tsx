import React, { useState } from 'react';
import fetch from '../../../utils/fetch';
import Message from '../../../components/Message';

export default function WatchMessage({ roomId, content }: { roomId: string; content: string }) {
    const [pending, setPending] = useState(false);
    async function join() {
        if (pending) return;
        const tab = window.open('about:blank', '_blank');
        if (!tab) { Message.error('请允许弹出影院窗口后重试'); return; }
        tab.opener = null;
        setPending(true);
        try {
            let source = '';
            try { source = JSON.parse(content).source || ''; } catch { /* Empty invitation. */ }
            const [error, result] = await fetch<{ url: string }>('watchJoin', { roomId, source });
            if (error || !result) tab.close();
            else tab.location.replace(result.url);
        } catch { tab.close(); Message.error('影院暂时无法打开，请重试'); }
        finally { setPending(false); }
    }
    return <div style={{ padding: 16, minWidth: 220 }}>
        <strong>一起看 · 私人影院</strong>
        <p>在线解析或选择本地视频，与当前聊天成员同步观看。</p>
        <button type="button" disabled={pending} onClick={join}>{pending ? '正在进入…' : '进入影院'}</button>
    </div>;
}
