import IO from 'socket.io-client';
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
import { getStorageValue, setStorageValue } from './utils/storage';

const { dispatch } = store;

const options = {
    transports: ['websocket'],
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

socket.on('connect', async () => {
    const connection = socket.id;
    try {
        const token = await getStorageValue('token');
        if (!socket.connected || connection !== socket.id) return;
        if (!token) { await guest(); action.connect(); return; }
        const [err, res] = await fetch('loginByToken', { token, ...platform }, { toast: false });
        if (!socket.connected || connection !== socket.id) return;
        if (err || !res) { await guest(); action.connect(); return; }
        if (res.token) await setStorageValue('token', res.token);
        if (!socket.connected || connection !== socket.id) return;
        action.setUser(res);
        // Only refresh music and other authenticated data after token login succeeds.
        action.connect();
        const [historyError, linkmans] = await fetch('getLinkmansLastMessagesV2', {
            linkmans: store.getState().linkmans.map((linkman) => linkman._id),
        });
        if (!historyError && linkmans && connection === socket.id && store.getState().user?._id === res._id) {
            action.setLinkmansLastMessages(linkmans);
        }
    } catch {
        if (socket.connected && connection === socket.id) {
            await guest(); action.connect(); Toast.warning('无法恢复登录，请重新登录');
        }
    }
});
socket.on('disconnect', () => {
    dispatch({
        type: ConnectActionType,
        value: false,
    } as ConnectAction);
});
socket.on('message', (message: Message) => {
    const state = store.getState() as State;
    if (!state.user?._id) return;
    const linkman = state.linkmans.find((x) => x._id === message.to);
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
            messages: [],
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
