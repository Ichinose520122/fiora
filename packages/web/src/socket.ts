import IO from 'socket.io-client';
import platform from 'platform';

import convertMessage from '@fiora/utils/convertMessage';
import getFriendId from '@fiora/utils/getFriendId';
import { TagStyle } from '@fiora/utils/tagStyle';
import config from '@fiora/config/client';
import notification from './utils/notification';
import voice from './utils/voice';
import { initOSS } from './utils/uploadFile';
import playSound from './utils/playSound';
import { Message, Linkman } from './state/reducer';
import {
    ActionTypes,
    SetLinkmanPropertyPayload,
    AddLinkmanHistoryMessagesPayload,
    AddLinkmanMessagePayload,
    DeleteMessagePayload,
} from './state/action';
import {
    loginByTokenWithError,
    getLinkmanHistoryMessages,
    getLinkmansLastMessagesV2,
    syncLinkmanMessages,
} from './service';
import store from './state/store';
import installConnectionRecovery from './utils/connectionRecovery';
import recoverMessages from './utils/recoverMessages';

const { dispatch } = store;

const options = {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 20000,
};
const socket = IO(config.server, options);

function reconnectIfNeeded() {
    if (socket.disconnected && navigator.onLine !== false) {
        socket.connect();
    }
}

let sessionVersion = 0;
let restoringSession = false;
let syncAfterResume: (() => boolean) | undefined;
let restoreTimer: number | undefined;
const InvalidTokenErrors = new Set([
    '非法token', 'token已过期', '非法登录', '用户不存在', 'token不能为空',
]);

async function restoreSession() {
    const version = ++sessionVersion;
    syncAfterResume = undefined;
    const token = window.localStorage.getItem('token');
    const isCurrent = () =>
        version === sessionVersion &&
        socket.connected &&
        token === window.localStorage.getItem('token');
    window.clearTimeout(restoreTimer);
    restoringSession = true;
    dispatch({ type: ActionTypes.Ready, payload: '' });
    // Transport connected does not yet mean authentication/history are ready.
    if (!store.getState().connect) {
        dispatch({ type: ActionTypes.Disconnect, payload: '' });
    }

    function retryRestore() {
        if (!isCurrent()) {
            return;
        }
        restoreTimer = window.setTimeout(() => {
            if (isCurrent() && navigator.onLine !== false) {
                restoreSession();
            }
        }, 5000);
    }

    try {
        if (token) {
            const [error, user] = await loginByTokenWithError(
                token,
                platform.os?.family,
                platform.name,
                platform.description,
            );
            if (!isCurrent()) {
                return;
            }
            if (error || !user) {
                if (!error || !InvalidTokenErrors.has(error)) {
                    retryRestore();
                    return;
                }
                window.localStorage.removeItem('token');
                dispatch({ type: ActionTypes.Logout, payload: '' });
            } else {
                const restoringUser = store.getState().user?._id === user._id;
                dispatch({
                    type: restoringUser ? ActionTypes.RestoreUser : ActionTypes.SetUser,
                    payload: user,
                });
                // Login is ready even while history is catching up.
                dispatch({ type: ActionTypes.Connect, payload: '' });
                initOSS().catch(() => undefined);
                const remaining = new Set<string>(Object.keys(store.getState().linkmans));
                let syncingHistory = false;
                let syncAgain = false;
                async function syncHistory() {
                    if (syncingHistory || !isCurrent()) return;
                    syncingHistory = true;
                    try {
                        const { focus } = store.getState();
                        const ids = [...remaining].sort((a, b) => Number(b === focus) - Number(a === focus));
                        const emptyLinkmans: string[] = [];
                        for (const id of ids) {
                            if (!isCurrent()) return;
                            const room = store.getState().linkmans[id];
                            if (!room) { remaining.delete(id); continue; }
                            const baseline = room.messages;
                            try {
                                // eslint-disable-next-line no-await-in-loop
                                const recovered = await recoverMessages(id, baseline, syncLinkmanMessages, isCurrent);
                                if (!isCurrent()) return;
                                if (recovered === null) emptyLinkmans.push(id);
                                else {
                                    recovered.forEach(convertMessage);
                                    if (store.getState().linkmans[id]) dispatch({
                                        type: ActionTypes.MergeRecoveredMessages,
                                        payload: { linkmanId: id, messages: recovered, baseline },
                                    });
                                    remaining.delete(id);
                                }
                            } catch (_) {
                                // A failed room must not prevent other conversations catching up.
                            }
                        }
                        for (let offset = 0; offset < emptyLinkmans.length; offset += 100) {
                            const batchIds = emptyLinkmans.slice(offset, offset + 100);
                            // eslint-disable-next-line no-await-in-loop
                            const batch = await getLinkmansLastMessagesV2(batchIds);
                            if (!isCurrent()) return;
                            if (batch) {
                                Object.values(batch).forEach(({ messages }: any) => messages.forEach(convertMessage));
                                dispatch({ type: ActionTypes.SetLinkmansLastMessages, payload: batch });
                                batchIds.forEach((id) => { if (batch[id]) remaining.delete(id); });
                            }
                        }
                    } finally {
                        syncingHistory = false;
                        const resumedDuringSync = syncAgain;
                        syncAgain = false;
                        if (resumedDuringSync) Object.keys(store.getState().linkmans).forEach((id) => remaining.add(id));
                        // Resume catch-up immediately; failed history alone uses a backoff.
                        if (isCurrent() && remaining.size) restoreTimer = window.setTimeout(() => {
                            if (isCurrent()) void syncHistory().catch(() => undefined);
                        }, resumedDuringSync ? 0 : 5000);
                    }
                }
                syncAfterResume = () => {
                    if (!isCurrent()) return false;
                    if (syncingHistory) { syncAgain = true; return true; }
                    window.clearTimeout(restoreTimer);
                    Object.keys(store.getState().linkmans).forEach((id) => remaining.add(id));
                    void syncHistory().catch(() => undefined);
                    return true;
                };
                void syncHistory().catch(() => undefined);
                return;
            }
        }
        dispatch({ type: ActionTypes.Connect, payload: '' });
        dispatch({
            type: ActionTypes.SetStatus,
            payload: { key: 'loginRegisterDialogVisible', value: true },
        });
    } catch (error) {
        retryRestore();
    } finally {
        if (version === sessionVersion) {
            restoringSession = false;
        }
    }
}

