import MusicIcon from '../../components/MusicIcon';
import React, { useRef, useState } from 'react';
import { StyleSheet, View, TextInput, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassView } from '../../components/PageContainer';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { File as LocalFile } from 'expo-file-system';
import { Actions } from '../../navigation';
import action from '../../state/action';
import fetch from '../../utils/fetch';
import { useIsLogin, useStore, useUser } from '../../hooks/useStore';
import { Message } from '../../types/redux';
import retryFile from '../../utils/retryFile';
import uploadFile from '../../utils/uploadFile';
import waitForSession from '../../utils/waitForSession';
import Toast from '../../components/Toast';
import ExpressionPanel from './ExpressionPanel';
import { useMusic } from '../../modules/Music/MusicSession';

const commands = [
    ['/music ', '点歌：歌名、ID 或平台链接'], ['/music search ', '搜索歌曲'],
    ['/music join', '加入一起听'], ['/music leave', '仅自己停止收听'],
    ['/music list', '查看点歌队列'], ['/music next', '切到下一首'],
    ['/music vote', '投票切歌'], ['/music pause', '暂停房间播放'],
    ['/music resume', '继续房间播放'], ['/music playlist ', '添加歌单'],
    ['/music login', '网易云账号设置'], ['/pixiv ', '发送作品 ID、链接或单张 pximg 链接'],
    ['-roll ', '掷骰子'], ['-rps', '石头剪刀布'],
];
export default function Input({ onHeightChange }: { onHeightChange: () => void }) {
    const isLogin = useIsLogin();
    const user = useUser();
    const { focus } = useStore();
    const music = useMusic();
    const [message, setMessage] = useState('');
    const [showExpression, setShowExpression] = useState(false);
    const [selection, setSelection] = useState({ start: 0, end: 0 });
    const input = useRef<TextInput>(null);
    const draft = useRef('');
    const pickingFile = useRef(false);
    const identity = useRef({ focus, userId: user?._id });
    identity.current = { focus, userId: user?._id };
    function change(value: string) { draft.current = value; setMessage(value); }
    function local(type: string, content: string, target = focus) {
        const id = `${target}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        action.addLinkmanMessage(target, { _id: id, type, content, createTime: Date.now(),
            from: { _id: user._id, username: user.username, avatar: user.avatar, tag: user.tag, tagStyle: user.tagStyle },
            to: target, loading: true });
        return id;
    }
    async function send(id: string, type: string, content: string, target = focus) {
        const sender = user._id;
        const [err, result] = await fetch<Message & { additionalMessages?: Message[] }>('sendMessage', {
            to: target, type, content,
        }, { timeout: type === 'text' && (/^\/\s*pixiv\b/i.test(content) || /https:\/\/i\.pximg\.net\//i.test(content)) ? 180000 : 30000 });
        if (sender !== identity.current.userId) return;
        if (err || !result) {
            action.updateSelfMessage(target, id, { loading: false, failed: true, error: err || '服务器未返回消息确认' } as Message); return;
        }
        const { additionalMessages = [], ...first } = result;
        action.updateSelfMessage(target, id, { ...first, loading: false, failed: false, error: '', statusText: '' });
        additionalMessages.forEach((item) => action.addLinkmanMessage(target, item));
    }
    function submit() {
        let value = draft.current.trim();
        if (!value || !isLogin || !focus) return;
        change(''); setShowExpression(false);
        if (/^\/music(?:\s|$)/i.test(value)) value = music.command(value);
        void send(local('text', value), 'text', value);
    }
    function sendExpression(url: string) { void send(local('image', url), 'image', url); }
    async function pick(camera: boolean) {
        const target = focus;
        const sender = user._id;
        let id: string | undefined;
        try {
            if (camera) {
                const permission = await ImagePicker.requestCameraPermissionsAsync();
                if (!permission.granted) { Alert.alert('需要相机权限才能拍照'); return; }
            }
            const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.9 };
            const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
            if (result.canceled || sender !== identity.current.userId) return;
            const image = result.assets[0];
            if (!image?.base64) throw new Error('未能读取图片');
            id = local('image', `${image.uri}?width=${image.width}&height=${image.height}`, target);
            const url = await uploadFile(image.base64, `ImageMessage/${sender}_${Date.now()}`, true);
            if (sender !== identity.current.userId) return;
            await send(id, 'image', `${url}${url.includes('?') ? '&' : '?'}width=${image.width}&height=${image.height}`, target);
        } catch (error) {
            Toast.danger(error instanceof Error ? error.message : '图片发送失败');
            if (id && sender === identity.current.userId) action.updateSelfMessage(target, id, { loading: false, failed: true } as Message);
        }
    }
    async function pickFile() {
        if (pickingFile.current) return;
        pickingFile.current = true;
        const target = focus; const sender = user._id;
        let id: string | undefined;
        let stage = '选择文件';
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
            if (result.canceled || sender !== identity.current.userId) return;
            const file = result.assets[0];
            if (!file?.uri) throw new Error('未能取得文件，请重新选择');
            stage = '读取文件';
            const localFile = new LocalFile(file.uri);
            const size = localFile.size;
            if (!localFile.exists || !Number.isFinite(size) || size < 0) throw new Error('无法读取文件，请先将文件下载到手机');
            if (size > 30 * 1024 * 1024) throw new Error('请选择不超过 30 MB 的文件');
            const filename = file.name || localFile.name || '附件.bin';
            const ext = (/\.([a-z0-9]{1,16})$/i.exec(filename)?.[1] || 'bin').toLowerCase();
            const details = { filename, size, ext };
            id = local('file', JSON.stringify(details), target);
            action.updateSelfMessage(target, id, { localFileUri: file.uri } as Message);
            await retryFile({ _id: id, type: 'file', content: JSON.stringify(details), createTime: Date.now(), to: target, from: user, localFileUri: file.uri } as Message);
        } catch (error) {
            const reason = `${stage}失败：${error instanceof Error ? error.message : String(error)}`;
            Alert.alert('文件发送失败', reason);
            if (id && sender === identity.current.userId) action.updateSelfMessage(target, id, { loading: false, failed: true, error: reason } as Message);
        } finally { pickingFile.current = false; }
    }
    function insertExpression(name: string) {
        const value = `#(${name})`;
        change(message.slice(0, selection.start) + value + message.slice(selection.end));
        setSelection({ start: selection.start + value.length, end: selection.start + value.length });
    }
    const hints = message && /^[/-]/.test(message) ? commands.filter(([cmd]) => cmd.startsWith(message.toLowerCase()) && cmd !== message).slice(0, 4) : [];
    return <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
        {!!hints.length && <GlassView intensity={35} tint="light" style={styles.hints}>{hints.map(([cmd, help]) => <TouchableOpacity key={cmd} onPress={() => { change(cmd); input.current?.focus(); }} style={{ padding: 8 }}><Text><Text style={{ fontWeight: '600' }}>{cmd}</Text>  {help}</Text></TouchableOpacity>)}</GlassView>}
        {isLogin ? <>
            <View style={{ flexDirection: 'row', padding: 8 }}><TextInput ref={input} value={message} onChangeText={change} onSubmitEditing={submit} onSelectionChange={(e) => setSelection(e.nativeEvent.selection)} style={styles.input}  autoCapitalize="none" autoCorrect={false} returnKeyType="send" submitBehavior="submit" maxLength={2048} onFocus={() => setShowExpression(false)} /><TouchableOpacity accessibilityLabel="发送消息" onPress={submit} style={{ padding: 11, marginLeft: 8, backgroundColor: '#7588bd', borderRadius: 15 }}><Ionicons name="send" size={21} color="white" /></TouchableOpacity></View>
            <View style={styles.tools}>{([
                ['musical-notes-outline', () => music.open()],
                ['happy-outline', () => { input.current?.blur(); setShowExpression(!showExpression); onHeightChange(); }],
                ['image-outline', () => pick(false)], ['camera-outline', () => pick(true)], ['attach-outline', pickFile],
            ] as const).map(([icon, press]) => <TouchableOpacity key={icon} accessibilityLabel={icon} onPress={press} style={{ padding: 9, flex: 1, alignItems: 'center' }}>{icon === 'musical-notes-outline' ? <MusicIcon size={25} /> : <Ionicons name={icon} size={23} color="#7b8dad" />}</TouchableOpacity>)}</View>
            {showExpression && <ExpressionPanel insert={insertExpression} send={sendExpression} />}
        </> : <TouchableOpacity onPress={() => Actions.login()} style={{ padding: 16 }}><Text>登录 / 注册，参与聊天</Text></TouchableOpacity>}
    </SafeAreaView>;
}
const styles = StyleSheet.create({
    container: { backgroundColor: '#f8faffb8', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: '#ffffffc9' },
    input: { flex: 1, minHeight: 43, paddingHorizontal: 13, backgroundColor: '#ffffffd6', borderRadius: 15, color: '#24314a' },
    tools: { flexDirection: 'row', paddingHorizontal: 10 },
    hints: { overflow: 'hidden', backgroundColor: '#ffffff66', borderRadius: 18, marginHorizontal: 8, marginTop: 8, borderWidth: 1, borderColor: '#ffffff99' },
});
