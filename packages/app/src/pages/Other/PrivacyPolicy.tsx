import React, { useState } from 'react';
import { Linking, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { serverUrl } from '../../config';
import { removeStorageValue, setStorageValue } from '../../utils/storage';
import Toast from '../../components/Toast';
export const PrivacyPolicyStorageKey = 'privacy-policy';
export default function PrivacyPolicy({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const [busy, setBusy] = useState(false);
    async function answer(agree: boolean) {
        if (busy) return; setBusy(true);
        try { if (agree) await setStorageValue(PrivacyPolicyStorageKey, 'true'); else await removeStorageValue(PrivacyPolicyStorageKey); onClose(); }
        catch { Toast.danger('隐私设置保存失败，请重试'); } finally { setBusy(false); }
    }
    return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={{ flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: 24 }}><View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 22, maxHeight: '80%' }}>
        <Text style={{ fontSize: 20, color: '#32405a', marginBottom: 14 }}>服务协议和隐私条款</Text>
        <ScrollView><Text style={{ color: '#667391', fontSize: 15, lineHeight: 24 }}>欢迎使用 Fiora。请阅读并理解隐私政策，了解账号、聊天内容和权限的使用方式。</Text><Text onPress={() => { void Linking.openURL(`${serverUrl}/PrivacyPolicy.html`).catch(() => Toast.warning('无法打开隐私政策')); }} style={{ color: '#6377b4', paddingVertical: 18 }}>阅读《隐私政策》</Text></ScrollView>
        <View style={{ flexDirection: 'row', gap: 12 }}>{[false, true].map(agree => <TouchableOpacity key={String(agree)} disabled={busy} onPress={() => { void answer(agree); }} style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: agree ? '#e2e9f8' : '#f3f5fc', alignItems: 'center' }}><Text>{agree ? '同意' : '不同意'}</Text></TouchableOpacity>)}</View>
    </View></View></Modal>;
}