socket.on('connect', restoreSession);

socket.on('disconnect', (reason) => {
    sessionVersion += 1;
    syncAfterResume = undefined;
    restoringSession = false;
    window.clearTimeout(restoreTimer);
    // @ts-ignore
    dispatch({ type: ActionTypes.Disconnect, payload: null });

    // 服务端主动断开时 Socket.IO 不会自动重连, 这里补一次恢复尝试
    if (reason === 'io server disconnect') {
        window.setTimeout(reconnectIfNeeded, 1000);
    }
});

let windowStatus = 'focus';
window.onfocus = () => {
    windowStatus = 'focus';
};
window.onblur = () => {
    windowStatus = 'blur';
};
installConnectionRecovery(socket, () => restoringSession, () => {
    // Keep the transport, but block sends until the lost login is restored.
    dispatch({ type: ActionTypes.Disconnect, payload: '' });
    void restoreSession();
}, {
    onStart: () => {
        // A stale connected flag is insufficient after background suspension.
        if (store.getState().user?._id && window.localStorage.getItem('token')) {
            dispatch({ type: ActionTypes.Disconnect, payload: '' });
        }
    },
    onReady: () => {
        if (store.getState().user?._id && window.localStorage.getItem('token')) {
            // Interactive login may not yet have installed a recovery session.
            if (syncAfterResume?.()) dispatch({ type: ActionTypes.Connect, payload: '' });
            else void restoreSession();
        }
    },
});

