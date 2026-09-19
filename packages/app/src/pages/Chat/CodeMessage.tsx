import { useAppTheme } from '../../utils/theme';
import { ThemedText as Text } from '../../components/ThemedText';
import { requireOptionalNativeModule } from 'expo';
import Toast from '../../components/Toast';
import React, { useState } from 'react';
import { Modal, Platform, ScrollView, Share, TouchableOpacity, View } from 'react-native';
import SafeAreaView from '../../components/ThemeScreen';
export default function CodeMessage({ content }: { content: string }) {
    const theme = useAppTheme();
    const [open, setOpen] = useState(false);
    const language = /@language=([_a-z]+)@/.exec(content)?.[1] || 'text';
    const code = content.replace(/@language=[_a-z]+@/, '');
    return <>
        <TouchableOpacity onPress={() => setOpen(true)} style={{ padding: 8, minWidth: 140 }}><Text style={{ color: theme.accent, fontWeight: '600' }}>{'</>'} {language}</Text><Text style={{ color: theme.muted, marginTop: 6 }}>查看代码 · {code.length} 字符</Text></TouchableOpacity>
        <Modal visible={open} onRequestClose={() => setOpen(false)} animationType="slide"><SafeAreaView style={{ flex: 1, backgroundColor: theme.page }}>
            <View style={{ padding: 18, flexDirection: 'row', justifyContent: 'space-between' }}><Text>{language}</Text><Text onPress={() => { void requireOptionalNativeModule('FioraConnection')?.copyText(code).then(() => Toast.success('已复制')).catch(() => {}); }}>复制</Text><Text onPress={() => { void Share.share({ message: code }); }}>分享</Text><Text onPress={() => setOpen(false)}>关闭</Text></View>
            <ScrollView contentContainerStyle={{ padding: 16 }}><ScrollView horizontal><Text selectable style={{ fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo', color: theme.text, fontSize: 13, lineHeight: 21 }}>{code}</Text></ScrollView></ScrollView>
        </SafeAreaView></Modal>
    </>;
}
