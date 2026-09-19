import store from '../state/store';
import { ActionTypes } from '../state/action';

// Retain upload blobs and original payloads only while their local message exists.
const pending = new Map<string, { room: string; user: string; attempt: () => Promise<void>; busy: boolean }>();
function exists(id: string, item: { room: string; user: string }) {
    const state = store.getState();
    return state.user?._id === item.user && !!state.linkmans[item.room]?.messages[id];
}
function update(room: string, id: string, value: object) {
    store.dispatch({ type: ActionTypes.UpdateMessage, payload: { linkmanId: room, messageId: id, value } });
}
store.subscribe(() => {
    pending.forEach((item, id) => { if (!exists(id, item)) pending.delete(id); });
});
export async function retryPendingMessage(id: string) {
    const item = pending.get(id);
    if (!item || item.busy || !exists(id, item)) return;
    item.busy = true;
    update(item.room, id, { loading: true, failed: false, sendError: '' });
    try {
        await item.attempt();
        pending.delete(id);
    } catch (error) {
        if (exists(id, item)) update(item.room, id, {
            loading: false, failed: true,
            sendError: error instanceof Error ? error.message : '发送失败',
        });
    } finally { item.busy = false; }
}
export function runPendingMessage(room: string, id: string, attempt: () => Promise<void>) {
    const user = store.getState().user?._id;
    if (!user) return Promise.resolve();
    pending.set(id, { room, user, attempt, busy: false });
    return retryPendingMessage(id);
}
