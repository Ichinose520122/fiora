import React, { useState } from 'react';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
export default function CodeComposer({ close, send }: { close: () => void; send: (value: string) => void }) {
    const [code, setCode] = useState(''); const [language, setLanguage] = useState('text');
    return <Modal animationType="slide" onRequestClose={close}><SafeAreaView style={{ flex: 1, backgroundColor: '#f3f5fc', padding: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text onPress={close}>取消</Text><Text>代码消息</Text><Text onPress={() => { if (code.trim()) send(`@language=${language}@${code}`); }} style={{ color: '#52658e' }}>发送</Text></View>
        <View><ScrollView horizontal showsHorizontalScrollIndicator={false}>{['text', 'javascript', 'typescript', 'python', 'java', 'c_cpp', 'golang', 'csharp', 'ruby', 'php', 'html', 'css', 'sql', 'json'].map((item) => <TouchableOpacity key={item} onPress={() => setLanguage(item)} style={{ backgroundColor: language === item ? '#dce5f9' : '#fff', padding: 12, marginRight: 6, borderRadius: 10 }}><Text>{item}</Text></TouchableOpacity>)}</ScrollView></View>
        <TextInput multiline value={code} onChangeText={setCode} maxLength={20000} autoCapitalize="none" autoCorrect={false} placeholder="粘贴或输入代码" textAlignVertical="top" style={{ flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, fontFamily: 'monospace', fontSize: 13 }} />
    </SafeAreaView></Modal>;
}
