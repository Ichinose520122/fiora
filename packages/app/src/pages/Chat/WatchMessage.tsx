import React, { useState } from 'react';
import { View, Image, Linking, TouchableOpacity } from 'react-native';
import { ThemedText as Text } from '../../components/ThemedText';
import fetch from '../../utils/fetch';
import Toast from '../../components/Toast';

export default function WatchMessage({ roomId, content }: { roomId: string; content: string }) {
    const [pending, setPending] = useState(false);
    const [failedCover, setFailedCover] = useState('');
    let invitation: { source?: string; title?: string; cover?: string } = {};
    try { invitation = JSON.parse(content) || {}; } catch { /* Legacy invitation. */ }
    const title = typeof invitation.title === 'string' && invitation.title.trim() ? invitation.title : '放映室';
    let cover = '';
    try {
        const url = new URL(invitation.cover || '');
        if (url.protocol === 'https:' && !url.username && !url.password) cover = url.href;
    } catch { /* Cover is optional. */ }
    async function join() {
        if (pending) return;
        setPending(true);
        try {
            const source = invitation.source || '';
            const [error, result] = await fetch<{ url: string }>('watchJoin', { roomId, source });
            if (!error && result) await Linking.openURL(result.url);
        } catch { Toast.danger('放映室暂时无法打开，请重试'); }
        finally { setPending(false); }
    }
    return <TouchableOpacity disabled={pending} onPress={join} accessibilityRole="button" accessibilityLabel={`${title}，进入放映室`}
        style={{ flexDirection: 'row', width: 310, maxWidth: '100%', borderRadius: 14, overflow: 'hidden', backgroundColor: '#f0eef6', borderWidth: 1, borderColor: '#dcd8e8', opacity: pending ? .65 : 1 }}>
        {cover && failedCover !== cover ? <Image source={{ uri: cover }} style={{ width: 88, height: 128 }} resizeMode="cover" onError={() => setFailedCover(cover)} /> : <View style={{ width: 68, minHeight: 104, backgroundColor: '#e5e0ee', justifyContent: 'center', alignItems: 'center' }}><Text style={{ fontSize: 30, color: '#a18aab' }}>◐</Text></View>}
        <View style={{ flex: 1, padding: 17, justifyContent: 'center' }}><Text style={{ fontSize: 14, fontWeight: '600', color: '#34374f', lineHeight: 22 }}>{title}</Text></View>
    </TouchableOpacity>;
}
