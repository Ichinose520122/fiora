import { ThemedText as Text, ThemedTextInput as TextInput } from '../../components/ThemedText';
import { useAppTheme } from '../../utils/theme';
import React, { useState } from 'react';
import { Alert, ScrollView, Share, TouchableOpacity, View } from 'react-native';
import { Actions } from '../../navigation';
import Avatar from '../../components/Avatar';
import PageContainer from '../../components/PageContainer';
import { useFocusLinkman, useSelfId } from '../../hooks/useStore';
import { changeGroupAvatar, changeGroupName, deleteGroup, leaveGroup } from '../../service';
import { chooseImage } from '../../utils/chooseImage';
import action from '../../state/action';
import Toast from '../../components/Toast';
import { serverUrl } from '../../config';
export default function GroupProfile() {
    const theme = useAppTheme();

    const room = useFocusLinkman(); const self = useSelfId();
    const [name, setName] = useState(room?.name || ''); const [busy, setBusy] = useState(false);
    if (!room || room.type !== 'group') return <PageContainer><Text style={{ padding: 24 }}>此群聊已不可用</Text></PageContainer>;
    const owner = room.creator === self;
    async function run(task: () => Promise<void>) { if (busy) return; setBusy(true); try { await task(); } catch (error) { Toast.danger(error instanceof Error ? error.message : '操作失败'); } finally { setBusy(false); } }
    const button = (title: string, press: () => void, danger = false) => <TouchableOpacity disabled={busy} onPress={press} style={{ padding: 15, backgroundColor: theme.color('#ffffffc9', 'backgroundColor'), borderRadius: 14, marginVertical: 6 }}><Text style={{ color: danger ? theme.color('#b85e78', 'color') : theme.color('#52658e', 'color'), textAlign: 'center' }}>{title}</Text></TouchableOpacity>;
    return <PageContainer><ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <View style={{ alignItems: 'center', paddingTop: 12, gap: 12 }}><Avatar src={room.avatar} size={78} /><Text style={{ fontSize: 21, color: theme.color('#32405a', 'color') }}>{room.name}</Text></View>
        {button('分享邀请链接', () => { void Share.share({ message: `${room.name}\n${serverUrl}/invite/group/${room._id}` }); })}
        {owner && <>
            <TextInput value={name} onChangeText={setName} maxLength={50} placeholder="群名称" style={{ padding: 14, borderRadius: 12, backgroundColor: theme.input }} />
            {button('修改群名称', () => { void run(async () => { if (!name.trim()) throw new Error('请输入群名称'); if (await changeGroupName(room._id, name.trim())) { action.updateGroupProperty(room._id, 'name', name.trim()); Toast.success('群名称已更新'); } }); })}
            {button('更换群头像', () => { void run(async () => { const url = await chooseImage('GroupAvatar', self); if (url && await changeGroupAvatar(room._id, url)) { action.updateGroupProperty(room._id, 'avatar', url); Toast.success('群头像已更新'); } }); })}
        </>}
        <Text style={{ marginTop: 16, fontSize: 17 }}>在线成员 · {room.members?.length || 0}</Text>
        {(room.members || []).filter((member) => member?.user?._id).map((member) => <TouchableOpacity key={member._id} onPress={() => Actions.userInfo({ user: member.user })} onLongPress={() => Alert.alert('设备信息', member.environment || '')} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12, backgroundColor: theme.color('#ffffffa0', 'backgroundColor'), borderRadius: 15 }}><Avatar src={member.user.avatar} userId={member.user._id} size={36} /><View style={{ flex: 1 }}><Text style={{ color: theme.text }}>{member.user.username}</Text><Text style={{ fontSize: 11, color: theme.color('#8995ab', 'color'), marginTop: 4 }}>{member.browser} {member.os}</Text></View></TouchableOpacity>)}
        {button(owner ? '解散群组' : '退出群组', () => Alert.alert(owner ? '解散此群组？' : '退出此群组？', owner ? '群组解散后不能恢复。' : '', [{ text: '取消', style: 'cancel' }, { text: '确认', style: 'destructive', onPress: () => { void run(async () => { if (await (owner ? deleteGroup(room._id) : leaveGroup(room._id))) { action.removeLinkman(room._id); Actions.popTo('_chatlist'); } }); } }]), true)}
    </ScrollView></PageContainer>;
}
