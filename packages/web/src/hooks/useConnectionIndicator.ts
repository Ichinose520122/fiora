import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { State } from '../state/reducer';

/** Preserve the last online presentation while a returning tab repairs its session. */
export default function useConnectionIndicator() {
    const connected = useSelector((state: State) => state.connect);
    const userId = useSelector((state: State) => state.user?._id);
    const [indicator, setIndicator] = useState({ userId, connected });
    const lastOnline = useRef({ userId, connected });
    const foregroundUntil = useRef(0);
    const wasHidden = useRef(document.hidden);
    useEffect(() => {
        if (lastOnline.current.userId !== userId) {
            lastOnline.current = { userId, connected };
            foregroundUntil.current = 0;
            setIndicator({ userId, connected });
        }
        if (connected) {
            lastOnline.current.connected = true;
            setIndicator({ userId, connected: true });
        }
        let timer: number | undefined;
        const schedule = () => {
            window.clearTimeout(timer);
            if (connected || document.hidden || wasHidden.current) return;
            const delay = Math.max(3000, foregroundUntil.current - Date.now());
            timer = window.setTimeout(() => {
                // A throttled background timeout must not flash offline on the first frame back.
                if (!document.hidden && !wasHidden.current) setIndicator({ userId, connected: false });
            }, delay);
        };
        const resume = () => {
            if (document.hidden) return;
            wasHidden.current = false;
            foregroundUntil.current = Date.now() + 12000;
            if (lastOnline.current.connected) setIndicator({ userId, connected: true });
            schedule();
        };
        const visibility = () => {
            if (document.hidden) {
                wasHidden.current = true;
                window.clearTimeout(timer);
            } else resume();
        };
        const suspend = () => {
            wasHidden.current = true;
            window.clearTimeout(timer);
        };
        document.addEventListener('visibilitychange', visibility);
        document.addEventListener('freeze', suspend);
        document.addEventListener('resume', resume);
        window.addEventListener('pagehide', suspend);
        window.addEventListener('pageshow', resume);
        window.addEventListener('focus', resume);
        if (wasHidden.current && !document.hidden) resume();
        else schedule();
        return () => {
            window.clearTimeout(timer);
            document.removeEventListener('visibilitychange', visibility);
            document.removeEventListener('freeze', suspend);
            document.removeEventListener('resume', resume);
            window.removeEventListener('pagehide', suspend);
            window.removeEventListener('pageshow', resume);
            window.removeEventListener('focus', resume);
        };
    }, [connected, userId]);
    return connected || (indicator.userId === userId && indicator.connected);
}
