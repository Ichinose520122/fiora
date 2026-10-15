import React, { useState } from 'react';
import { View, Button, Linking } from 'react-native';
import { ThemedText as Text } from '../../components/ThemedText';
import fetch from '../../utils/fetch';
import Toast from '../../components/Toast';

export default function WatchMessage({ roomId, content }: { roomId: string; content: string }) {
    const [pending, setPending] = useState(false);
    async function join() {
        if (pending) return;
        setPending(true);
        try {
            let source = '';
            try { source = JSON.parse(content).source || ''; } catch { /* Empty invitation. */ }
            const [error, result] = await fetch<{ url: string }>('watchJoin', { roomId, source });
            if (!error && result) await Linking.openURL(result.url);
        } catch { Toast.danger('影院暂时无法打开，请重试'); }
        finally { setPending(false); }
    }
    return <View style={{ padding: 12 }}><Text>一起看 · 私人影院</Text>
        <Text>在线解析或选择本地视频，与当前聊天成员同步观看。</Text>
        <Button title={pending ? '正在进入…' : '进入影院'} disabled={pending} onPress={join} />
    </View>;
}
