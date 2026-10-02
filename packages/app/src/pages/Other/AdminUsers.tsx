import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { AdminUsersPage, formatAccountTime } from '../../../../utils/adminUsers';
import { ThemedText as Text, ThemedTextInput as TextInput } from '../../components/ThemedText';
import { useAppTheme } from '../../utils/theme';
import { useIsAdmin, useStore, useUser } from '../../hooks/useStore';
import fetch from '../../utils/fetch';

export default function AdminUsers({ revision = 0 }: { revision?: number }) {
    const theme = useAppTheme();
    const { connect } = useStore();
    const user = useUser();
    const isAdmin = useIsAdmin();
    const [keyword, setKeyword] = useState('');
    const [query, setQuery] = useState({ keyword: '', page: 1, refresh: 0 });
    const [result, setResult] = useState<AdminUsersPage>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const version = useRef(0);
    useEffect(() => {
        const request = ++version.current;
        setResult(undefined); setError('');
        if (!connect || !isAdmin) { setLoading(false); return; }
        setLoading(true);
        fetch<AdminUsersPage>('getAdminUsers', { keyword: query.keyword, page: query.page }, { toast: false })
            .then(([err, data]) => {
                if (version.current !== request) return;
                setResult(err ? undefined : data || undefined);
                setError(err || (!data ? '服务器未返回账号列表' : ''));
            })
            .catch(() => { if (version.current === request) setError('读取失败，请重试'); })
            .finally(() => { if (version.current === request) setLoading(false); });
        return () => { version.current += 1; };
    }, [query, revision, connect, isAdmin, user?._id]);
    const disabled = loading || !connect || !isAdmin;
    const button = (title: string, onPress: () => void, unavailable = false) => <TouchableOpacity accessibilityRole="button" disabled={disabled || unavailable} onPress={onPress} style={[styles.button, { backgroundColor: theme.input, borderColor: theme.border, opacity: disabled || unavailable ? 0.45 : 1 }]}><Text style={{ color: theme.text }}>{title}</Text></TouchableOpacity>;
    const search = () => setQuery({ keyword: keyword.trim(), page: 1, refresh: query.refresh + 1 });
    if (!isAdmin) return null;
    return <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>全部账号{result ? ` · ${result.total}` : ''}</Text>
        <Text style={styles.hint}>最近登录包含自动登录和重连，按本机时间显示；暂无记录表示未登录或历史记录缺失。</Text>
        <TextInput accessibilityLabel="搜索用户名" placeholder="搜索用户名" placeholderTextColor={theme.color('#8a95aa')} value={keyword} maxLength={64} onChangeText={setKeyword} autoCapitalize="none" autoCorrect={false} returnKeyType="search" onSubmitEditing={() => { if (!disabled) search(); }} style={[styles.input, { backgroundColor: theme.input, color: theme.text, borderColor: theme.border }]} />
        <View style={styles.actions}>{button('搜索', search)}{button('刷新', () => setQuery({ ...query, refresh: query.refresh + 1 }))}</View>
        {loading && <Text style={styles.hint}>正在读取账号…</Text>}
        {!!error && <Text accessibilityRole="alert">{error}</Text>}
        {!connect && <Text style={styles.hint}>连接恢复后自动刷新账号列表</Text>}
        {result?.users.map((account) => <View key={account._id} style={[styles.row, { borderColor: theme.border }]}>
            <Text selectable style={[styles.name, { color: theme.text }]}>{account.username} · {account.isAdmin ? '管理员' : '普通用户'}</Text>
            <Text>最近登录：{formatAccountTime(account.lastLoginTime)}</Text>
            <Text style={styles.hint}>注册时间：{formatAccountTime(account.createTime)}</Text>
        </View>)}
        {result && <>
            {!result.users.length && <Text style={styles.hint}>没有匹配的账号</Text>}
            <Text style={styles.hint}>第 {result.page} / {result.pages} 页 · 共 {result.total} 个</Text>
            <View style={styles.actions}>
                {button('上一页', () => setQuery({ ...query, page: result.page - 1 }), result.page <= 1)}
                {button('下一页', () => setQuery({ ...query, page: result.page + 1 }), result.page >= result.pages)}
            </View>
        </>}
    </View>;
}

const styles = StyleSheet.create({
    content: { gap: 12 }, title: { fontSize: 17, fontWeight: '600' },
    hint: { fontSize: 12, lineHeight: 19, opacity: 0.7 },
    input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    button: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
    row: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 6 },
    name: { fontSize: 14, fontWeight: '600' },
});
