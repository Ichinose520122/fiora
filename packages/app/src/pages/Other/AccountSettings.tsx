import { useAppTheme } from '../../utils/theme';
import React, { useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '../../hooks/useStore';
import { changeAvatar, changePassword, changeUsername } from '../../service';
import action from '../../state/action';
import socket from '../../socket';
import { clearSession } from '../../utils/session';
import { chooseImage } from '../../utils/chooseImage';
import Toast from '../../components/Toast';
import Avatar from '../../components/Avatar';

export default function AccountSettings({ close }: { close: () => void }) {
    const theme = useAppTheme();

    const user = useUser();
    const [name, setName] = useState(user?.username || '');
    const [oldPassword, setOld] = useState(''); const [newPassword, setNew] = useState(''); const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    async function run(task: () => Promise<void>) {
        if (busy) return; setBusy(true);
        try { await task(); } catch (error) { Toast.danger(error instanceof Error ? error.message : '保存失败'); } finally { setBusy(false); }
    }
    if (!user) return null;
    const input = { backgroundColor: theme.color('#fff', 'backgroundColor'), color: theme.color('#32405a', 'color'), padding: 14, borderRadius: 12, marginVertical: 6 };
    const button = (title: string, press: () => void) => <TouchableOpacity disabled={busy} onPress={press} style={{ padding: 14, alignItems: 'center', borderRadius: 12, backgroundColor: theme.color('#e2e9f8', 'backgroundColor'), marginVertical: 8, opacity: busy ? 0.5 : 1 }}><Text style={{ color: theme.color('#52658e', 'color') }}>{title}</Text></TouchableOpacity>;
    return <Modal animationType="slide" onRequestClose={close}><SafeAreaView style={{ flex: 1, backgroundColor: theme.color('#f3f5fc', 'backgroundColor') }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontSize: 22, color: theme.color('#32405a', 'color') }}>账号资料</Text>{button('完成', close)}</View>
        <View style={{ alignItems: 'center', paddingTop: 18 }}><Avatar src={user.avatar} userId={user._id} size={80} /></View>
        {button('更换头像', () => { void run(async () => { const url = await chooseImage('Avatar', user._id); if (url && await changeAvatar(url)) { action.setAvatar(url); Toast.success('头像已更新'); } }); })}
        <Text style={{ color: theme.text }}>用户名</Text><TextInput style={input} value={name} onChangeText={setName} maxLength={32} autoCapitalize="none" />
        {button('保存用户名', () => { void run(async () => { if (!name.trim()) throw new Error('请输入用户名'); if (await changeUsername(name.trim())) { action.updateUserProperty('username', name.trim()); Toast.success('用户名已更新'); } }); })}
        <Text style={{ marginTop: 14 }}>修改密码</Text>
        <TextInput style={input} value={oldPassword} onChangeText={setOld} placeholder="当前密码" secureTextEntry autoCapitalize="none" />
        <TextInput style={input} value={newPassword} onChangeText={setNew} placeholder="新密码" secureTextEntry autoCapitalize="none" />
        <TextInput style={input} value={confirm} onChangeText={setConfirm} placeholder="再次输入新密码" secureTextEntry autoCapitalize="none" />
        {button('更新密码', () => { void run(async () => {
            if (!oldPassword || !newPassword) throw new Error('请填写当前密码和新密码');
            if (newPassword !== confirm) throw new Error('两次新密码不一致');
            if (await changePassword(oldPassword, newPassword)) {
                socket.disconnect(); await clearSession(); action.logout(); socket.connect(); close();
                Alert.alert('密码已更新', '请使用新密码重新登录');
            }
        }); })}
    </ScrollView></SafeAreaView></Modal>;
}
