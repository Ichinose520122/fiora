import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import fetch from '../../utils/fetch';
import { useIsAdmin } from '../../hooks/useStore';

type Status = { canManage: boolean; configured: boolean; loggedIn: boolean; nickname?: string; unverified?: boolean };
export default function MusicAccount() {
    const admin = useIsAdmin();
    const [status, setStatus] = useState<Status | null>(null);
    const [phone, setPhone] = useState(''); const [countryCode, setCountryCode] = useState('86');
    const [captcha, setCaptcha] = useState(''); const [cookie, setCookie] = useState('');
    const [busy, setBusy] = useState(false); const pending = useRef(false); const live = useRef(true);
    const [cooldown, setCooldown] = useState(0);
    async function refresh() { const [, data] = await fetch<Status>('musicAccountStatus', {}); if (live.current) setStatus(data); }
    useEffect(() => { live.current = true; void refresh(); const timer = setInterval(() => setCooldown((v) => Math.max(0, v - 1)), 1000); return () => { live.current = false; clearInterval(timer); }; }, []);
    async function run(event: string, data: Record<string, string> = {}) {
        if (pending.current) return;
        pending.current = true; setBusy(true);
        const [err, result] = await fetch<{ retryAfter?: number }>(event, data);
        if (!live.current) return;
        setCaptcha(''); setCookie('');
        if (!err) { if (event === 'musicSendCode') setCooldown(result?.retryAfter || 60); else await refresh(); }
        pending.current = false; setBusy(false);
    }
    const field = { backgroundColor: '#ffffffb0', padding: 10, borderRadius: 7, marginVertical: 5 };
    const button = (label: string, press: () => void, disabled = false) => <TouchableOpacity disabled={busy || disabled} onPress={press} style={{ padding: 12, opacity: busy || disabled ? 0.45 : 1 }}><Text style={{ color: '#526b98' }}>{label}</Text></TouchableOpacity>;
    return <View>
        <Text style={{ marginVertical: 8 }}>网易云音乐账号（供服务器播放音乐）</Text>
        <Text>{!status ? '正在读取账号状态…' : status.loggedIn ? `已登录 ${status.nickname || ''}` : status.unverified ? '已保存，尚未验证' : '未登录'}</Text>
        {admin && status?.canManage && status.configured ? <>
            <TextInput style={field} placeholder="国家区号" keyboardType="number-pad" value={countryCode} onChangeText={setCountryCode} maxLength={4} />
            <TextInput style={field} placeholder="手机号" keyboardType="phone-pad" value={phone} onChangeText={setPhone} maxLength={15} />
            {button(cooldown ? `${cooldown} 秒后可重发` : '发送验证码', () => { void run('musicSendCode', { phone, countryCode }); }, cooldown > 0)}
            <TextInput style={field} placeholder="短信验证码" keyboardType="number-pad" value={captcha} onChangeText={setCaptcha} maxLength={8} autoComplete="sms-otp" />
            {button('验证码登录', () => { void run('musicLogin', { phone, countryCode, captcha }); })}
            <Text>短信无法登录时，可使用官方网页登录取得的 MUSIC_U。</Text>
            <TextInput style={field} placeholder="MUSIC_U（仅提交给本服务器）" value={cookie} onChangeText={setCookie} secureTextEntry autoCapitalize="none" autoCorrect={false} maxLength={4096} />
            {button('保存 MUSIC_U', () => { void run('musicLoginWithCookie', { cookie }); })}
            {button('退出服务器网易云账号', () => Alert.alert('退出网易云账号？', '将影响所有房间的平台歌曲播放。', [{ text: '取消', style: 'cancel' }, { text: '退出', onPress: () => { void run('musicLogout'); } }]))}
        </> : <Text style={{ paddingVertical: 12 }}>{admin ? '账号接口尚未配置，请检查服务器配置。' : '只有站点管理员可以管理网易云账号，其他成员可直接点歌。'}</Text>}
    </View>;
}
