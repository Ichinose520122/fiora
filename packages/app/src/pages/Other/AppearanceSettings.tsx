import { useAppTheme, themePresets } from '../../utils/theme';
import { playMessageSound, prepareNotificationChannels } from '../../utils/messageNotifications';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Application from 'expo-application';
import React, { useState } from 'react';
import { Linking, Platform, Modal, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { defaultPreferences, setPreferences, usePreferences } from '../../utils/preferences';
import { chooseImage } from '../../utils/chooseImage';
import { useSelfId } from '../../hooks/useStore';
import Toast from '../../components/Toast';

export default function AppearanceSettings({ close }: { close: () => void }) {
    const prefs = usePreferences(); const self = useSelfId(); const theme = useAppTheme();
    const [globalColors, setGlobalColors] = useState({ accentColor: theme.accent, pageColor: theme.page, surfaceColor: theme.surface, primaryTextColor: theme.text });
    function chooseTheme(id: keyof typeof themePresets, bubbleColor: string, bubbleTextColor: string) {
        const preset = themePresets[id];
        setGlobalColors({ accentColor: preset.accent, pageColor: preset.page, surfaceColor: preset.surface, primaryTextColor: preset.text });
        const defaultBubble = [['#dee6fa', '#344a71'], ['#b9ddd4', '#275a53'], ['#f3d4df', '#71485c']].some(([fill, ink]) => prefs.bubbleColor === fill && prefs.bubbleTextColor === ink);
        if (defaultBubble) { setBubble(bubbleColor); setText(bubbleTextColor); }
        save({ theme: id, accentColor: '', pageColor: '', surfaceColor: '', primaryTextColor: '', ...(defaultBubble ? { bubbleColor, bubbleTextColor } : {}) });
    }
    async function soundSettings() {
        await prepareNotificationChannels();
        if (Platform.OS === 'android') await IntentLauncher.startActivityAsync('android.settings.CHANNEL_NOTIFICATION_SETTINGS', { extra: { 'android.provider.extra.APP_PACKAGE': Application.applicationId, 'android.provider.extra.CHANNEL_ID': 'chat-messages' } });
        else await Linking.openSettings();
    }
    const [bubble, setBubble] = useState(prefs.bubbleColor); const [text, setText] = useState(prefs.bubbleTextColor);
    const [busy, setBusy] = useState(false);
    const save = (value: Parameters<typeof setPreferences>[0]) => { void setPreferences(value).catch(() => Toast.danger('设置保存失败')); };
    const button = (title: string, press: () => void) => <TouchableOpacity disabled={busy} onPress={press} style={{ padding: 13, backgroundColor: theme.color('#e5eafa', 'backgroundColor'), borderRadius: 12, marginVertical: 6 }}><Text style={{ color: theme.color('#52658e', 'color'), textAlign: 'center' }}>{title}</Text></TouchableOpacity>;
    const toggle = (title: string, key: 'notifications' | 'sound' | 'preview' | 'voice' | 'selfVoice') => <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: theme.text }}>{title}</Text><Switch value={prefs[key]} onValueChange={(value) => save({ [key]: value })} /></View>;
    return <Modal animationType="slide" onRequestClose={close}><SafeAreaView style={{ flex: 1, backgroundColor: theme.color('#f3f5fc', 'backgroundColor') }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ color: theme.text, fontSize: 22 }}>外观与通知</Text>{button('完成', close)}</View>
        <Text style={{ color: theme.text }}>全局快捷主题</Text><View style={{ flexDirection: 'row', gap: 10 }}>{[['mist', '雾蓝', '#dee6fa', '#344a71'], ['mint', '薄荷', '#b9ddd4', '#275a53'], ['rose', '樱粉', '#f3d4df', '#71485c']].map(([id, label, color, ink]) => <TouchableOpacity key={id} onPress={() => chooseTheme(id as keyof typeof themePresets, color, ink)} style={{ flex: 1, padding: 16, backgroundColor: color, borderRadius: 14, borderWidth: prefs.theme === id ? 2 : 0, borderColor: ink }}><Text style={{ color: ink, textAlign: 'center' }}>{label}</Text></TouchableOpacity>)}</View>
        <Text style={{ color: theme.text }}>自定义全局配色</Text>
        <Text style={{ color: theme.muted, fontSize: 12, lineHeight: 19 }}>应用到导航栏、按钮、列表、卡片、个人页和音乐面板。聊天气泡可在下方单独设置。</Text>
        {([['accentColor', '主题主色'], ['pageColor', '页面背景'], ['surfaceColor', '卡片底色'], ['primaryTextColor', '主要文字']] as const).map(([key, label]) => <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: theme.border, backgroundColor: /^#[0-9a-f]{6}$/i.test(globalColors[key]) ? globalColors[key] : theme.soft }} /><View style={{ flex: 1 }}><Text style={{ color: theme.text }}>{label}</Text><TextInput accessibilityLabel={label} value={globalColors[key]} onChangeText={value => setGlobalColors(current => ({ ...current, [key]: value }))} autoCapitalize="none" autoCorrect={false} maxLength={7} placeholder="#RRGGBB" placeholderTextColor={theme.muted} style={{ color: theme.text, backgroundColor: theme.surface, padding: 12, borderRadius: 12 }} /></View></View>)}
        {button('保存全局配色', () => { if (!Object.values(globalColors).every(color => /^#[0-9a-f]{6}$/i.test(color))) { Toast.warning('请填写完整的六位颜色，例如 #509f91'); return; } save(globalColors); Toast.success('全局配色已更新'); })}
        <Text style={{ color: theme.text }}>普通标签颜色</Text><View style={{ flexDirection: 'row', gap: 8 }}>{[['singleColor', '单一'], ['fixedColor', '固定'], ['randomColor', '随机']].map(([id, label]) => <TouchableOpacity key={id} onPress={() => save({ tagColorMode: id })} style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: prefs.tagColorMode === id ? theme.color('#dce5f9', 'backgroundColor') : theme.color('#fff', 'backgroundColor') }}><Text style={{ color: theme.text, textAlign: 'center' }}>{label}</Text></TouchableOpacity>)}</View>
        <Text style={{ color: theme.text }}>自己的消息气泡</Text>
        <View style={{ alignSelf: 'flex-end', padding: 14, borderRadius: 17, backgroundColor: /^#[0-9a-f]{6}$/i.test(bubble) ? bubble : prefs.bubbleColor }}><Text style={{ color: /^#[0-9a-f]{6}$/i.test(text) ? text : prefs.bubbleTextColor }}>你好，这是气泡预览</Text></View>
        {([['气泡颜色', bubble, setBubble], ['文字颜色', text, setText]] as const).map(([label, value, update]) => <View key={label}><Text style={{ color: theme.text }}>{label}</Text><TextInput value={value} onChangeText={update} autoCapitalize="none" maxLength={7} placeholder="#RRGGBB" placeholderTextColor={theme.muted} style={{ color: theme.text, backgroundColor: theme.surface, padding: 14, borderRadius: 12, marginTop: 8 }} /></View>)}
        {button('保存气泡颜色', () => { if (![bubble, text].every(color => /^#[0-9a-f]{6}$/i.test(color))) { Toast.warning('请输入六位十六进制颜色，例如 #dee6fa'); return; } save({ bubbleColor: bubble, bubbleTextColor: text }); Toast.success('气泡颜色已更新'); })}
        {button(busy ? '正在上传…' : '选择聊天背景', () => { if (!self || busy) return; setBusy(true); void chooseImage('BackgroundImage', self).then((url) => { if (url) return setPreferences({ background: url }); }).catch((error) => Toast.danger(error.message)).finally(() => setBusy(false)); })}
        {button('恢复默认外观', () => { setBubble(defaultPreferences.bubbleColor); setText(defaultPreferences.bubbleTextColor); setGlobalColors({ accentColor: themePresets.mint.accent, pageColor: themePresets.mint.page, surfaceColor: themePresets.mint.surface, primaryTextColor: themePresets.mint.text }); save({ theme: 'mint', accentColor: '', pageColor: '', surfaceColor: '', primaryTextColor: '', background: '', bubbleColor: defaultPreferences.bubbleColor, bubbleTextColor: defaultPreferences.bubbleTextColor }); })}
        <Text style={{ color: theme.text, marginTop: 16 }}>消息提醒</Text>{toggle('消息提醒', 'notifications')}{toggle('前后台提示音', 'sound')}{toggle('通知显示消息内容', 'preview')}{toggle('前台语音播报', 'voice')}{toggle('播报自己发送的消息', 'selfVoice')}
        {button('试听消息提示音', () => { void playMessageSound(true).then(played => { if (!played) Toast.warning('系统处于静音、勿扰或通知音量为零'); }).catch(() => Toast.warning('提示音播放失败，请检查系统声音设置')); })}
        {button('系统通知声音设置', () => { void soundSettings().catch(() => Linking.openSettings()); })}
        <Text style={{ color: theme.muted, fontSize: 12 }}>前台收到他人消息会播放系统通知音；后台声音还取决于系统通知频道设置，静音和勿扰模式仍然有效。</Text>
        <Text style={{ color: theme.color('#8995ab', 'color'), fontSize: 12 }}>外观保存在这台手机上。系统通知权限和电池设置在“我 → 后台在线”中管理。</Text>
    </ScrollView></SafeAreaView></Modal>;
}
