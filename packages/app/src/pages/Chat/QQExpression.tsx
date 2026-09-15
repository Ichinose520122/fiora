import React, { useEffect, useState } from 'react';
import { FlatList, View, Text, Image, TouchableOpacity, useWindowDimensions } from 'react-native';
import { serverUrl } from '../../config';
type Item = { id: string; name: string; preview: string; image: string };
let cache: Item[] | null = null;
export default function QQExpression({ send }: { send: (url: string) => void }) {
    const [items, setItems] = useState(cache || []);
    const [error, setError] = useState(''); const [attempt, retry] = useState(0);
    const { width } = useWindowDimensions();
    useEffect(() => {
        if (cache) return;
        const controller = new AbortController();
        let live = true;
        const timer = setTimeout(() => controller.abort(), 15000);
        setError('');
        fetch(`${serverUrl}/QQExpression/_index.json`, { signal: controller.signal }).then((r) => {
            if (!r.ok) throw new Error(); return r.json();
        }).then((records) => {
            if (!Array.isArray(records)) throw new Error();
            const parsed = records.filter((r) => !r.isHide && !((String(r.emojiId).codePointAt(0) || 0) > 0x2000 && String(r.emojiId).length <= 12) && Array.isArray(r.assets)).map((r) => {
                const png = r.assets.find((a: any) => a.type === 0); const animated = r.assets.find((a: any) => a.type === 2);
                if (!png && !animated) return null;
                const url = (asset: any) => new URL(asset.path, `${serverUrl}/QQExpression/`).href;
                return { id: String(r.emojiId), name: String(r.describe || '').replace(/^\//, ''), preview: url(png || animated), image: url(animated || png) };
            }).filter(Boolean).slice(0, 240) as Item[];
            if (!controller.signal.aborted) { cache = parsed; setItems(parsed); }
        }).catch(() => { if (live) setError('QQ 表情加载失败，点此重试'); }).finally(() => clearTimeout(timer));
        return () => { live = false; clearTimeout(timer); controller.abort(); };
    }, [attempt]);
    return <View style={{ flex: 1 }}>
        {!items.length && <TouchableOpacity onPress={() => retry((v) => v + 1)} style={{ padding: 20 }}><Text style={{ color: '#687d96' }}>{error || '正在加载 QQ 表情…'}</Text></TouchableOpacity>}
        <FlatList data={items} numColumns={6} initialNumToRender={24} windowSize={3} keyExtractor={(item) => item.id} renderItem={({ item }) => <TouchableOpacity accessibilityLabel={item.name} onPress={() => send(`${item.image}${item.image.includes('?') ? '&' : '?'}width=120&height=120`)} style={{ width: (width - 12) / 6, height: 57, padding: 8, alignItems: 'center' }}><Image source={{ uri: item.preview }} resizeMode="contain" fadeDuration={0} style={{ width: 40, height: 40 }} /></TouchableOpacity>} contentContainerStyle={{ padding: 6 }} />
    </View>;
}
