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
    return (
        <button
            type="button"
            className={Style.card}
            disabled={pending}
            onClick={join}
            aria-label={`${title}，进入影院`}
            aria-busy={pending}
        >
            <span className={Style.poster}>
                {cover && failedCover !== cover ? (
                    <img className={Style.cover} src={cover} alt={title} referrerPolicy="no-referrer" onError={() => setFailedCover(cover)} />
                ) : (
                    <span className={Style.placeholder} aria-hidden="true">
                        <svg viewBox="0 0 40 40" fill="none">
                            <rect x="5" y="8" width="30" height="23" rx="4" />
                            <path d="M17 15.5 25 20l-8 4.5v-9ZM14 35h12M20 31v4" />
                        </svg>
                    </span>
                )}
            </span>
            <span className={Style.info}>
                <span className={Style.eyebrow}>
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <rect x="1.5" y="2.5" width="13" height="9" rx="2" />
                        <path d="M6.5 5 10 7 6.5 9V5ZM5 14h6M8 11.5V14" />
                    </svg>
                    一起看
                </span>
                <strong className={Style.title} title={title}>{title}</strong>
                <span className={Style.join}>
                    <span>{pending ? '正在进入…' : '加入一起看'}</span>
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M3 8h10M9 4l4 4-4 4" />
                    </svg>
                </span>
            </span>
        </button>
    );
}
