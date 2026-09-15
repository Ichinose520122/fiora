import { View, Icon } from '../../components/NativeUI';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Actions } from '../../navigation';
import { useFocusLinkman, useSelfId } from '../../hooks/useStore';

function ChatRightButton() {
    const linkman = useFocusLinkman();
    const self = useSelfId();

    function handleClick() {
        if (!linkman) return;
        if (linkman.type === 'group') {
            Actions.push('groupProfile');
        } else {
            Actions.push('userInfo', { user: { _id: linkman._id.replace(self, ''), username: linkman.name, avatar: linkman.avatar, tag: '' } });
        }
    }

    return (
        <TouchableOpacity onPress={handleClick}>
            <View style={styles.container}>
                <Icon name="ellipsis-horizontal" style={styles.icon} />
            </View>
        </TouchableOpacity>
    );
}

export default ChatRightButton;

const styles = StyleSheet.create({
    container: {
        width: 44,
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        color: '#6377b4',
        fontSize: 26,
    },
});
