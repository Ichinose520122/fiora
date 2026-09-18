import AvatarDecorationPicker from './AvatarDecorationPicker';
import { BackgroundConnectionSetting } from '../../components/BackgroundConnection';
import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Actions } from '../../navigation';
import PageContainer from '../../components/PageContainer';
import { useIsAdmin, useIsLogin, useUser } from '../../hooks/useStore';
import socket from '../../socket';
import PixivAccount from './PixivAccount';
import AppUpdate from './AppUpdate';
import { serverUrl } from '../../config';
import action from '../../state/action';
import { getStorageValue } from '../../utils/storage';
import { clearSession } from '../../utils/session';
import Avatar from '../../components/Avatar';
import UserTag from '../../components/UserTag';
import Toast from '../../components/Toast';
import PrivacyPolicy, { PrivacyPolicyStorageKey } from './PrivacyPolicy';

export default function Other() {
    const isLogin = useIsLogin(); const isAdmin = useIsAdmin(); const user = useUser();
    const [showPixiv, setShowPixiv] = useState(false);
    const [privacy, setPrivacy] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    useEffect(() => { void getStorageValue(PrivacyPolicyStorageKey).then((value) => setPrivacy(value !== 'true')).catch(() => setPrivacy(true)); }, []);
    async function login() {
        if (await getStorageValue(PrivacyPolicyStorageKey) !== 'true') { setPrivacy(true); return; }
        Actions.login();
    }
    async function logout() {
        if (loggingOut) return;
        setLoggingOut(true); socket.disconnect();
        try { await clearSession(); action.logout(); Toast.success('已退出登录'); }
        catch { Toast.danger('退出失败，请重试'); }
        finally { socket.connect(); setLoggingOut(false); }
    }
    const row = (icon: React.ComponentProps<typeof Ionicons>['name'], title: string, subtitle: string, press: () => void) => <TouchableOpacity style={styles.row} onPress={press}>
        <View style={styles.icon}><Ionicons name={icon} color="#6576aa" size={22} /></View><View style={{ flex: 1 }}><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></View><Ionicons name="chevron-forward" size={16} color="#a4afc1" />
    </TouchableOpacity>;
    return <PageContainer><ScrollView contentContainerStyle={styles.page}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => { if (isLogin) Actions.userInfo({ userId: user._id }); else void login(); }}>
            <LinearGradient colors={['#e6eaff', '#f6eefe', '#f3f9ff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profile}>
                <Avatar userId={user?._id} src={isLogin ? user.avatar : require('../../../icon.png')} size={66} />
                <View style={{ flex: 1, gap: 8 }}><Text style={styles.name} numberOfLines={1}>{isLogin ? user.username : '欢迎来到 Fiora'}</Text>{user?.tag ? <UserTag text={user.tag} tagStyle={user.tagStyle} /> : <Text style={styles.subtitle}>{isLogin ? '查看个人资料' : '登录，开始新的对话'}</Text>}</View>
                <Ionicons name="chevron-forward" size={19} color="#8794af" />
            </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.section}>偏好与服务</Text>
        <View style={styles.card}>
            {isAdmin && row('shield-outline', '管理员面板', '在网页管理，需登录管理员账号', () => { void Linking.openURL(`${serverUrl}/?panel=admin`).catch(() => Toast.danger('无法打开浏览器')); })}
            {isAdmin && row('image-outline', 'Pixiv 账号', '管理图片获取使用的账号', () => setShowPixiv(true))}
            {row('globe-outline', '网页版', '在浏览器继续聊天', () => { void Linking.openURL(serverUrl).catch(() => Toast.danger('无法打开浏览器')); })}
            {row('shield-checkmark-outline', '隐私政策', '了解信息与权限的使用', () => setPrivacy(true))}
        </View>
        {isLogin && <><AvatarDecorationPicker /><BackgroundConnectionSetting /></>}
        <AppUpdate />
        <TouchableOpacity disabled={loggingOut} style={styles.logout} onPress={() => { if (isLogin) void logout(); else void login(); }}><Text style={{ color: isLogin ? '#a86179' : '#5969b0', fontWeight: '600' }}>{loggingOut ? '正在退出…' : isLogin ? '退出登录' : '登录 / 注册'}</Text></TouchableOpacity>
        <Text style={styles.footer}>Fiora · 与你保持连接</Text>
    </ScrollView>
        {isAdmin && showPixiv && <PixivAccount close={() => setShowPixiv(false)} />}
        <PrivacyPolicy visible={privacy} onClose={() => setPrivacy(false)} />
    </PageContainer>;
}
const styles = StyleSheet.create({
    page: { padding: 18, paddingBottom: 28 }, profile: { flexDirection: 'row', alignItems: 'center', padding: 22, gap: 16, borderRadius: 25, borderWidth: 1, borderColor: '#ffffff' },
    name: { color: '#283653', fontWeight: '700', fontSize: 21 }, section: { fontSize: 12, fontWeight: '600', color: '#8995ab', marginTop: 28, marginBottom: 12, marginLeft: 5, letterSpacing: 1 },
    card: { backgroundColor: '#ffffffc9', borderRadius: 22, paddingHorizontal: 14, borderWidth: 1, borderColor: '#ffffff' }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 17 },
    icon: { backgroundColor: '#f0f3fb', borderRadius: 14, padding: 10 }, title: { color: '#32405a', fontSize: 15, fontWeight: '500' }, subtitle: { color: '#8491a8', fontSize: 12, marginTop: 4 },
    logout: { padding: 17, borderRadius: 17, backgroundColor: '#ffffffb0', alignItems: 'center', marginTop: 25 }, footer: { color: '#9ba6bb', fontSize: 11, textAlign: 'center', marginTop: 23 },
});
