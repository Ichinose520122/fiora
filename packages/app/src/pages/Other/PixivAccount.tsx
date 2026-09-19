import { useAppTheme } from '../../utils/theme';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import fetch from '../../utils/fetch';
export default function PixivAccount({ close }: { close: () => void }) {
    const theme = useAppTheme();

    const [configured, setConfigured] = useState<boolean | null>(null);
    const [session, setSession] = useState('');
    const [busy, setBusy] = useState(false); const pending = useRef(false); const live = useRef(true);
    async function refresh() { const [, data] = await fetch<{ configured: boolean }>('pixivAccountStatus'); if (data && live.current) setConfigured(data.configured); }
    useEffect(() => { live.current = true; void refresh(); return () => { live.current = false; }; }, []);
    async function run(event: string, data = {}) {
        if (pending.current) return;
        pending.current = true; setBusy(true);
        const [err] = await fetch(event, data);
        if (!live.current) return;
        setSession('');
        if (!err) { await refresh(); if (event === 'pixivAccountVerify') Alert.alert('账号验证成功'); }
        pending.current = false; setBusy(false);
    }
    const button = (label: string, press: () => void) => <TouchableOpacity disabled={busy} onPress={press} style={{ paddingVertical: 14, opacity: busy ? 0.4 : 1 }}><Text style={{ color: theme.color('#526b98', 'color') }}>{label}</Text></TouchableOpacity>;
    return <Modal visible animationType="slide" onRequestClose={close}><SafeAreaView style={{ flex: 1, padding: 20, backgroundColor: theme.color('#eaf0f6', 'backgroundColor') }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ fontSize: 20 }}>Pixiv 账号</Text>{button('关闭', close)}</View>
        <Text style={{ paddingVertical: 12 }}>{configured === null ? '正在读取状态…' : configured ? '服务器已配置 Pixiv 账号' : '服务器尚未配置 Pixiv 账号'}</Text>
        <Text style={{ color: theme.text }}>使用 Pixiv 官方网页登录取得的 PHPSESSID。仅站点管理员可管理此账号，图片由服务器获取后发送。</Text>
        <TextInput value={session} onChangeText={setSession} placeholder="PHPSESSID" secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={4096} style={{ backgroundColor: theme.color('white', 'backgroundColor'), borderRadius: 8, padding: 12, marginVertical: 12 }} />
        {button('保存并验证', () => { void run('pixivAccountLogin', { session }); })}
        {button('验证已保存账号', () => { void run('pixivAccountVerify'); })}
        {button('清除服务器账号', () => Alert.alert('清除 Pixiv 账号？', '将影响服务器获取需要登录的作品。', [{ text: '取消', style: 'cancel' }, { text: '清除', onPress: () => { void run('pixivAccountLogout'); } }]))}
    </SafeAreaView></Modal>;
}
