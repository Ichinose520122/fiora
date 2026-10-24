import React, { useState } from 'react';
import fetch from '../../../utils/fetch';
import Message from '../../../components/Message';
import Style from './WatchMessage.less';

export default function WatchMessage({ roomId, content }: { roomId: string; content: string }) {
    const [pending, setPending] = useState(false);
    const [failedCover, setFailedCover] = useState('');
    let invitation: { source?: string; title?: string; cover?: string } = {};
    try {
        invitation = JSON.parse(content) || {};
    } catch {
        /* Legacy invitation. */
    }
    const title =
        typeof invitation.title === 'string' && invitation.title.trim()
            ? invitation.title.trim()
            : '放映室';
    let cover = '';
    try {
        const url = new URL(invitation.cover || '');
        if (url.protocol === 'https:' && !url.username && !url.password) {
            cover = url.href;
        }
    } catch {
        /* Cover is optional. */
    }
    async function join() {
        if (pending) return;
        const tab = window.open('about:blank', '_blank');
        if (!tab) {
            Message.error('请允许弹出放映室窗口后重试');
            return;
        }
        tab.opener = null;
        setPending(true);
        try {
            const source = invitation.source || '';
            const [error, result] = await fetch<{ url: string }>('watchJoin', {
                roomId,
                source,
            });
            if (error || !result) tab.close();
            else tab.location.replace(result.url);
        } catch {
            tab.close();
            Message.error('放映室暂时无法打开，请重试');
        } finally {
            setPending(false);
        }
    }
    return (
        <button
            type="button"
            className={Style.card}
            disabled={pending}
            onClick={join}
            aria-label={`${title}，进入放映室`}
            aria-busy={pending}
        >
            <span className={Style.poster}>
                {cover && failedCover !== cover ? (
                    <img
                        className={Style.cover}
                        src={cover}
                        alt={title}
                        referrerPolicy="no-referrer"
                        onError={() => setFailedCover(cover)}
                    />
                ) : (
                    <span className={Style.placeholder} aria-hidden="true">
                        <svg viewBox="0 0 40 40" fill="none">
                            <rect x="6" y="7" width="28" height="26" rx="5" />
                            <path d="M11 7v26M29 7v26M6 13h5M6 20h5M6 27h5M29 13h5M29 20h5M29 27h5" opacity="0.45" />
                            <path d="M17.5 15.5 25 20l-7.5 4.5v-9Z" fill="currentColor" stroke="none" />
                        </svg>
                    </span>
                )}
            </span>
            <span className={Style.info}>
                <strong className={Style.title} title={title}>
                    {title}
                </strong>
                <span className={`${Style.join}${pending ? ` ${Style.joinPending}` : ''}`}>
                    <span>{pending ? '正在进入…' : '进入放映室'}</span>
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M3.5 8h8.5M8.5 4.5 12 8l-3.5 3.5" />
                    </svg>
                </span>
            </span>
        </button>
    );
}