let prevFrom: string | null = '';
let prevName = '';
socket.on('message', async (message: any) => {
    convertMessage(message);

    const state = store.getState();
    const isSelfMessage = message.from._id === state.user?._id;
    if (isSelfMessage && message.from.tag !== state.user?.tag) {
        dispatch({
            type: ActionTypes.UpdateUserInfo,
            payload: {
                tag: message.from.tag,
            },
        });
    }
    if (
        isSelfMessage &&
        message.from.tagStyle &&
        JSON.stringify(message.from.tagStyle) !==
            JSON.stringify(state.user?.tagStyle)
    ) {
        dispatch({
            type: ActionTypes.UpdateUserInfo,
            payload: {
                tagStyle: message.from.tagStyle,
            },
        });
    }

    const linkman = state.linkmans[message.to];
    let title = '';
    if (linkman) {
        dispatch({
            type: ActionTypes.AddLinkmanMessage,
            payload: {
                linkmanId: message.to,
                message,
            } as AddLinkmanMessagePayload,
        });
        if (linkman.type === 'group') {
            title = `${message.from.username} 在 ${linkman.name} 对大家说:`;
        } else {
            title = `${message.from.username} 对你说:`;
        }
    } else {
        // 联系人不存在并且是自己发的消息, 不创建新联系人
        if (isSelfMessage) {
            return;
        }
        const newLinkman = {
            _id: getFriendId(state.user?._id as string, message.from._id),
            type: 'temporary',
            createTime: Date.now(),
            avatar: message.from.avatar,
            name: message.from.username,
            messages: [],
            unread: 1,
        };
        dispatch({
            type: ActionTypes.AddLinkman,
            payload: {
                linkman: newLinkman as unknown as Linkman,
                focus: false,
            },
        });
        title = `${message.from.username} 对你说:`;

        const messages = await getLinkmanHistoryMessages(newLinkman._id, 0);
        if (messages) {
            dispatch({
                type: ActionTypes.AddLinkmanHistoryMessages,
                payload: {
                    linkmanId: newLinkman._id,
                    messages,
                } as AddLinkmanHistoryMessagesPayload,
            });
        }
    }

    if (windowStatus === 'blur' && state.status.notificationSwitch) {
        notification(
            title,
            message.from.avatar,
            message.type === 'text'
                ? message.content.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                : `[${message.type}]`,
            Math.random().toString(),
        );
    }

    if (state.status.soundSwitch) {
        const soundType = state.status.sound;
        playSound(soundType);
    }

    if (state.status.voiceSwitch) {
        if (message.type === 'text') {
            const text = message.content
                .replace(
                    /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/g,
                    '',
                )
                .replace(/#/g, '');

            if (text.length > 100) {
                return;
            }

            const from =
                linkman && linkman.type === 'group'
                    ? `${message.from.username}${
                        linkman.name === prevName ? '' : `在${linkman.name}`
                    }说`
                    : `${message.from.username}对你说`;
            if (text) {
                voice.push(
                    from !== prevFrom ? from + text : text,
                    message.from.username,
                );
            }
            prevFrom = from;
            prevName = message.from.username;
        } else if (message.type === 'system') {
            voice.push(message.from.originUsername + message.content, '');
            prevFrom = null;
        }
    }
});

socket.on(
    'changeGroupName',
    ({ groupId, name }: { groupId: string; name: string }) => {
        dispatch({
            type: ActionTypes.SetLinkmanProperty,
            payload: {
                linkmanId: groupId,
                key: 'name',
                value: name,
            } as SetLinkmanPropertyPayload,
        });
    },
);

socket.on('deleteGroup', ({ groupId }: { groupId: string }) => {
    dispatch({
        type: ActionTypes.RemoveLinkman,
        payload: groupId,
    });
});

socket.on('changeTag', (tag: string) => {
    dispatch({
        type: ActionTypes.UpdateUserInfo,
        payload: {
            tag,
        },
    });
});

socket.on('changeTagStyle', (tagStyle: TagStyle) => {
    dispatch({
        type: ActionTypes.UpdateUserInfo,
        payload: {
            tagStyle,
        },
    });
});

socket.on(
    'deleteMessage',
    ({
        linkmanId,
        messageId,
        isAdmin,
    }: {
        linkmanId: string;
        messageId: string;
        isAdmin: boolean;
    }) => {
        dispatch({
            type: ActionTypes.DeleteMessage,
            payload: {
                linkmanId,
                messageId,
                shouldDelete: isAdmin,
            } as DeleteMessagePayload,
        });
    },
);

export default socket;
