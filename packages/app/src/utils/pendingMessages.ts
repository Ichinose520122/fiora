import AsyncStorage from '@react-native-async-storage/async-storage';
import { Message } from '../types/redux';
import store from '../state/store';
import action from '../state/action';

let activeUser = '';
let hydrated = false;
let last = '';
let writes: Promise<unknown> = Promise.resolve();
const key = (userId: string) => `fiora-pending-${userId}`;
// Keep failed/local messages across a process restart. Never replay commands automatically.
store.subscribe(() => {
    const state = store.getState(); const userId = state.user?._id || '';
    if (activeUser !== userId) {
        const previous = activeUser; activeUser = userId; hydrated = false; last = '';
        if (!userId) {
            if (previous) writes = writes.then(() => AsyncStorage.removeItem(key(previous))).catch(() => {});
            return;
        }
        void writes.then(() => AsyncStorage.getItem(key(userId))).then((raw) => {
            if (activeUser !== userId) return;
            const saved: Message[] = raw ? JSON.parse(raw) : [];
            if (Array.isArray(saved)) saved.forEach((message) => {
                if (message?.from?._id !== userId || typeof message.content !== 'string' || typeof message._id !== 'string') return;
                const room = store.getState().linkmans.find((item) => item._id === message.to);
                if (!room || room.messages.some((item) => item._id === message._id)) return;
                action.addLinkmanMessage(message.to, { ...message, loading: false, failed: true, statusText: '', error: '上次发送未完成，请确认消息后重试' });
            });
        }).catch(() => {}).finally(() => { if (activeUser === userId) hydrated = true; });
        return;
    }
    if (!userId || !hydrated) return;
    const pending = state.linkmans.flatMap((room) => room.messages.filter((message) => message.from?._id === userId && (message.loading || message.failed))).slice(-30);
    const json = JSON.stringify(pending);
    if (json === last) return;
    last = json;
    writes = writes.then(() => AsyncStorage.setItem(key(userId), json)).catch(() => {});
});
