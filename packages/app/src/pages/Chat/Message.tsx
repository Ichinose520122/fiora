import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    useWindowDimensions,
    TouchableOpacity,
} from 'react-native';
import { Alert } from 'react-native';
import fetch from '../../utils/fetch';
import Toast from '../../components/Toast';

import { ActionSheet } from '../../components/NativeUI';
import { Actions } from '../../navigation';
import Time from '../../utils/time';
import retryFile from '../../utils/retryFile';
import Avatar from '../../components/Avatar';
import { Message as MessageType } from '../../types/redux';
import SystemMessage from './SystemMessage';
import ImageMessage from './ImageMessage';
import TextMessage from './TextMessage';
import FileMessage from './FileMessage';
import UserTag from '../../components/UserTag';
import { getRandomColor } from '../../utils/getRandomColor';
import InviteMessage from './InviteMessage';
import {
    useFocus,
    useIsAdmin,
    useSelfId,
    useTheme,
} from '../../hooks/useStore';
import { deleteMessage } from '../../service';
import action from '../../state/action';



type Props = {
    message: MessageType;
    isSelf: boolean;
    shouldScroll: boolean;
    scrollToEnd: () => void;
    openImageViewer: (imageUrl: string) => void;
};

function Message({
    message,
    isSelf,
    shouldScroll,
    scrollToEnd,
    openImageViewer,
}: Props) {
    const { width } = useWindowDimensions();
    const isAdmin = useIsAdmin();
    const self = useSelfId();
    const focus = useFocus();

    const couldDelete =
        message.type !== 'system' && (isAdmin || message.from._id === self);

    useEffect(() => {
        if (shouldScroll) {
            scrollToEnd();
        }
    }, []);

    async function handleDeleteMessage() {
        const options = ['撤回', '取消'];
        ActionSheet.show(
            {
                options: ['确定', '取消'],
                cancelButtonIndex: options.findIndex(
                    (option) => option === '取消',
                ),
                title: '是否撤回消息?',
            },
            async (buttonIndex) => {
                switch (buttonIndex) {
                    case 0: {
                        const isSuccess = await deleteMessage(message._id);
                        if (isSuccess) {
                            action.deleteLinkmanMessage(focus, message._id);
                        }
                        break;
                    }
                    default: {
                        break;
                    }
                }
            },
        );
    }

    function formatTime() {
        const createTime = new Date(message.createTime);
        const nowTime = new Date();
        if (Time.isToday(nowTime, createTime)) {
            return Time.getHourMinute(createTime);
        }
        if (Time.isYesterday(nowTime, createTime)) {
            return `昨天 ${Time.getHourMinute(createTime)}`;
        }
        if (Time.isSameYear(nowTime, createTime)) {
            return `${Time.getMonthDate(createTime)} ${Time.getHourMinute(
                createTime,
            )}`;
        }
        return `${Time.getYearMonthDate(createTime)} ${Time.getHourMinute(
            createTime,
        )}`;
    }

    function handleClickAvatar() {
        Actions.push('userInfo', { user: message.from });
    }

    function renderContent() {
        switch (message.type) {
            case 'text': {
                return <TextMessage message={message} isSelf={isSelf} />;
            }
            case 'image': {
                return (
                    <ImageMessage
                        message={message}
                        openImageViewer={openImageViewer}
                        couldDelete={couldDelete}
                        onLongPress={() => {
                            const options = [];
                            if (message.from._id === self && !message.loading && !message.failed) options.push({ text: '收藏表情', onPress: async () => {
                                const [, data] = await fetch<string[]>('addExpression', { messageId: message._id });
                                if (data) { action.updateUserProperty('expressions', data); Toast.success('已收藏'); }
                            } });
                            if (couldDelete) options.push({ text: '撤回', onPress: handleDeleteMessage });
                            Alert.alert('图片', undefined, [...options, { text: '取消', style: 'cancel' }]);
                        }}
                    />
                );
            }
            case 'system': {
                return <SystemMessage message={message} />;
            }
            case 'inviteV2': {
                return <InviteMessage message={message} isSelf={isSelf} />;
            }
            case 'file': return <FileMessage message={message} />;
            case 'code': {
                return (
                    <Text style={{ color: isSelf ? '#344a71' : '#666' }}>
                        暂未支持的消息类型[
                        {message.type}
                        ], 请在Web端查看
                    </Text>
                );
            }
            default:
                return (
                    <Text style={{ color: isSelf ? '#344a71' : '#666' }}>
                        不支持的消息类型
                    </Text>
                );
        }
    }

    return (
        <View style={[styles.container, isSelf && styles.containerSelf]}>
            {isSelf ? (
                <Avatar userId={message.from._id} src={message.from.avatar} size={38} />
            ) : (
                <TouchableOpacity onPress={handleClickAvatar}>
                    <Avatar userId={message.from._id} src={message.from.avatar} size={38} />
                </TouchableOpacity>
            )}
            <View style={[styles.info, { maxWidth: width - 110 }, isSelf && styles.infoSelf]}>
                <View style={[styles.nickTime, isSelf && styles.nickTimeSelf]}>
                    {!!message.from.tag && <UserTag text={message.from.tag} tagStyle={message.from.tagStyle} />}
                    <Text
                        style={[
                            styles.nick,
                            isSelf ? styles.nickSelf : styles.nickOther,
                        ]}
                    >
                        {message.from.username}
                    </Text>
                    <Text style={[styles.time, isSelf && styles.timeSelf]}>
                        {formatTime()}
                    </Text>
                </View>
                {message.loading && <Text style={{ fontSize: 11, color: '#637087' }}>{message.statusText || '发送中…'}</Text>}
                {message.failed && <TouchableOpacity onPress={() => Alert.alert('发送失败', message.error || '请检查网络后重新发送', message.type === 'file' ? [{ text: '取消', style: 'cancel' }, { text: '重试', onPress: () => { void retryFile(message); } }] : [{ text: '确定' }])}><Text numberOfLines={2} style={{ fontSize: 11, color: '#b54255' }}>{message.error || '发送失败，请重新发送'}</Text></TouchableOpacity>}
                {couldDelete && message.type !== 'image' ? (
                    <TouchableOpacity onLongPress={handleDeleteMessage}>
                        <View
                            style={[
                                styles.content,
                                {
                                    backgroundColor: isSelf
                                        ? '#dee6fa'
                                        : '#ffffffed',
                                },
                            ]}
                        >
                            {renderContent()}
                        </View>
                    </TouchableOpacity>
                ) : (
                    <View
                        style={[
                            styles.content,
                            {
                                backgroundColor: isSelf
                                    ? '#dee6fa'
                                    : '#ffffffed',
                            },
                        ]}
                    >
                        {renderContent()}
                    </View>
                )}

            </View>
        </View>
    );
}

