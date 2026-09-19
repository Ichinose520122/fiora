import React, { useEffect, useRef } from 'react';
import {
    StyleSheet,
    ScrollView,
    AppState,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Actions } from '../../navigation';


import MessageList from './MessageList';
import MusicPlayer from '../../modules/Music/MusicPlayer';
import MusicPanel from '../../modules/Music/MusicPanel';
import Input from './Input';
import PageContainer from '../../components/PageContainer';
import { Friend, Group, Linkman } from '../../types/redux';
import {
    useFocusLinkman,
    useIsLogin,
    useSelfId,
    useStore,
} from '../../hooks/useStore';
import {
    getDefaultGroupOnlineMembers,
    getGroupOnlineMembers,
    getUserOnlineStatus,
} from '../../service';
import action from '../../state/action';
import { formatLinkmanName } from '../../utils/linkman';
import fetch from '../../utils/fetch';




export default function Chat() {
    return <ChatContent />;
}
function ChatContent() {
    const history = useRef({ acknowledged: '', busy: false });
    const isLogin = useIsLogin();
    const self = useSelfId();
    const { focus } = useStore();
    const linkman = useFocusLinkman();
    const $messageList = useRef<ScrollView>(null);

    async function fetchGroupOnlineMembers() {
        let onlineMembers: Group['members'] = [];
        if (isLogin) {
            onlineMembers = await getGroupOnlineMembers(focus);
        } else {
            onlineMembers = await getDefaultGroupOnlineMembers();
        }
        if (onlineMembers) {
            action.updateGroupProperty(focus, 'members', onlineMembers);
        }
    }
    async function fetchUserOnlineStatus() {
        const isOnline = await getUserOnlineStatus(focus.replace(self, ''));
        action.updateFriendProperty(focus, 'isOnline', isOnline);
    }
    useEffect(() => {
        if (!linkman || !isLogin) {
            return;
        }
        const request =
            linkman.type === 'group'
                ? fetchGroupOnlineMembers
                : fetchUserOnlineStatus;
        request();
        const timer = setInterval(() => request(), 1000 * 60);
        return () => clearInterval(timer);
    }, [focus, isLogin]);

    useEffect(() => {
        if (!linkman || Actions.currentScene !== 'chat') {
            return;
        }
        Actions.refresh({
            title: formatLinkmanName(linkman as Linkman),
        });
    }, [(linkman as Group)?.members, (linkman as Friend)?.isOnline]);

    async function intervalUpdateHistory() {
        if (isLogin && linkman && AppState.currentState === 'active' && Actions.currentScene === 'chat') {
            if (linkman.messages.length > 0) {
                const lastMessageId =
                    linkman.messages[linkman.messages.length - 1]._id;
                if (!history.current.busy && `${self}:${focus}:${lastMessageId}` !== history.current.acknowledged) {
                    if (!/^[a-f0-9]{24}$/i.test(lastMessageId)) return;
                    history.current.busy = true;
                    try {
                        const [error] = await fetch('updateHistory', { linkmanId: focus, messageId: lastMessageId }, { toast: false });
                        if (!error) history.current.acknowledged = `${self}:${focus}:${lastMessageId}`;
                    } finally { history.current.busy = false; }
                }
            }
        }
    }
    useEffect(() => {
        const timer = setInterval(intervalUpdateHistory, 1000 * 5);
        return () => clearInterval(timer);
    }, [focus, isLogin, linkman?.messages]);

    return (
        <PageContainer disableSafeAreaView>
            <KeyboardAvoidingView
                style={styles.container}
                behavior="padding"
                automaticOffset
            >
                <MusicPlayer />
                <MessageList key={`${self}:${focus}`} $scrollView={$messageList} />
                <Input key={`${self}:${focus}`} />
                <MusicPanel />
            </KeyboardAvoidingView>
        </PageContainer>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
