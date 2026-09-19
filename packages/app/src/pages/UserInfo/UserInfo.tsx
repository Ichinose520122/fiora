import { useAppTheme, useThemedStyles } from '../../utils/theme';
import AccountSettings from '../Other/AccountSettings';
import PageContainer from '../../components/PageContainer';
import React, { useState } from 'react';
import ProfileBoundary from '../../components/ProfileBoundary';
import { Button, Text, View } from '../../components/NativeUI';
import { ScrollView, StyleSheet } from 'react-native';
import { Actions } from '../../navigation';
import SafeAreaView from '../../components/ThemeScreen';
import Avatar from '../../components/Avatar';
import UserTag from '../../components/UserTag';
import { TagStyle } from '../../../../utils/tagStyle';
import {
    useFocusLinkman,
    useIsAdmin,
    useLinkmans,
    useSelfId,
    useUser,
} from '../../hooks/useStore';
import { Linkman } from '../../types/redux';
import action from '../../state/action';
import {
    addFriend,
    deleteFriend,
    getLinkmanHistoryMessages,
    sealUser,
    sealUserOnlineIp,
} from '../../service';
import getFriendId from '../../utils/getFriendId';
import Toast from '../../components/Toast';

type Props = {
    user: {
        _id: string;
        avatar: string;
        tag: string;
        tagStyle?: TagStyle;
        username: string;
    };
};

function UserInfo({ user }: Props) {
    const theme = useAppTheme(); const styles = useThemedStyles(baseStyles);

    const { _id, avatar, username } = user;
    const [editing, setEditing] = useState(false);
    const linkmans = useLinkmans();
    const self = useSelfId();
    const conversationId = self && self !== _id ? getFriendId(self, _id) : '';
    const friend = linkmans.find((linkman) => linkman && linkman.type !== 'group' && linkman._id === conversationId);
    const isFriend = friend && friend.type === 'friend';
    const isAdmin = useIsAdmin();
    const currentLinkman = useFocusLinkman() as Linkman;

    function handleSendMessage() {
        if (!friend) return;
        action.setFocus(friend._id);
        if (currentLinkman?._id === friend._id) {
            Actions.pop();
        } else {
            Actions.popTo('_chatlist');
            Actions.push('chat', { title: friend.name });
        }
    }

    async function handleDeleteFriend() {
        if (!friend) return;
        const isSuccess = await deleteFriend(_id);
        if (isSuccess) {
            action.removeLinkman(friend._id);
            if (currentLinkman?._id === friend._id) {
                Actions.popTo('_chatlist');
            } else {
                Actions.pop();
            }
        }
    }

    async function handleAddFriend() {
        if (!self || self === _id) return;
        const newLinkman = await addFriend(_id);
        const friendId = getFriendId(_id, self);
        if (newLinkman) {
            if (friend) {
                action.updateFriendProperty(friend._id, 'type', 'friend');
                const messages = await getLinkmanHistoryMessages(
                    friend._id,
                    friend.messages.filter((message) => /^[a-f0-9]{24}$/i.test(message._id)).length,
                );
                if (Array.isArray(messages)) action.addLinkmanHistoryMessages(friend._id, messages);
            } else {
                action.addLinkman({
                    ...newLinkman,
                    _id: friendId,
                    name: username,
                    type: 'friend',
                    unread: 0,
                    messages: [],
                    from: self,
                    to: {
                        _id,
                        avatar,
                        username,
                    },
                });
                const messages = await getLinkmanHistoryMessages(friendId, 0);
                if (Array.isArray(messages)) action.addLinkmanHistoryMessages(friendId, messages);
            }
            action.setFocus(friendId);

            if (currentLinkman?._id === friend?._id) {
                Actions.pop();
            } else {
                Actions.popTo('_chatlist');
                Actions.push('chat', { title: newLinkman.username });
            }
        }
    }

    async function handleSealUser() {
        const isSuccess = await sealUser(username);
        if (isSuccess) {
            Toast.success('封禁用户成功');
        }
    }

    async function handleSealIp() {
        const isSuccess = await sealUserOnlineIp(_id);
        if (isSuccess) {
            Toast.success('封禁用户当前ip成功');
        }
    }

    return (
        <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.color('#f3f5fc', 'backgroundColor') }}>
            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.userContainer}>
                    <Avatar userId={_id} src={avatar} size={88} />
                    <Text style={styles.nick}>{username}</Text>
                    {!!user.tag && <View style={{ alignItems: 'center', marginTop: 10 }}><UserTag text={user.tag} tagStyle={user.tagStyle} /></View>}
                </View>
                {self === _id && <Button block style={{ marginTop: 24 }} onPress={() => setEditing(true)}><Text style={{ color: theme.text }}>编辑个人资料</Text></Button>}
                {self !== _id && <View style={styles.buttonContainer}>
                    {isFriend ? (
                        <>
                            <Button
                                primary
                                block
                                style={styles.button}
                                onPress={handleSendMessage}
                            >
                                <Text style={{ color: theme.text }}>发送消息</Text>
                            </Button>
                            <Button
                                primary
                                block
                                danger
                                style={styles.button}
                                onPress={handleDeleteFriend}
                            >
                                <Text style={{ color: theme.text }}>删除好友</Text>
                            </Button>
                        </>
                    ) : (
                        <Button
                            primary
                            block
                            style={styles.button}
                            onPress={handleAddFriend}
                        >
                            <Text style={{ color: theme.text }}>加为好友</Text>
                        </Button>
                    )}
                    {isAdmin && (
                        <>
                            <Button
                                primary
                                block
                                danger
                                style={styles.button}
                                onPress={handleSealUser}
                            >
                                <Text style={{ color: theme.text }}>封禁用户</Text>
                            </Button>
                            <Button
                                primary
                                block
                                danger
                                style={styles.button}
                                onPress={handleSealIp}
                            >
                                <Text style={{ color: theme.text }}>封禁 ip</Text>
                            </Button>
                        </>
                    )}
                </View>}
            </ScrollView>
            {editing && <AccountSettings close={() => setEditing(false)} />}
        </SafeAreaView>
    );
}

export default function UserInfoScreen({ user: suppliedUser, userId }: Partial<Props> & { userId?: string }) {
    const theme = useAppTheme(); const styles = useThemedStyles(baseStyles);

    const ownUser = useUser();
    const targetId = userId || suppliedUser?._id;
    const user = ownUser && targetId === ownUser._id ? ownUser : suppliedUser;
    if (!user || typeof user._id !== 'string' || !/^[a-f0-9]{24}$/i.test(user._id)) {
        return <PageContainer><Text style={{ padding: 24 }}>用户资料暂不可用，请返回后重新打开。</Text></PageContainer>;
    }
    const profile = {
        _id: user._id,
        username: typeof user.username === 'string' ? user.username : '用户',
        avatar: typeof user.avatar === 'string' && user.avatar ? user.avatar : '/avatar/0.jpg',
        tag: typeof user.tag === 'string' ? user.tag : '',
        tagStyle: user.tagStyle && typeof user.tagStyle === 'object' ? user.tagStyle : undefined,
    };
    return <ProfileBoundary key={profile._id}><UserInfo user={profile} /></ProfileBoundary>;
}

const baseStyles = StyleSheet.create({
    container: {
        paddingTop: 32,
        paddingBottom: 24,
        paddingLeft: 16,
        paddingRight: 16,
    },
    userContainer: {
        alignItems: 'center',
    },
    nick: {
        color: '#333',
        marginTop: 6,
    },
    buttonContainer: {
        marginTop: 20,
    },
    button: {
        marginBottom: 12,
    },
});
