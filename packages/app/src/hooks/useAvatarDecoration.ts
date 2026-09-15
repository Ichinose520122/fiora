import { useEffect, useState } from 'react';
import fetch from '../utils/fetch';
import { AvatarDecoration } from '../../../utils/avatarDecoration';
const cache = new Map<string, AvatarDecoration>();
const listeners = new Map<string, Set<() => void>>();
let timer: ReturnType<typeof setTimeout> | undefined;
let busy = false;
export function refreshAvatarDecorations() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
        if (busy) { refreshAvatarDecorations(); return; }
        busy = true;
        try {
            const ids = [...listeners.keys()];
            for (let i = 0; i < ids.length; i += 40) {
                const [error, result] = await fetch<Array<AvatarDecoration & { _id: string }>>('getAvatarDecorations', { userIds: ids.slice(i, i + 40) }, { toast: false });
                if (!error && Array.isArray(result)) result.forEach((item) => { cache.set(item._id, item); listeners.get(item._id)?.forEach((notify) => notify()); });
            }
        } finally { busy = false; if (listeners.size) timer = setTimeout(refreshAvatarDecorations, 60000); }
    }, 80);
}
export default function useAvatarDecoration(userId?: string) {
    const [, update] = useState(0);
    useEffect(() => {
        if (!userId || !/^[0-9a-f]{24}$/i.test(userId)) return;
        const set = listeners.get(userId) || new Set<() => void>();
        const notify = () => update((value) => value + 1);
        set.add(notify); listeners.set(userId, set);
        refreshAvatarDecorations();
        return () => { set.delete(notify); if (!set.size) listeners.delete(userId); if (!listeners.size && timer) clearTimeout(timer); };
    }, [userId]);
    return userId ? cache.get(userId) : undefined;
}
