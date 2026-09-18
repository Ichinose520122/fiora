import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TagParticleType, TagStylePreset } from '../../../../utils/tagStyle';
import { useIsAdmin, useStore, useUser } from '../../hooks/useStore';
import store from '../../state/store';
import fetch from '../../utils/fetch';
import Toast from '../../components/Toast';
import UserTag from '../../components/UserTag';
import PixivAccount from './PixivAccount';

type SystemConfig = { disableSendMessage: boolean; disableNewUserSendMessage: boolean };
type SealList = { users: string[]; ips: string[] };
const presets: [TagStylePreset, string][] = [['solid', '经典纯色'], ['dualGradient', '双色渐变'], ['tripleGradient', '三色流光'], ['monochrome', '黑白曜影']];
const particles: [TagParticleType, string][] = [['none', '无粒子'], ['star', '空心五角星'], ['heart', '爱心粒子']];

function Field({ label, value, onChange, secret = false, disabled = false, maxLength = 64 }: { label: string; value: string; onChange: (value: string) => void; secret?: boolean; disabled?: boolean; maxLength?: number }) {
    return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} editable={!disabled} secureTextEntry={secret} autoCorrect={false} autoCapitalize="none" maxLength={maxLength} placeholder={label} placeholderTextColor="#8a95aa" style={styles.input} /></View>;
}

