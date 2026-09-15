import React from 'react';
import { Text, StyleSheet, View, TouchableOpacity } from 'react-native';
import { Actions } from '../../navigation';

import Time from '../../utils/time';
import action from '../../state/action';

import Avatar from '../../components/Avatar';
import { Linkman as LinkmanType } from '../../types/redux';
import { formatLinkmanName } from '../../utils/linkman';
import fetch from '../../utils/fetch';

type Props = {
    id: string;
    name: string;
    avatar: string;
    preview: string;
    time: Date;
    unread: number;
    lastMessageId: string;
    linkman: LinkmanType;
};

export default function Linkman({
    id,
    name,
    avatar,
    preview,
    time,
    unread,
    lastMessageId,
    linkman,
}: Props) {
    function formatTime() {
        const nowTime = new Date();
        if (Time.isToday(nowTime, time)) {
            return Time.getHourMinute(time);
        }
        if (Time.isYesterday(nowTime, time)) {
            return '昨天';
        }
        if (Time.isSameYear(nowTime, time)) {
            return Time.getMonthDate(time);
        }
        return Time.getYearMonthDate(time);
    }

    function handlePress() {
        action.setFocus(id);
        Actions.chat({ title: formatLinkmanName(linkman) });

        if (id && /^[a-f0-9]{24}$/i.test(lastMessageId)) {
            fetch('updateHistory', { linkmanId: id, messageId: lastMessageId });
        }
    }

    return (
        <TouchableOpacity onPress={handlePress}>
            <View style={styles.container}>
                <Avatar src={avatar} size={50} />
                <View style={styles.content}>
                    <View style={styles.nickTime}>
                        <Text numberOfLines={1} style={styles.nick}>{name}</Text>
                        <Text style={styles.time}>{formatTime()}</Text>
                    </View>
                    <View style={styles.previewUnread}>
                        <Text style={styles.preview} numberOfLines={1}>
                            {preview}
                        </Text>
                        {unread > 0 ? (
                            <View style={styles.unread}>
                                <Text style={styles.unreadText}>
                                    {unread > 99 ? '99' : unread}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        minHeight: 83,
        marginHorizontal: 12, marginVertical: 4, borderRadius: 21, backgroundColor: '#ffffffa8', borderWidth: 1, borderColor: '#ffffffc9',
        alignItems: 'center',
        paddingLeft: 16,
        paddingRight: 16,
    },
    content: {
        flex: 1,
        marginLeft: 13,
    },
    nickTime: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    nick: {
        fontSize: 15, fontWeight: '600', flex: 1, marginRight: 12,
        color: '#34415a',
    },
    time: {
        fontSize: 10,
        color: '#99a3b8',
    },
    previewUnread: {
        marginTop: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    preview: {
        flex: 1,
        fontSize: 14,
        color: '#8995ab',
    },
    unread: {
        backgroundColor: '#8a9bce',
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 5,
    },
    unreadText: {
        fontSize: 10,
        color: 'white',
    },
});
