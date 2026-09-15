import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, View, Text, TouchableOpacity, StyleSheet, Easing } from 'react-native';
import { GlassView } from '../../components/PageContainer';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { parseLyrics } from '../../../../utils/music';
import { assetUrl } from '../../config';
import { useMusic } from './MusicSession';

export function time(seconds: number) { const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0; return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, '0')}`; }
export default function MusicPlayer() {
    const music = useMusic(); const { room, position } = music;
    const spin = useRef(new Animated.Value(0)).current;
    const lyrics = useMemo(() => parseLyrics(room?.current?.lyrics), [room?.current?.lyrics]);
    const translated = useMemo(() => parseLyrics(room?.current?.translatedLyrics), [room?.current?.translatedLyrics]);
    useEffect(() => {
        if (!music.listening || room?.paused || !room?.current) return;
        const animation = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true }));
        animation.start(); return () => { animation.stop(); spin.setValue(0); };
    }, [music.listening, room?.paused, room?.current?.entryId]);
    if (!room?.current) return null;
    const track = room.current;
    const line = lyrics.filter((item) => item.time <= position).pop();
    const translation = translated.filter((item) => item.time <= position).pop();
    const percent = track.duration > 0 ? Math.min(100, Math.max(0, position / track.duration * 100)) : 0;
    return <GlassView intensity={42} tint="light" style={styles.card}>
        <View style={styles.row}>
            <TouchableOpacity onPress={music.open} accessibilityLabel="打开音乐面板">
                <Animated.View style={[styles.disc, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
                    {track.cover ? <Animated.Image source={{ uri: assetUrl(track.cover) }} style={styles.cover} /> : <Ionicons name="musical-note" color="white" size={24} />}<View style={styles.hole} />
                </Animated.View>
            </TouchableOpacity>
            <TouchableOpacity onPress={music.open} style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                <Text numberOfLines={1} style={styles.title}>{track.title}</Text>
                <Text numberOfLines={1} style={styles.meta}>{track.artist} · {track.idle ? '空闲歌单' : `${track.requestedByName || '用户'} 点播`}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 }}><View style={[styles.dot, { backgroundColor: music.listening ? '#74b3a7' : '#adb6c7' }]} /><Text style={styles.status}>{room.paused ? '已暂停' : music.listening ? '正在一起听' : '点击加入收听'} · {room.listeners} 人</Text></View>
            </TouchableOpacity>
            <TouchableOpacity onPress={music.open} style={styles.queue} accessibilityLabel="查看点歌队列"><Ionicons name="list-outline" size={20} color="#7382a5" /><Text style={styles.status}>{room.queue.length}</Text></TouchableOpacity>
        </View>
        <View style={styles.lyrics}><Text numberOfLines={1} style={styles.lyric}>{line?.text || '纯音乐，也很好听'}</Text>{!!translation?.text && <Text numberOfLines={1} style={styles.translation}>{translation.text}</Text>}</View>
        <View style={styles.timeline}><View style={[styles.progress, { width: `${percent}%` }]} /></View>
        <View style={[styles.row, { justifyContent: 'space-between', marginTop: 5 }]}><Text style={styles.clock}>{time(position)}</Text><Text style={styles.clock}>{time(track.duration)}</Text></View>
        <View style={[styles.row, { marginTop: 2 }]}>
            <TouchableOpacity onPress={music.listening ? music.leave : music.join} style={styles.join} accessibilityLabel={music.listening ? '退出收听' : '加入收听'}><Ionicons name={music.listening ? 'headset' : 'headset-outline'} size={17} color="#5e6fa9" /><Text style={styles.joinText}>{music.listening ? '收听中' : '一起听'}</Text></TouchableOpacity>
            <Slider accessibilityLabel="播放音量" style={{ flex: 1, minWidth: 30, height: 32 }} value={music.volume} minimumValue={0} maximumValue={1} onValueChange={music.setVolume} minimumTrackTintColor="#8898cb" thumbTintColor="#7484b8" />
            <Text style={styles.volume}>{Math.round(music.volume * 100)}%</Text>
            {room.canControl && <TouchableOpacity accessibilityLabel={room.paused ? '继续播放' : '暂停房间播放'} onPress={() => { void music.act(room.paused ? 'resume' : 'pause'); }} style={styles.control}><Ionicons name={room.paused ? 'play' : 'pause'} size={20} color="#5e6fa9" /></TouchableOpacity>}
            <TouchableOpacity accessibilityLabel={room.canControl ? '下一首' : '投票切歌'} onPress={() => { void music.act(room.canControl ? 'next' : 'vote'); }} style={styles.control}><Ionicons name="play-skip-forward" size={19} color="#5e6fa9" /></TouchableOpacity>
        </View>
        {!!music.error && <TouchableOpacity onPress={music.join}><Text style={styles.error}>{music.error}</Text></TouchableOpacity>}
    </GlassView>;
}
const styles = StyleSheet.create({
    card: { marginHorizontal: 12, marginTop: 10, marginBottom: 6, padding: 13, borderRadius: 23, overflow: 'hidden', backgroundColor: '#ffffff70', borderWidth: 1, borderColor: '#ffffffbd' },
    row: { flexDirection: 'row', alignItems: 'center' }, disc: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#2e364c', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#424a61' }, cover: { width: 41, height: 41, borderRadius: 22 }, hole: { position: 'absolute', width: 8, height: 8, borderRadius: 5, borderWidth: 2, borderColor: '#ced5e5', backgroundColor: '#333e55' },
    title: { fontWeight: '700', color: '#303d5a', fontSize: 15 }, meta: { fontSize: 11, color: '#8390a6', marginTop: 4 }, status: { fontSize: 10, color: '#8190a9' }, dot: { width: 5, height: 5, borderRadius: 3 }, queue: { alignItems: 'center', paddingLeft: 12, gap: 2 },
    lyrics: { minHeight: 30, justifyContent: 'center', paddingVertical: 8 }, lyric: { fontSize: 12, color: '#6777ae', textAlign: 'center', fontWeight: '500' }, translation: { fontSize: 10, color: '#93a0b4', textAlign: 'center', marginTop: 3 }, timeline: { height: 3, backgroundColor: '#7285a514', borderRadius: 3, overflow: 'hidden' }, progress: { height: 3, backgroundColor: '#97a6d4' }, clock: { color: '#9aa5b8', fontSize: 9, fontVariant: ['tabular-nums'] },
    control: { padding: 9 }, join: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#e3e9fa99', paddingHorizontal: 9, paddingVertical: 8, borderRadius: 12 }, joinText: { color: '#5e6fa9', fontSize: 11 }, volume: { color: '#8b98b2', fontSize: 9, width: 29, textAlign: 'right' }, error: { color: '#a86179', fontSize: 11, paddingTop: 5 },
});
