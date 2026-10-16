import React, { useState } from 'react';
import fetch from '../../../utils/fetch';
import Message from '../../../components/Message';
import Style from './WatchMessage.less';

export default function WatchMessage({ roomId, content }: { roomId: string; content: string }) {
    const [pending, setPending] = useState(false);
    const [failedCover, setFailedCover] = useState('');
    let invitation: { source?: string; title?: string; cover?: string } = {};
    try { invitation = JSON.parse(content) || {}; } catch { /* Legacy invitation. */ }
    const title = typeof invitation.title === 'string' && invitation.title.trim() ? invitation.title : '一起看';
    let cover = '';
    try {
        const url = new URL(invitation.cover || '');
        if (url.protocol === 'https:' && !url.username && !url.password) cover = url.href;
    } catch { /* Cover is optional. */ }
    async function join() {
        if (pending) return;
        const tab = window.open('about:blank', '_blank');
        if (!tab) { Message.error('请允许弹出影院窗口后重试'); return; }
        tab.opener = null;
        setPending(true);
        try {
            const source = invitation.source || '';
            const [error, result] = await fetch<{ url: string }>('watchJoin', { roomId, source });
            if (error || !result) tab.close();
            else tab.location.replace(result.url);
        } catch { tab.close(); Message.error('影院暂时无法打开，请重试'); }
        finally { setPending(false); }
    }
    return <button type="button" className={Style.card} disabled={pending} onClick={join} aria-label={`${title}，进入影院`}>
        {cover && failedCover !== cover ? <img className={Style.cover} src={cover} alt={title} referrerPolicy="no-referrer" onError={() => setFailedCover(cover)} /> : <span className={Style.placeholder} aria-hidden="true">◐</span>}
        <span className={Style.info}><strong>{title}</strong></span>
    </button>;
}
