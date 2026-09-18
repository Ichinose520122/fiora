import { shareCrash } from '../../components/CrashReport';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProfileBoundary from '../../components/ProfileBoundary';
import AccountSettings from './AccountSettings';
import AppearanceSettings from './AppearanceSettings';
import AvatarDecorationPicker from './AvatarDecorationPicker';
import { BackgroundConnectionSetting } from '../../components/BackgroundConnection';
import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Actions } from '../../navigation';
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

function OtherContent() {
    const isLogin = useIsLogin(); const isAdmin = useIsAdmin(); const user = useUser();
    const [section, setSection] = useState('');
    const [account, setAccount] = useState(false);
    const [appearance, setAppearance] = useState(false);
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
    return <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: '#f3f5fc' }}><ScrollView contentContainerStyle={styles.page}>
        <TouchableOpacity activeOpacity={0.9} onPress={() => { if (isLogin) Actions.userInfo({ userId: user._id }); else void login(); }}>
            <View style={[styles.profile, { backgroundColor: '#e9edf9' }]}>
                <Avatar userId={user?._id} src={isLogin ? user.avatar : require('../../../icon.png')} size={66} />
                <View style={{ flex: 1, gap: 8 }}><Text style={styles.name} numberOfLines={1}>{isLogin ? user.username : '欢迎来到 Fiora'}</Text>{user?.tag ? <UserTag text={user.tag} tagStyle={user.tagStyle} animated={false} /> : <Text style={styles.subtitle}>{isLogin ? '查看个人资料' : '登录，开始新的对话'}</Text>}</View>
                <Ionicons name="chevron-forward" size={19} color="#8794af" />
            </View>
        </TouchableOpacity>
        <Text style={styles.section}>偏好与服务</Text>
        <View style={styles.card}>
            {isLogin && row('sparkles-outline', '头像挂件', '选择与网页同步的头像装饰', () => setSection('decoration'))}
            {isLogin && row('notifications-outline', '后台在线', '连接状态、通知权限、电池限制', () => setSection('background'))}
            {row('cloud-download-outline', '应用更新', '当前版本与 GitHub 最新安装包', () => setSection('update'))}
            {isLogin && row('person-outline', '账号资料', '修改头像、用户名与密码', () => setAccount(true))}
            {row('color-palette-outline', '外观与通知', '主题、气泡、聊天背景与消息提醒', () => setAppearance(true))}
            {isAdmin && row('shield-outline', '管理员面板', '在网页管理，需登录管理员账号', () => { void Linking.openURL(`${serverUrl}/?panel=admin`).catch(() => Toast.danger('无法打开浏览器')); })}
            {isAdmin && row('image-outline', 'Pixiv 账号', '管理图片获取使用的账号', () => setShowPixiv(true))}
            {row('information-circle-outline', '故障诊断', '查看并分享本机保存的异常信息', () => { void shareCrash(); })}
            {row('globe-outline', '网页版', '在浏览器继续聊天', () => { void Linking.openURL(serverUrl).catch(() => Toast.danger('无法打开浏览器')); })}
            {row('shield-checkmark-outline', '隐私政策', '了解信息与权限的使用', () => setPrivacy(true))}
        </View>

        <TouchableOpacity disabled={loggingOut} style={styles.logout} onPress={() => { if (isLogin) void logout(); else void login(); }}><Text style={{ color: isLogin ? '#a86179' : '#5969b0', fontWeight: '600' }}>{loggingOut ? '正在退出…' : isLogin ? '退出登录' : '登录 / 注册'}</Text></TouchableOpacity>
        <Text style={styles.footer}>Fiora · 与你保持连接</Text>
    </ScrollView>
        {account && <AccountSettings close={() => setAccount(false)} />}
        {appearance && <AppearanceSettings close={() => setAppearance(false)} />}
        {isAdmin && showPixiv && <PixivAccount close={() => setShowPixiv(false)} />}
        {!!section && <Modal animationType="slide" onRequestClose={() => setSection('')}><SafeAreaView style={{ flex: 1, backgroundColor: '#f3f5fc' }}><TouchableOpacity onPress={() => setSection('')} style={{ padding: 18 }}><Text style={{ color: '#52658e' }}>返回</Text></TouchableOpacity><ProfileBoundary label="设置"><ScrollView contentContainerStyle={{ padding: 16 }}>{section === 'decoration' && isLogin && <AvatarDecorationPicker />}{section === 'background' && isLogin && <BackgroundConnectionSetting />}{section === 'update' && <AppUpdate />}</ScrollView></ProfileBoundary></SafeAreaView></Modal>}
        {privacy && <PrivacyPolicy visible onClose={() => setPrivacy(false)} />}
    </SafeAreaView>;
}
export default function Other() { return <ProfileBoundary label="我"><OtherContent /></ProfileBoundary>; }
const styles = StyleSheet.create({
    page: { padding: 18, paddingBottom: 28 }, profile: { flexDirection: 'row', alignItems: 'center', padding: 22, gap: 16, borderRadius: 25, borderWidth: 1, borderColor: '#ffffff' },
    name: { color: '#283653', fontWeight: '700', fontSize: 21 }, section: { fontSize: 12, fontWeight: '600', color: '#8995ab', marginTop: 28, marginBottom: 12, marginLeft: 5, letterSpacing: 1 },
    card: { backgroundColor: '#ffffffc9', borderRadius: 22, paddingHorizontal: 14, borderWidth: 1, borderColor: '#ffffff' }, row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 17 },
    icon: { backgroundColor: '#f0f3fb', borderRadius: 14, padding: 10 }, title: { color: '#32405a', fontSize: 15, fontWeight: '500' }, subtitle: { color: '#8491a8', fontSize: 12, marginTop: 4 },
    logout: { padding: 17, borderRadius: 17, backgroundColor: '#ffffffb0', alignItems: 'center', marginTop: 25 }, footer: { color: '#9ba6bb', fontSize: 11, textAlign: 'center', marginTop: 23 },
});
