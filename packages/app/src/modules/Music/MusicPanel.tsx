import { useAppTheme, useThemedStyles } from '../../utils/theme';
import MusicIcon from '../../components/MusicIcon';
import React, { useRef, useState } from 'react';
import { Modal, View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { assetUrl } from '../../config';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMusic } from './MusicSession';
import { useSelfId } from '../../hooks/useStore';
import MusicAccount from './MusicAccount';
import { time } from './MusicPlayer';

export default function MusicPanel() {
    const theme = useAppTheme(); const styles = useThemedStyles(baseStyles);

    const music = useMusic(); const self = useSelfId(); const { room, panelTab } = music;
    const [playlist, setPlaylist] = useState(''); const [pending, setPending] = useState(false); const pendingRef = useRef(false);
    async function act(action: string, data: Record<string, unknown> = {}, join = false) {
        if (pendingRef.current) return;
        pendingRef.current = true; setPending(true);
        try { if (await music.act(action, data)) { if (join) music.join(); } }
        finally { pendingRef.current = false; setPending(false); }
    }
    const button = (label: string, press: () => void, disabled = false) => <TouchableOpacity disabled={pending || disabled} onPress={press} style={[styles.button, { opacity: pending || disabled ? 0.4 : 1 }]}><Text style={{ color: theme.color('#6376ad', 'color'), fontSize: 12, fontWeight: '500' }}>{label}</Text></TouchableOpacity>;
    const cover = (url?: string) => <View style={styles.cover}>{url ? <Image source={{ uri: assetUrl(url) }} style={{ width: '100%', height: '100%' }} /> : <MusicIcon color={theme.color('#97a5c5')} size={23} />}</View>;
    return <Modal visible={music.panel} animationType="slide" onRequestClose={music.close}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.color('#f0f3fb', 'backgroundColor') }}>
            <View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.heading}>一起听</Text><Text style={styles.meta}>同一个房间，同一段旋律</Text></View><TouchableOpacity onPress={music.close} style={styles.close} accessibilityLabel="关闭音乐面板"><Ionicons name="close" size={22} color={theme.color('#8190af')} /></TouchableOpacity></View>
            <View style={styles.tabs}>{[['search', '点歌'], ['queue', `队列 ${room?.queue.length || 0}`], ['playlist', '歌单'], ['account', '账号']].map(([tab, label]) => <TouchableOpacity key={tab} onPress={() => music.setPanelTab(tab)} style={[styles.tab, panelTab === tab && styles.activeTab]}><Text style={{ color: panelTab === tab ? theme.color('#596fa8', 'color') : theme.color('#98a4bc', 'color'), fontSize: 13, fontWeight: '600' }}>{label}</Text></TouchableOpacity>)}</View>
            {panelTab !== 'account' && <LinearGradient colors={[theme.soft, theme.page, theme.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.now}>
                {cover(room?.current?.cover)}<View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={styles.songTitle}>{room?.current?.title || '为房间点一首歌'}</Text><Text numberOfLines={1} style={styles.meta}>{room?.current?.artist || '你的音乐，大家一起听'} · {room?.listeners || 0} 人</Text></View>{button(music.listening ? '退出收听' : '加入收听', music.listening ? music.leave : music.join)}
            </LinearGradient>}
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
                {!!music.error && <Text style={{ color: theme.color('#a34354', 'color') }}>{music.error}</Text>}
                {panelTab === 'search' && <>
                    <View style={styles.row}>{music.sources.map((s) => <TouchableOpacity key={s.id} disabled={!s.enabled} onPress={() => music.setSource(s.id)} style={[styles.button, { opacity: s.enabled ? 1 : 0.35, backgroundColor: music.source === s.id ? theme.color('#cad8ea', 'backgroundColor') : 'transparent' }]}><Text style={{ color: theme.text }}>{s.name}</Text></TouchableOpacity>)}</View>
                    <View style={styles.row}><TextInput style={styles.input} value={music.keywords} onChangeText={music.setKeywords} onSubmitEditing={music.search} placeholder={music.source === 'local' ? '搜索服务器本地曲库（可留空）' : '歌曲名 / 歌手'} />{button(music.busy ? '搜索中' : '搜索', () => { void music.search(); }, music.busy)}</View>
                    {music.tracks.map((track) => <View key={`${track.provider}:${track.id}`} style={styles.track}>{cover(track.cover)}<View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={styles.songTitle}>{track.title}</Text><Text numberOfLines={1} style={styles.meta}>{track.artist} · {time(track.duration)}</Text></View>{button('＋ 点歌', () => { void act('add', { id: track.id, provider: track.provider }, true); })}</View>)}
                    <Text style={styles.meta}>点歌优先播放，后续点歌加入队列。本地歌曲由服务器曲库提供。</Text>
                </>}
                {panelTab === 'queue' && <>
                    {room?.current && <Text style={{ paddingVertical: 12 }}>正在播放：{room.current.title}</Text>}
                    {!room?.queue.length && <Text style={{ paddingVertical: 20 }}>暂无待播歌曲</Text>}
                    {room?.queue.map((track, i) => <View key={track.entryId} style={styles.track}><Text style={styles.index}>{String(i + 1).padStart(2, '0')}</Text><View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={styles.songTitle}>{track.title}</Text><Text numberOfLines={1} style={styles.meta}>{track.artist} · {track.requestedByName}</Text></View>{room.canControl && button('置顶', () => { void act('top', { entryId: track.entryId }); })}{(room.canControl || track.requestedBy === self) && button('取消', () => { void act('remove', { entryId: track.entryId }); })}</View>)}
                    {room?.current && button(room.canControl ? '下一首' : `投票切歌 ${room.votes.length}/${room.votesNeeded}`, () => { void act(room.canControl ? 'next' : 'vote'); })}
                    {room?.canControl && button('清空队列', () => { void act('clearQueue'); })}
                </>}
                {panelTab === 'playlist' && <>
                    <View style={styles.row}>{music.sources.filter((s) => s.enabled).map((s) => <TouchableOpacity key={s.id} onPress={() => music.setSource(s.id)} style={[styles.button, music.source === s.id && { backgroundColor: theme.color('#cad8ea', 'backgroundColor') }]}><Text style={{ color: theme.text }}>{s.name}</Text></TouchableOpacity>)}</View>
                    <TextInput style={styles.input} value={playlist} onChangeText={setPlaylist} autoCapitalize="none" placeholder="歌单 ID 或链接" />
                    {button('添加到点歌队列', () => { void act('playlist', { provider: music.source, id: playlist }, true); }, !playlist.trim())}
                    {room?.canControl && <>{button('设为空闲歌单', () => { void act('idle', { provider: music.source, id: playlist }); }, !playlist.trim())}{button('仅保存歌单', () => { void act('savePlaylist', { provider: music.source, id: playlist }); }, !playlist.trim())}</>}
                    <Text style={{ paddingVertical: 10 }}>空闲歌单：{room?.idlePlaylist.length || 0} 首 · {room?.idleMode === 'random' ? '随机播放' : '顺序播放'}</Text>
                    {room?.canControl && <View style={styles.row}>{button('顺序', () => { void act('idleMode', { mode: 'sequential' }); })}{button('随机', () => { void act('idleMode', { mode: 'random' }); })}{button('清除空闲歌单', () => { void act('clearIdle'); })}</View>}
                    {room?.savedPlaylists?.map((item) => <View key={item.key} style={{ paddingVertical: 10, borderTopWidth: 0.5, borderColor: theme.color('#bccbdd', 'borderColor') }}><Text style={{ color: theme.text }}>{item.provider} · {item.id} · {item.trackCount} 首</Text><View style={styles.row}>{button('点播', () => { void act('playlist', { provider: item.provider, id: item.id }, true); })}{room.canControl && <>{button('空闲播放', () => { void act('idle', { provider: item.provider, id: item.id }); })}{button('更新', () => { void act('refreshSavedPlaylist', { key: item.key }); })}{button('移除', () => { void act('removeSavedPlaylist', { key: item.key }); })}</>}</View></View>)}
                </>}
                {panelTab === 'account' && music.panel && <MusicAccount />}
            </ScrollView>
        </SafeAreaView>
    </Modal>;
}
const baseStyles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginBottom: 10 }, button: { paddingVertical: 10, paddingHorizontal: 11, borderRadius: 12, backgroundColor: '#e8edf9a6', marginVertical: 3 },
    input: { flexGrow: 1, flexShrink: 1, minWidth: 140, backgroundColor: '#ffffffda', padding: 13, borderRadius: 15, color: '#34415c', fontSize: 13 }, track: { flexDirection: 'row', alignItems: 'center', padding: 10, marginVertical: 4, borderRadius: 18, backgroundColor: '#ffffffbb', gap: 9 }, meta: { color: '#8a98b2', fontSize: 11, paddingVertical: 5 },
    header: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'center' }, heading: { color: '#33405e', fontSize: 27, fontWeight: '700', letterSpacing: 1 }, close: { backgroundColor: '#ffffffc0', padding: 10, borderRadius: 16 },
    tabs: { marginHorizontal: 17, backgroundColor: '#e6ebf6', flexDirection: 'row', borderRadius: 16, padding: 5, marginBottom: 14 }, tab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 12 }, activeTab: { backgroundColor: '#ffffffed' },
    now: { marginHorizontal: 17, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 21, borderWidth: 1, borderColor: '#ffffffbd' }, cover: { height: 42, width: 42, borderRadius: 13, overflow: 'hidden', backgroundColor: '#e1e7f5', alignItems: 'center', justifyContent: 'center' }, songTitle: { color: '#42516d', fontSize: 13, fontWeight: '600' }, index: { color: '#a5afc4', fontSize: 12, width: 21, fontVariant: ['tabular-nums'] },
});
