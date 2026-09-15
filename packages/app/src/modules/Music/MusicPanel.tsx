import React, { useRef, useState } from 'react';
import { Modal, View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMusic } from './MusicSession';
import { useSelfId } from '../../hooks/useStore';
import MusicAccount from './MusicAccount';
import { time } from './MusicPlayer';

export default function MusicPanel() {
    const music = useMusic(); const self = useSelfId(); const { room, panelTab } = music;
    const [playlist, setPlaylist] = useState(''); const [pending, setPending] = useState(false); const pendingRef = useRef(false);
    async function act(action: string, data: Record<string, unknown> = {}, join = false) {
        if (pendingRef.current) return;
        pendingRef.current = true; setPending(true);
        try { if (await music.act(action, data)) { if (join) music.join(); } }
        finally { pendingRef.current = false; setPending(false); }
    }
    const button = (label: string, press: () => void, disabled = false) => <TouchableOpacity disabled={pending || disabled} onPress={press} style={[styles.button, { opacity: pending || disabled ? 0.4 : 1 }]}><Text style={{ color: '#526b98' }}>{label}</Text></TouchableOpacity>;
    return <Modal visible={music.panel} animationType="slide" onRequestClose={music.close}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#eaf0f6' }}>
            <View style={styles.row}><Text style={{ fontSize: 20, fontWeight: '600', flex: 1, padding: 12 }}>一起听</Text>{button('关闭', music.close)}</View>
            <View style={styles.row}>{[['search', '点歌'], ['queue', '队列'], ['playlist', '歌单'], ['account', '账号']].map(([tab, label]) => <TouchableOpacity key={tab} onPress={() => music.setPanelTab(tab)} style={[styles.button, panelTab === tab && { borderBottomWidth: 2, borderColor: '#526b98' }]}><Text>{label}</Text></TouchableOpacity>)}</View>
            {panelTab !== 'account' && <View style={styles.row}>{button(music.listening ? '退出收听' : '加入收听', music.listening ? music.leave : music.join)}<Text>{room?.listeners || 0} 人收听</Text></View>}
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 12 }}>
                {!!music.error && <Text style={{ color: '#a34354' }}>{music.error}</Text>}
                {panelTab === 'search' && <>
                    <View style={styles.row}>{music.sources.map((s) => <TouchableOpacity key={s.id} disabled={!s.enabled} onPress={() => music.setSource(s.id)} style={[styles.button, { opacity: s.enabled ? 1 : 0.35, backgroundColor: music.source === s.id ? '#cad8ea' : 'transparent' }]}><Text>{s.name}</Text></TouchableOpacity>)}</View>
                    <View style={styles.row}><TextInput style={styles.input} value={music.keywords} onChangeText={music.setKeywords} onSubmitEditing={music.search} placeholder={music.source === 'local' ? '搜索服务器本地曲库（可留空）' : '歌曲名 / 歌手'} />{button(music.busy ? '搜索中' : '搜索', () => { void music.search(); }, music.busy)}</View>
                    {music.tracks.map((track) => <View key={`${track.provider}:${track.id}`} style={styles.track}><View style={{ flex: 1 }}><Text>{track.title}</Text><Text style={styles.meta}>{track.artist} · {time(track.duration)}</Text></View>{button('点歌', () => { void act('add', { id: track.id, provider: track.provider }, true); })}</View>)}
                    <Text style={styles.meta}>点歌优先播放，后续点歌加入队列。本地歌曲由服务器曲库提供。</Text>
                </>}
                {panelTab === 'queue' && <>
                    {room?.current && <Text style={{ paddingVertical: 12 }}>正在播放：{room.current.title}</Text>}
                    {!room?.queue.length && <Text style={{ paddingVertical: 20 }}>暂无待播歌曲</Text>}
                    {room?.queue.map((track, i) => <View key={track.entryId} style={styles.track}><View style={{ flex: 1 }}><Text>{i + 1}. {track.title}</Text><Text style={styles.meta}>{track.artist} · {track.requestedByName}</Text></View>{room.canControl && button('置顶', () => { void act('top', { entryId: track.entryId }); })}{(room.canControl || track.requestedBy === self) && button('取消', () => { void act('remove', { entryId: track.entryId }); })}</View>)}
                    {room?.current && button(room.canControl ? '下一首' : `投票切歌 ${room.votes.length}/${room.votesNeeded}`, () => { void act(room.canControl ? 'next' : 'vote'); })}
                    {room?.canControl && button('清空队列', () => { void act('clearQueue'); })}
                </>}
                {panelTab === 'playlist' && <>
                    <View style={styles.row}>{music.sources.filter((s) => s.enabled).map((s) => <TouchableOpacity key={s.id} onPress={() => music.setSource(s.id)} style={[styles.button, music.source === s.id && { backgroundColor: '#cad8ea' }]}><Text>{s.name}</Text></TouchableOpacity>)}</View>
                    <TextInput style={styles.input} value={playlist} onChangeText={setPlaylist} autoCapitalize="none" placeholder="歌单 ID 或链接" />
                    {button('添加到点歌队列', () => { void act('playlist', { provider: music.source, id: playlist }, true); }, !playlist.trim())}
                    {room?.canControl && <>{button('设为空闲歌单', () => { void act('idle', { provider: music.source, id: playlist }); }, !playlist.trim())}{button('仅保存歌单', () => { void act('savePlaylist', { provider: music.source, id: playlist }); }, !playlist.trim())}</>}
                    <Text style={{ paddingVertical: 10 }}>空闲歌单：{room?.idlePlaylist.length || 0} 首 · {room?.idleMode === 'random' ? '随机播放' : '顺序播放'}</Text>
                    {room?.canControl && <View style={styles.row}>{button('顺序', () => { void act('idleMode', { mode: 'sequential' }); })}{button('随机', () => { void act('idleMode', { mode: 'random' }); })}{button('清除空闲歌单', () => { void act('clearIdle'); })}</View>}
                    {room?.savedPlaylists?.map((item) => <View key={item.key} style={{ paddingVertical: 10, borderTopWidth: 0.5, borderColor: '#bccbdd' }}><Text>{item.provider} · {item.id} · {item.trackCount} 首</Text><View style={styles.row}>{button('点播', () => { void act('playlist', { provider: item.provider, id: item.id }, true); })}{room.canControl && <>{button('空闲播放', () => { void act('idle', { provider: item.provider, id: item.id }); })}{button('更新', () => { void act('refreshSavedPlaylist', { key: item.key }); })}{button('移除', () => { void act('removeSavedPlaylist', { key: item.key }); })}</>}</View></View>)}
                </>}
                {panelTab === 'account' && music.panel && <MusicAccount />}
            </ScrollView>
        </SafeAreaView>
    </Modal>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }, button: { padding: 11, borderRadius: 6 }, input: { flexGrow: 1, minWidth: 140, backgroundColor: '#ffffffbb', padding: 11, borderRadius: 8 }, track: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0.5, borderColor: '#c5cfdd' }, meta: { color: '#667388', fontSize: 12, paddingVertical: 5 } });