export default React.memo(Message);

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        marginBottom: 12,
        paddingLeft: 8,
        paddingRight: 8,
    },
    containerSelf: {
        flexDirection: 'row-reverse',
    },
    info: {
        position: 'relative',
        marginLeft: 8,
        marginRight: 8,
        flexShrink: 1,
        alignItems: 'flex-start',
    },
    infoSelf: {
        alignItems: 'flex-end',
    },
    nickTime: {
        flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', rowGap: 4,
    },
    nickTimeSelf: {
        flexDirection: 'row-reverse',
    },
    nick: {
        fontSize: 11, flexShrink: 1,
        color: '#72829b',
    },
    nickSelf: {
        marginRight: 4,
    },
    nickOther: {
        marginLeft: 4,
    },
    time: {
        fontSize: 9,
        color: '#a0abc0',
        marginLeft: 4,
    },
    timeSelf: {
        marginRight: 4,
    },
    content: {
        marginTop: 3,
        borderRadius: 17,
        padding: 9,
        paddingLeft: 12,
        paddingRight: 12,
        backgroundColor: 'white',
        minHeight: 26,
        minWidth: 20,
        marginBottom: 12,
    },
    triangle: {
        position: 'absolute',
        top: 25,
    },
    triangleSelf: {
        right: -5,
    },
    triangleOther: {
        left: -5,
    },
    tag: {
        height: 14,
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: 3,
        paddingRight: 3,
        borderRadius: 3,
    },
    tagText: {
        fontSize: 11,
        color: 'white',
    },
});