export default function AdminPanel({ close }: { close: () => void }) {
    const isAdmin = useIsAdmin(); const user = useUser(); const { connect } = useStore();
    const [busy, setBusy] = useState(false); const pending = useRef(false); const live = useRef(false);
    const [config, setConfig] = useState<SystemConfig>(); const [seals, setSeals] = useState<SealList>();
    const [loadError, setLoadError] = useState(''); const [pixiv, setPixiv] = useState(false);
    const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
    const [tagUsername, setTagUsername] = useState(''); const [tag, setTag] = useState('');
    const [preset, setPreset] = useState<TagStylePreset>('solid'); const [particle, setParticle] = useState<TagParticleType>('none');
    const [colors, setColors] = useState(['#5b8ff9', '#f759ab', '#ffd666']);
    const [resetName, setResetName] = useState(''); const [resetResult, setResetResult] = useState<{ username: string; password: string }>();
    const [sealName, setSealName] = useState(''); const [sealIp, setSealIp] = useState('');
    const userId = user?._id;
    const current = () => live.current && store.getState().user?._id === userId;
    const disabled = busy || !connect;
    const colorCount = preset === 'dualGradient' ? 2 : preset === 'tripleGradient' ? 3 : 0;
    const tagStyle = { preset, particle, colors: colors.slice(0, colorCount) };

    async function refresh() {
        const [[configError, nextConfig], [sealError, nextSeals]] = await Promise.all([
            fetch<SystemConfig>('getSystemConfig', {}, { toast: false }),
            fetch<SealList>('getSealList', {}, { toast: false }),
        ]);
        if (!current()) return;
        setConfig(configError ? undefined : nextConfig || undefined);
        setSeals(sealError ? undefined : nextSeals || undefined);
        setLoadError(configError || sealError || '');
    }
    async function run(task: () => Promise<void>) {
        if (pending.current || !current() || !isAdmin || !store.getState().connect) return;
        pending.current = true; setBusy(true);
        try { await task(); }
        catch (error) { if (current()) Toast.danger(error instanceof Error ? error.message : '操作失败，请重试'); }
        finally { pending.current = false; if (current()) setBusy(false); }
    }
    async function request<T = unknown>(event: string, data: object): Promise<T | undefined> {
        const [error, result] = await fetch<T>(event, data, { toast: false });
        if (!current()) return undefined;
        if (error) throw new Error(error);
        if (result == null) throw new Error('服务器未返回操作结果，请刷新确认');
        return result;
    }
    useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
    useEffect(() => {
        if (isAdmin && connect) void run(refresh);
        // A reconnect refreshes read-only state; mutations are never automatically replayed.
    }, [isAdmin, connect, userId]);

    const button = (title: string, onPress: () => void, danger = false) => <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, danger && styles.dangerButton, disabled && styles.disabled]}><Text style={[styles.buttonText, danger && styles.dangerText]}>{title}</Text></TouchableOpacity>;
    function confirm(title: string, description: string, task: () => Promise<void>) {
        Alert.alert(title, description, [{ text: '取消', style: 'cancel' }, { text: '确定', style: 'destructive', onPress: () => { void run(task); } }]);
    }
    function required(value: string, label: string) {
        if (!value.trim()) { Toast.warning(`请填写${label}`); return false; }
        return true;
    }
    const choices = <T extends string,>(options: [T, string][], selected: T, change: (value: T) => void) => <View style={styles.choices}>{options.map(([value, label]) => <TouchableOpacity key={value} accessibilityRole="button" accessibilityState={{ selected: selected === value }} disabled={disabled} onPress={() => change(value)} style={[styles.choice, selected === value && styles.selected]}><Text style={[styles.choiceText, selected === value && styles.selectedText]}>{label}</Text></TouchableOpacity>)}</View>;
    if (!isAdmin) return null;
    return <Modal animationType="slide" onRequestClose={close}><SafeAreaView style={styles.page}>
        <View style={styles.header}><TouchableOpacity accessibilityRole="button" accessibilityLabel="返回" onPress={close} style={styles.back}><Ionicons name="chevron-back" size={22} color="#52658e" /></TouchableOpacity><View style={{ flex: 1 }}><Text style={styles.heading}>管理员面板</Text><Text style={styles.hint}>当前账号：{user?.username}</Text></View>{busy ? <ActivityIndicator color="#6377b4" /> : <TouchableOpacity accessibilityRole="button" onPress={() => { void run(refresh); }} disabled={!connect} style={styles.back}><Ionicons name="refresh-outline" size={22} color="#52658e" /></TouchableOpacity>}</View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {!connect && <Text style={styles.error}>连接恢复后可继续管理。</Text>}
            {!!loadError && <Text style={styles.error}>读取管理状态失败：{loadError}。请点右上角刷新。</Text>}
            <View style={styles.card}><Text style={styles.title}>发言管理</Text>{!config ? <Text style={styles.hint}>尚未读取到当前设置</Text> : <>
                <View style={styles.switchRow}><View style={{ flex: 1 }}><Text style={styles.label}>全站禁言</Text><Text style={styles.hint}>控制全站用户发言</Text></View><Switch accessibilityLabel="全站禁言" disabled={disabled} value={config.disableSendMessage} onValueChange={value => confirm(value ? '开启全站禁言？' : '关闭全站禁言？', '这会修改服务器的全站发言设置。', async () => { if (await request('toggleSendMessage', { enable: !value })) { Toast.success('发言设置已更新'); await refresh(); } })} /></View>
                <View style={styles.switchRow}><View style={{ flex: 1 }}><Text style={styles.label}>新用户禁言</Text><Text style={styles.hint}>控制新注册用户发言</Text></View><Switch accessibilityLabel="新用户禁言" disabled={disabled} value={config.disableNewUserSendMessage} onValueChange={value => confirm(value ? '开启新用户禁言？' : '关闭新用户禁言？', '这会修改服务器的新用户发言设置。', async () => { if (await request('toggleNewUserSendMessage', { enable: !value })) { Toast.success('发言设置已更新'); await refresh(); } })} /></View>
            </>}</View>
            <View style={styles.card}><Text style={styles.title}>创建小洛克账号</Text><Field label="洛克王国 ID" value={username} onChange={setUsername} disabled={disabled} /><Field label="学号（初始密码）" value={password} onChange={setPassword} secret disabled={disabled} />{button('创建账号', () => { if (!required(username, '洛克王国 ID') || !required(password, '学号')) return; void run(async () => { const result = await request<{ username: string }>('createUser', { username: username.trim(), password: password.trim() }); if (result) { setUsername(''); setPassword(''); Toast.success(`账号 ${result.username} 创建成功`); } }); })}</View>
            <View style={styles.card}><Text style={styles.title}>用户标签</Text><Field label="用户名" value={tagUsername} onChange={setTagUsername} disabled={disabled} /><Field label="标签内容" value={tag} onChange={setTag} disabled={disabled} />
                {choices(presets, preset, setPreset)}{choices(particles, particle, setParticle)}
                {colors.slice(0, colorCount).map((color, index) => <View key={index} style={styles.colorRow}><View style={[styles.swatch, { backgroundColor: /^#[0-9a-f]{6}$/i.test(color) ? color : '#e5e9f0' }]} /><View style={{ flex: 1 }}><Field label={`颜色 ${index + 1}（#RRGGBB）`} value={color} maxLength={7} disabled={disabled} onChange={value => setColors(previous => previous.map((item, i) => i === index ? value : item))} /></View></View>)}
                <View style={styles.preview}><Text style={styles.hint}>效果预览</Text><UserTag text={tag.trim() || '炫彩标签'} tagStyle={tagStyle} /></View>
                {button('保存标签', () => { if (!required(tagUsername, '用户名') || !required(tag, '标签内容')) return; if (tagStyle.colors.some(color => !/^#[0-9a-f]{6}$/i.test(color))) { Toast.warning('颜色请填写完整的 #RRGGBB'); return; } void run(async () => { if (await request('setUserTag', { username: tagUsername.trim(), tag: tag.trim(), tagStyle })) Toast.success('用户标签已更新'); }); })}
            </View>
            <View style={styles.card}><Text style={styles.title}>重置用户密码</Text><Field label="要重置密码的用户名" value={resetName} onChange={setResetName} disabled={disabled} />{button('重置密码', () => { if (!required(resetName, '用户名')) return; const target = resetName.trim(); confirm(`重置 ${target} 的密码？`, '原密码将失效，用户需要使用新密码重新登录。', async () => { setResetResult(undefined); const result = await request<{ newPassword: string }>('resetUserPassword', { username: target }); if (result) { setResetResult({ username: target, password: result.newPassword }); setResetName(''); } }); }, true)}
                {resetResult && <View style={styles.result}><Text style={styles.label}>{resetResult.username} 的新密码（长按复制）</Text><Text selectable style={styles.password}>{resetResult.password}</Text><Text style={styles.hint}>请通知用户登录后修改密码。关闭面板后不保留此结果。</Text></View>}
            </View>
            <View style={styles.card}><Text style={styles.title}>封禁用户</Text><Text style={styles.hint}>当前服务器封禁时长：10 分钟</Text><Field label="要封禁的用户名" value={sealName} onChange={setSealName} disabled={disabled} />{button('封禁用户', () => { if (!required(sealName, '用户名')) return; const target = sealName.trim(); confirm(`封禁 ${target}？`, '该账号将在 10 分钟内无法正常使用聊天服务。', async () => { if (await request('sealUser', { username: target })) { setSealName(''); Toast.success('用户已封禁'); await refresh(); } }); }, true)}<Text style={styles.label}>当前封禁用户</Text><Text selectable style={styles.hint}>{seals ? seals.users.join('、') || '暂无' : '尚未读取'}</Text></View>
            <View style={styles.card}><Text style={styles.title}>封禁 IP</Text><Text style={styles.hint}>当前服务器封禁时长：6 小时</Text><Field label="IP 地址" value={sealIp} onChange={setSealIp} disabled={disabled} />{button('封禁 IP', () => { if (!required(sealIp, 'IP 地址')) return; const target = sealIp.trim(); confirm(`封禁 ${target}？`, '会影响使用该 IP 的所有用户，持续 6 小时。', async () => { if (await request('sealIp', { ip: target })) { setSealIp(''); Toast.success('IP 已封禁'); await refresh(); } }); }, true)}<Text style={styles.label}>当前封禁 IP</Text><Text selectable style={styles.hint}>{seals ? seals.ips.join('\n') || '暂无' : '尚未读取'}</Text></View>
            <View style={styles.card}><Text style={styles.title}>Pixiv 账号</Text><Text style={styles.hint}>配置、验证或清除服务器获取图片使用的账号。</Text>{button('管理 Pixiv 账号', () => setPixiv(true))}</View>
        </ScrollView></KeyboardAvoidingView>
        {pixiv && <PixivAccount close={() => setPixiv(false)} />}
    </SafeAreaView></Modal>;
}

const styles = StyleSheet.create({
    page: { flex: 1, backgroundColor: '#f3f5fc' }, header: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 }, back: { padding: 12 }, heading: { fontSize: 21, fontWeight: '700', color: '#32405a' },
    content: { padding: 18, gap: 16, paddingBottom: 36 }, card: { backgroundColor: '#fff', borderRadius: 20, padding: 18, gap: 12 }, title: { fontSize: 17, fontWeight: '600', color: '#32405a' },
    hint: { color: '#7c899f', fontSize: 12, lineHeight: 19 }, label: { color: '#475570', fontSize: 14 }, field: { gap: 7 }, input: { color: '#32405a', backgroundColor: '#f3f5fa', borderRadius: 12, padding: 13, fontSize: 15 },
    button: { padding: 14, alignItems: 'center', borderRadius: 12, backgroundColor: '#e9edf9' }, buttonText: { color: '#52658e', fontWeight: '600' }, dangerButton: { backgroundColor: '#faedf0' }, dangerText: { color: '#a25d73' }, disabled: { opacity: 0.45 },
    choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f3f5fa' }, selected: { backgroundColor: '#6377b4' }, choiceText: { color: '#67758d', fontSize: 12 }, selectedText: { color: '#fff' },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }, colorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, swatch: { width: 30, height: 30, borderRadius: 10, borderWidth: 1, borderColor: '#dde3ee' },
    preview: { alignItems: 'center', gap: 18, paddingVertical: 20 }, result: { padding: 14, borderRadius: 12, backgroundColor: '#f3f5fa', gap: 8 }, password: { fontSize: 20, color: '#32405a', fontWeight: '600' }, error: { color: '#a25d73', fontSize: 13, lineHeight: 20 },
});
