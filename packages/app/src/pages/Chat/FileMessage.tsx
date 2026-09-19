import { ThemedText as Text } from '../../components/ThemedText';
import { useAppTheme } from '../../utils/theme';
import React from 'react';
import { TouchableOpacity, View, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Message } from '../../types/redux';
import { assetUrl } from '../../config';
import Toast from '../../components/Toast';
export default function FileMessage({ message }: { message: Message }) {
    const theme = useAppTheme();

    let file: { filename?: string; size?: number; fileUrl?: string; ext?: string };
    try { file = JSON.parse(message.content); } catch { return <Text>文件信息无法读取</Text>; }
    const url = file.fileUrl ? assetUrl(file.fileUrl) : '';
    return <TouchableOpacity disabled={!url || message.loading} onPress={() => {
        if (!/^https?:\/\//i.test(url)) return;
        Linking.openURL(url).catch(() => Toast.danger('无法打开文件链接'));
    }} style={{ maxWidth: 230, padding: 8, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ borderRadius: 13, backgroundColor: theme.color('#ffffff70', 'backgroundColor'), padding: 10, marginRight: 9 }}><Ionicons name="document-text-outline" size={28} color={theme.color('#405c81')} /></View>
        <View style={{ flexShrink: 1 }}><Text numberOfLines={2} style={{ color: theme.color('#243850', 'color'), fontWeight: '600' }}>{file.filename || '文件'}</Text><Text style={{ color: theme.color('#526780', 'color'), fontSize: 12, marginTop: 5 }}>{((file.size || 0) / 1024 / 1024).toFixed(2)} MB · {message.loading ? '发送中' : '打开 / 下载'}</Text></View>
    </TouchableOpacity>;
}
