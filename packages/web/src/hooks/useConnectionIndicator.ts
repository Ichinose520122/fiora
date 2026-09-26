import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { State } from '../state/reducer';

/** Debounce only the visual indicator. Sending uses the real Redux connection. */
export default function useConnectionIndicator() {
    const connected = useSelector((state: State) => state.connect);
    const userId = useSelector((state: State) => state.user?._id);
    const [indicator, setIndicator] = useState({ userId, connected });
    useEffect(() => {
        if (connected || indicator.userId !== userId) {
            setIndicator({ userId, connected });
            return undefined;
        }
        const timer = window.setTimeout(() => setIndicator({ userId, connected: false }), 3000);
        return () => window.clearTimeout(timer);
    }, [connected, userId]);
    return connected || (indicator.userId === userId && indicator.connected);
}
