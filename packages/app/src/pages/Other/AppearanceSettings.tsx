import React, { useState } from 'react';
import { Modal, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { defaultPreferences, setPreferences, usePreferences } from '../../utils/preferences';
import { chooseImage } from '../../utils/chooseImage';
import { useSelfId } from '../../hooks/useStore';
import Toast from '../../components/Toast';

export default function AppearanceSettings({ close }: { close: () => void }) {
    const prefs = usePreferences(); const self = useSelfId();
    const [bubble, setBubble] = useState(prefs.bubbleColor); const [text, setText] = useState(prefs.bubbleTextColor);
    const [busy, setBusy] = useState(false);
    const save = (value: Parameters<typeof setPreferences>[0]) => { void setPreferences(value).catch(() => Toast.danger('设置保存失败')); };
    const button = (title: string, press: () => void) => <TouchableOpacity disabled={busy} onPress={press} style={{ padding: 13, backgroundColor: '#e5eafa', borderRadius: 12, marginVertical: 6 }}><Text style={{ color: '#52658e', textAlign: 'center' }}>{title}</Text></TouchableOpacity>;
    const toggle = (title: string, key: 'notifications' | 'sound' | 'preview' | 'voice' | 'selfVoice') => <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text>{title}</Text><Switch value={prefs[key]} onValueChange={(value) => save({ [key]: value })} /></View>;
    return <Modal animationType="slide" onRequestClose={close}><SafeAreaView style={{ flex: 1, backgroundColor: '#f3f5fc' }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text style={{ fontSize: 22 }}>外观与通知</Text>{button('完成', close)}</View>
        <Text>快捷主题</Text><View style={{ flexDirection: 'row', gap: 10 }}>{[['mist', '雾蓝', '#dee6fa', '#344a71'], ['mint', '薄荷', '#b9ddd4', '#275a53'], ['rose', '樱粉', '#f3d4df', '#71485c']].map(([id, label, color, ink]) => <TouchableOpacity key={id} onPress={() => { setBubble(color); setText(ink); save({ theme: id, bubbleColor: color, bubbleTextColor: ink }); }} style={{ flex: 1, padding: 16, backgroundColor: color, borderRadius: 14, borderWidth: prefs.theme === id ? 2 : 0, borderColor: ink }}><Text style={{ color: ink, textAlign: 'center' }}>{label}</Text></TouchableOpacity>)}</View>
        <Text>普通标签颜色</Text><View style={{ flexDirection: 'row', gap: 8 }}>{[['singleColor', '单一'], ['fixedColor', '固定'], ['randomColor', '随机']].map(([id, label]) => <TouchableOpacity key={id} onPress={() => save({ tagColorMode: id })} style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: prefs.tagColorMode === id ? '#dce5f9' : '#fff' }}><Text style={{ textAlign: 'center' }}>{label}</Text></TouchableOpacity>)}</View>
        <Text>自己的消息气泡</Text>
        <View style={{ alignSelf: 'flex-end', padding: 14, borderRadius: 17, backgroundColor: /^#[0-9a-f]{6}$/i.test(bubble) ? bubble : prefs.bubbleColor }}><Text style={{ color: /^#[0-9a-f]{6}$/i.test(text) ? text : prefs.bubbleTextColor }}>你好，这是气泡预览</Text></View>
        {([['气泡颜色', bubble, setBubble], ['文字颜色', text, setText]] as const).map(([label, value, update]) => <View key={label}><Text>{label}</Text><TextInput value={value} onChangeText={update} autoCapitalize="none" maxLength={7} placeholder="#RRGGBB" style={{ backgroundColor: '#fff', padding: 14, borderRadius: 12, marginTop: 8 }} /></View>)}
        {button('保存气泡颜色', () => { if (![bubble, text].every(color => /^#[0-9a-f]{6}$/i.test(color))) { Toast.warning('请输入六位十六进制颜色，例如 #dee6fa'); return; } save({ bubbleColor: bubble, bubbleTextColor: text }); Toast.success('气泡颜色已更新'); })}
        {button(busy ? '正在上传…' : '选择聊天背景', () => { if (!self || busy) return; setBusy(true); void chooseImage('BackgroundImage', self).then((url) => { if (url) return setPreferences({ background: url }); }).catch((error) => Toast.danger(error.message)).finally(() => setBusy(false)); })}
        {button('恢复默认外观', () => { setBubble(defaultPreferences.bubbleColor); setText(defaultPreferences.bubbleTextColor); save({ theme: 'mist', background: '', bubbleColor: defaultPreferences.bubbleColor, bubbleTextColor: defaultPreferences.bubbleTextColor }); })}
        <Text style={{ marginTop: 16 }}>消息提醒</Text>{toggle('后台消息通知', 'notifications')}{toggle('提示音与振动', 'sound')}{toggle('通知显示消息内容', 'preview')}{toggle('前台语音播报', 'voice')}{toggle('播报自己发送的消息', 'selfVoice')}
        <Text style={{ color: '#8995ab', fontSize: 12 }}>外观保存在这台手机上。系统通知权限和电池设置在“我 → 后台在线”中管理。</Text>
    </ScrollView></SafeAreaView></Modal>;
}
