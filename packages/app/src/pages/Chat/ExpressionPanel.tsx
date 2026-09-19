import { ThemedText as Text, ThemedTextInput as TextInput } from '../../components/ThemedText';
import { useAppTheme } from '../../utils/theme';
import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { useUser, useSelfId } from '../../hooks/useStore';
import action from '../../state/action';
import fetch from '../../utils/fetch';
import { assetUrl } from '../../config';
import Expression from '../../components/Expression';
import QQExpression from './QQExpression';
import expressions from '../../utils/expressions';

type Result = { image: string; width: number; height: number };
export default function ExpressionPanel({ insert, send }: { insert: (name: string) => void; send: (url: string) => void }) {
    const theme = useAppTheme();

    const user = useUser();
    const userId = useSelfId();
    const [tab, setTab] = useState('默认');
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Result[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const generation = useRef(0);
    useEffect(() => () => { generation.current += 1; }, [userId]);
    async function search() {
        if (!query.trim()) return;
        const version = ++generation.current;
        setBusy(true); setError('');
        const [err, data] = await fetch<Result[]>('searchExpression', { keywords: query.trim() }, { toast: false });
        if (version !== generation.current) return;
        setResults(data || []); setError(err || (!data?.length ? '没有找到表情' : '')); setBusy(false);
    }
    function remove(url: string) {
        Alert.alert('移除收藏？', '', [{ text: '取消', style: 'cancel' }, { text: '移除', onPress: async () => {
            const version = generation.current;
            const [, data] = await fetch<string[]>('removeExpression', { expression: url });
            if (data && version === generation.current) action.updateUserProperty('expressions', data);
        } }]);
    }
    const urls = tab === '收藏' ? user?.expressions || [] : results.map((r) => `${r.image}${r.image.includes('?') ? '&' : '?'}width=${r.width}&height=${r.height}`);
    return <View style={{ height: 240 }}>
        <View style={{ flexDirection: 'row', backgroundColor: theme.color('#e9eef8', 'backgroundColor'), borderRadius: 13, padding: 4, margin: 7 }}>{['默认', 'QQ', '搜索', '收藏'].map((t) => <TouchableOpacity key={t} onPress={() => setTab(t)} style={{ flex: 1, alignItems: 'center', padding: 9, borderRadius: 10, backgroundColor: tab === t ? theme.color('#ffffffed', 'backgroundColor') : 'transparent' }}><Text style={{ color: tab === t ? theme.color('#6177ad', 'color') : theme.color('#99a6be', 'color'), fontSize: 12, fontWeight: '600' }}>{t}</Text></TouchableOpacity>)}</View>
        {tab === '搜索' && <View style={{ flexDirection: 'row', padding: 6 }}><TextInput placeholder="搜索表情" value={query} maxLength={20} onChangeText={setQuery} onSubmitEditing={search} style={{ flex: 1, backgroundColor: theme.input, padding: 6 }} /><TouchableOpacity disabled={busy} onPress={search} style={{ padding: 8 }}><Text>{busy ? '搜索中' : '搜索'}</Text></TouchableOpacity></View>}
        {tab === 'QQ' ? <QQExpression send={send} /> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', padding: 6 }}>
            {tab === '默认' ? expressions.default.map((name, i) => <TouchableOpacity key={name} accessibilityLabel={name} onPress={() => insert(name)} style={{ width: '12.5%', height: 42, alignItems: 'center', justifyContent: 'center' }}><Expression index={i} size={30} /></TouchableOpacity>) : urls.map((url, i) => <TouchableOpacity key={`${url}-${i}`} onPress={() => send(url)} onLongPress={tab === '收藏' ? () => remove(url) : undefined} style={{ width: '20%', height: 66, padding: 3 }}><Image source={{ uri: assetUrl(url) }} resizeMode="contain" style={{ width: '100%', height: '100%' }} /></TouchableOpacity>)}
            {tab === '收藏' && !urls.length && <Text style={{ padding: 12 }}>长按自己发出的图片，可以收藏表情。</Text>}
            {tab === '搜索' && !!error && <Text style={{ padding: 12 }}>{error}</Text>}
        </ScrollView>}
    </View>;
}
