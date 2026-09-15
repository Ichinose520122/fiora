import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, View, Text, TouchableOpacity, StyleSheet, Easing } from 'react-native';
import { GlassView } from '../../components/PageContainer';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { parseLyrics } from '../../../../utils/music';
import { assetUrl } from '../../config';
import { useMusic } from './MusicSession';

export function time(seconds: number) { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`; }
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
    return <GlassView intensity={35} tint="light" style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={music.open} accessibilityLabel="打开音乐面板">
                <Animated.View style={[styles.disc, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>
                    {track.cover ? <Animated.Image source={{ uri: assetUrl(track.cover) }} style={{ width: 46, height: 46, borderRadius: 23 }} /> : <Ionicons name="musical-note" color="white" size={26} />}
                    <View style={styles.hole} />
                </Animated.View>
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 9 }}><Text numberOfLines={1} style={{ fontWeight: '600', color: '#24314a' }}>{track.title}</Text><Text numberOfLines={1} style={styles.meta}>{track.artist} · {track.idle ? '空闲歌单' : `${track.requestedByName || '用户'} 点播`}</Text><Text style={styles.meta}>{time(position)} / {time(track.duration)} · {room.listeners} 人收听 · 待播 {room.queue.length}</Text></View>
            <TouchableOpacity onPress={music.listening ? music.leave : music.join} style={styles.control} accessibilityLabel={music.listening ? '退出收听' : '加入收听'}><Ionicons name={music.listening ? 'volume-high-outline' : 'volume-mute-outline'} size={25} color="#526b98" /></TouchableOpacity>
            <TouchableOpacity onPress={() => { void music.act(room.canControl ? 'next' : 'vote'); }} style={styles.control}><Ionicons name="play-skip-forward" size={21} color="#526b98" /></TouchableOpacity>
        </View>
        <Text numberOfLines={1} style={styles.lyric}>{line?.text || (room.paused ? '已暂停' : '暂无歌词')}</Text>
        {!!translation?.text && <Text numberOfLines={1} style={styles.meta}>{translation.text}</Text>}
        <View style={styles.row}>
            {room.canControl && <TouchableOpacity onPress={() => { void music.act(room.paused ? 'resume' : 'pause'); }} style={styles.control}><Ionicons name={room.paused ? 'play' : 'pause'} size={19} color="#526b98" /></TouchableOpacity>}
            <Text style={styles.meta}>音量</Text><Slider style={{ flex: 1, height: 26 }} value={music.volume} minimumValue={0} maximumValue={1} onValueChange={music.setVolume} minimumTrackTintColor="#526b98" thumbTintColor="#526b98" /><Text style={styles.meta}>{Math.round(music.volume * 100)}%</Text>
        </View>
        {!!music.error && <TouchableOpacity onPress={music.join}><Text style={{ color: '#a34354', fontSize: 12 }}>{music.error}</Text></TouchableOpacity>}
    </GlassView>;
}
const styles = StyleSheet.create({
    card: { margin: 7, padding: 9, borderRadius: 14, overflow: 'hidden', backgroundColor: '#ffffff66', borderWidth: 1, borderColor: '#ffffff88' },
    row: { flexDirection: 'row', alignItems: 'center' },
    disc: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#252c39', alignItems: 'center', justifyContent: 'center' },
    hole: { position: 'absolute', width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: '#b9c3ce', backgroundColor: '#24314a' },
    control: { padding: 7 }, meta: { fontSize: 11, color: '#637087', marginTop: 2 },
    lyric: { fontSize: 13, color: '#344d70', textAlign: 'center', paddingTop: 6 },
});
