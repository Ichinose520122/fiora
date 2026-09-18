import './utils/pendingMessages';
import IO from 'socket.io-client';
import { notifyMessage } from './utils/messageNotifications';
import { serverUrl } from './config';
import { socketRequest } from './utils/socketRequest';
import Toast from './components/Toast';
import action from './state/action';
import store from './state/store';
import {
    AddLinkmanAction,
    AddLinkmanActionType,
    AddLinkmanHistoryMessagesAction,
    AddLinkmanHistoryMessagesActionType,
    AddlinkmanMessageAction,
    AddlinkmanMessageActionType,
    ConnectAction,
    ConnectActionType,
    DeleteLinkmanMessageAction,
    DeleteLinkmanMessageActionType,
    Friend,
    Group,
    Message,
    RemoveLinkmanAction,
    RemoveLinkmanActionType,
    SetGuestAction,
    SetGuestActionType,
    State,
    Temporary,
    UpdateGroupPropertyAction,
    UpdateGroupPropertyActionType,
    UpdateUserPropertyAction,
    UpdateUserPropertyActionType,
    User,
} from './types/redux';
import getFriendId from './utils/getFriendId';
import platform from './utils/platform';
import { readSession, clearSession, sessionGeneration } from './utils/session';
import { AppState } from 'react-native';

const { dispatch } = store;

const options = {
    transports: ['websocket'],
    reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 10000, timeout: 15000,
};

const host = serverUrl;
const socket = IO(host, options);

async function fetch<T = any>(event: string, data: any = {}, { toast = true } = {}): Promise<[string | null, T | null]> {
    const result = await socketRequest<T>(socket, event, data);
    if (result[0] && toast) Toast.danger(result[0]);
    return result;
}

async function guest() {
    action.logout();
}

let restoreTimer: ReturnType<typeof setTimeout> | undefined;
let restoreSequence = 0;
let restoring = false;
function retryRestore() {
    if (restoreTimer) clearTimeout(restoreTimer);
    restoreTimer = setTimeout(() => { void restoreSession(); }, 5000);
}
async function restoreSession() {
    if (!socket.connected || restoring) return;
    restoring = true;
    const connection = socket.id;
    const sequence = ++restoreSequence;
    const generation = sessionGeneration();
    const current = () => socket.connected && connection === socket.id && sequence === restoreSequence && generation === sessionGeneration();
    try {
        const session = await readSession();
        if (!current()) return;
        if (!session) { action.connect(); return; }
        const [err, res] = await fetch('loginByToken', { ...platform, ...session }, { toast: false });
        if (!current()) return;
        if (err || !res) {
            if (err && /token.*(过期|非法)|非法token|非法登录|用户不存在/i.test(err)) {
                await clearSession(); action.logout(); action.connect();
                Toast.warning('登录已失效，请重新登录');
            } else { action.disconnect(); retryRestore(); }
            return;
        }
        action.setUser(res); action.connect();
        // History failures do not invalidate an otherwise authenticated session.
        const [historyError, linkmans] = await fetch('getLinkmansLastMessagesV2', {
            linkmans: store.getState().linkmans.map((linkman) => linkman._id),
        }, { toast: false });
        if (!historyError && linkmans && current() && store.getState().user?._id === res._id) { action.setLinkmansLastMessages(linkmans); notifyMissed(linkmans, res._id); }
    } catch { if (current()) { action.disconnect(); retryRestore(); } }
    finally { if (sequence === restoreSequence) restoring = false; }
}
socket.on('connect', () => { void restoreSession(); });
function notifyMissed(rooms: any, userId: string) {
    if (AppState.currentState === 'active') return;
    for (const [roomId, data] of Object.entries(rooms) as [string, any][]) {
        if (!data?.unread || !Array.isArray(data.messages)) continue;
        const latest = data.messages.filter((message: Message) => message.from?._id !== userId).pop();
        const room = store.getState().linkmans.find((item) => item._id === roomId);
        if (latest) void notifyMessage(latest, roomId, userId, room?.type === 'group' ? room.name : undefined);
    }
}
let refreshing = false;
export async function resumeConnection() {
    if (!socket.connected) { socket.connect(); return; }
    if (!store.getState().connect) { await restoreSession(); return; }
    if (!store.getState().user || refreshing) return;
    refreshing = true;
    const connection = socket.id;
    const userId = store.getState().user?._id;
    try {
        const [err, data] = await socketRequest(socket, 'getLinkmansLastMessagesV2', {
            linkmans: store.getState().linkmans.map((item) => item._id),
        }, 8000);
        if (connection !== socket.id || userId !== store.getState().user?._id) return;
        if (err) { socket.disconnect(); socket.connect(); }
        else if (data) { action.setLinkmansLastMessages(data as any); notifyMissed(data, userId!); }
    } finally { refreshing = false; }
}
AppState.addEventListener('change', (state) => { if (state === 'active') void resumeConnection().catch(() => {}); });
socket.on('disconnect', () => {
    ++restoreSequence; restoring = false;
    if (restoreTimer) clearTimeout(restoreTimer);
    dispatch({
        type: ConnectActionType,
        value: false,
    } as ConnectAction);
});
socket.on('message', (message: Message) => {
    const state = store.getState() as State;
    if (!state.user?._id) return;
    const linkman = state.linkmans.find((x) => x._id === message.to);
    const roomId = linkman?._id || getFriendId(state.user._id, message.from._id);
    void notifyMessage(message, roomId, state.user._id, linkman?.type === 'group' ? linkman.name : undefined);
    if (linkman) {
        dispatch({
            type: AddlinkmanMessageActionType,
            linkmanId: message.to,
            message,
        } as AddlinkmanMessageAction);
    } else {
        const newLinkman: Temporary = {
            _id: getFriendId((state.user as User)._id, message.from._id),
            type: 'temporary',
            createTime: Date.now(),
            avatar: message.from.avatar,
            name: message.from.username,
            messages: [message],
            unread: 1,
        };
        dispatch({
            type: AddLinkmanActionType,
            linkman: newLinkman,
            focus: false,
        } as AddLinkmanAction);

        fetch('getLinkmanHistoryMessages', {
            linkmanId: newLinkman._id,
            existCount: 0,
        }).then(([err, res]) => {
            if (!err) {
                dispatch({
                    type: AddLinkmanHistoryMessagesActionType,
                    linkmanId: newLinkman._id,
                    messages: res,
                } as AddLinkmanHistoryMessagesAction);
            }
        });
    }
});

socket.on(
    'changeGroupName',
    ({ groupId, name }: { groupId: string; name: string }) => {
        dispatch({
            type: UpdateGroupPropertyActionType,
            groupId,
            key: 'name',
            value: name,
        } as UpdateGroupPropertyAction);
    },
);

socket.on('deleteGroup', ({ groupId }: { groupId: string }) => {
    dispatch({
        type: RemoveLinkmanActionType,
        linkmanId: groupId,
    } as RemoveLinkmanAction);
});

socket.on('changeTagStyle', (tagStyle) => action.updateUserProperty('tagStyle', tagStyle));
socket.on('changeTag', (tag: string) => {
    dispatch({
        type: UpdateUserPropertyActionType,
        key: 'tag',
        value: tag,
    } as UpdateUserPropertyAction);
});

socket.on(
    'deleteMessage',
    ({ linkmanId, messageId }: { linkmanId: string; messageId: string }) => {
        dispatch({
            type: DeleteLinkmanMessageActionType,
            linkmanId,
            messageId,
        } as DeleteLinkmanMessageAction);
    },
);

socket.connect();

export default socket;
