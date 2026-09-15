import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { MusicSnapshot, MusicTrack, MusicProvider, musicPosition } from '../../../../utils/music';
import { useFocus, useSelfId, useStore } from '../../hooks/useStore';
import socket from '../../socket';
import fetch from '../../utils/fetch';
import { assetUrl } from '../../config';
import { getStorageValue, setStorageValue } from '../../utils/storage';

type Source = { id: MusicProvider; name: string; enabled: boolean };
interface Session {
    room: MusicSnapshot | null; listening: boolean; position: number; volume: number;
    error: string; sources: Source[]; panel: boolean; panelTab: string;
    keywords: string; source: MusicProvider; tracks: MusicTrack[]; busy: boolean;
    open: () => void; close: () => void; join: () => void; leave: () => void;
    setVolume: (value: number) => void; setPanelTab: (value: string) => void;
    setKeywords: (value: string) => void; setSource: (value: MusicProvider) => void;
    search: () => Promise<void>; act: (action: string, data?: Record<string, unknown>) => Promise<boolean>;
    command: (input: string) => string;
}
const Context = createContext<Session>(null as unknown as Session);
export const useMusic = () => useContext(Context);

// A new native player is created for each track; an old seek/load can never resume the next room.
function Playback({ room, offset, volume, fail, onLocalPause }: { room: MusicSnapshot; offset: number; volume: number; fail: (error: string) => void; onLocalPause: () => void }) {
    const track = room.current!;
    const player = useAudioPlayer({ uri: assetUrl(track.url!) }, { updateInterval: 500 });
    const status = useAudioPlayerStatus(player);
    const latest = useRef({ room, offset }); latest.current = { room, offset };
    useEffect(() => { player.volume = volume; }, [volume, player]);
    useEffect(() => {
        if (status.error) fail('歌曲加载失败，可退出后重试或切歌');
    }, [status.error]);
    // Layout cleanup runs before Expo releases its shared native player.
    useLayoutEffect(() => {
        let active = true;
        let seeking = false;
        let hadPlayed = false;
        let locallyPaused = false;
        player.setActiveForLockScreen(true, { title: track.title, artist: track.artist, artworkUrl: track.cover ? assetUrl(track.cover) : undefined });
        async function sync() {
            const current = latest.current;
            if (!socket.connected || current.room.paused) { player.pause(); return; }
            if (locallyPaused || !player.isLoaded || seeking || player.currentStatus.error) return;
            const expected = musicPosition(current.room, Date.now() + current.offset);
            // Completion is server-controlled, never emit "next" from a client.
            if (expected >= current.room.current!.duration) { player.pause(); return; }
            if (Math.abs(player.currentTime - expected) > 1.2) {
                seeking = true;
                try { await player.seekTo(expected); }
                catch { /* Retry when the native source has loaded. */ }
                finally { seeking = false; }
            }
            if (active && socket.connected && !latest.current.room.paused && !player.playing) player.play();
        }
        const run = () => { void sync().catch(() => { if (active) fail('播放失败，请重新加入收听'); }); };
        const localControls = player.addListener('playbackStatusUpdate', (value) => {
            if (value.playing) hadPlayed = true;
            else if (active && hadPlayed && !locallyPaused && !seeking && socket.connected && !latest.current.room.paused && value.isLoaded && !value.isBuffering && !value.didJustFinish && !value.error && musicPosition(latest.current.room, Date.now() + latest.current.offset) < latest.current.room.current!.duration - 0.5) {
                // A headset/lock-screen pause or audio interruption only leaves this listener.
                locallyPaused = true; onLocalPause();
            }
        });
        const pause = () => player.pause();
        socket.on('disconnect', pause);
        const timer = setInterval(run, 500);
        run();
        return () => { active = false; localControls.remove(); clearInterval(timer); socket.off('disconnect', pause); player.pause(); player.setActiveForLockScreen(false); };
    }, [player]);
    return null;
}
export function MusicSessionProvider({ children }: { children: React.ReactNode }) {
    const focus = useFocus(); const userId = useSelfId();
    // Remounting cancels old room requests, subscriptions, searches and audio together.
    return <RoomSession key={`${userId}:${focus}`} focus={focus} userId={userId}>{children}</RoomSession>;
}
function RoomSession({ children, focus, userId }: { children: React.ReactNode; focus: string; userId: string }) {
    const { connect } = useStore();
    const [room, setRoom] = useState<MusicSnapshot | null>(null);
    const roomRef = useRef<MusicSnapshot | null>(null);
    const live = useRef(true);
    const clock = useRef(0);
    const listeningRef = useRef(false);
    const [listening, setListening] = useState(false);
    const [playerEpoch, setPlayerEpoch] = useState(0);
    const [position, setPosition] = useState(0);
    const [volume, updateVolume] = useState(0.5);
    const volumeChanged = useRef(false);
    const [sources, setSources] = useState<Source[]>([]);
    const [error, setError] = useState('');
    const [panel, setPanel] = useState(false);
    const [panelTab, setPanelTab] = useState('search');
    const [keywords, setKeywords] = useState('');
    const [source, setSource] = useState<MusicProvider>('netease');
    const [tracks, setTracks] = useState<MusicTrack[]>([]);
    const [busy, setBusy] = useState(false);
    const searchId = useRef(0);
    const subscriptionId = useRef(0);
    function accept(value: MusicSnapshot, started?: number) {
        if (!live.current || value.roomId !== focus || value.revision < (roomRef.current?.revision ?? -1)) return;
        clock.current = value.serverTime - (started ? (started + Date.now()) / 2 : Date.now());
        roomRef.current = value; setRoom(value);
    }
    async function refresh() {
        if (!focus || !userId || !socket.connected || !live.current) return;
        const id = ++subscriptionId.current;
        const started = Date.now();
        const [err, data] = await fetch<MusicSnapshot & { sources: Source[] }>('musicGetState', { roomId: focus, listening: listeningRef.current }, { toast: false });
        if (!live.current || id !== subscriptionId.current) return;
        if (data) { accept(data, started); setSources(data.sources); }
        else if (err) {
            setError(err);
            if (!/断开|超时/.test(err)) { listeningRef.current = false; setListening(false); setRoom(null); roomRef.current = null; }
        }
    }
    function join() { setPlayerEpoch((value) => value + 1); listeningRef.current = true; setListening(true); setError(''); void refresh(); }
    function leave() { listeningRef.current = false; setListening(false); void refresh(); }
    function fail(message: string) { if (live.current) setError(message); }
    useEffect(() => {
        live.current = true;
        void setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(() => fail('设备暂不支持后台音频'));
        void getStorageValue('music-volume').then((value) => {
            if (live.current && !volumeChanged.current && value !== null && Number.isFinite(Number(value))) updateVolume(Math.max(0, Math.min(1, Number(value))));
        }).catch(() => {});
        const state = (value: MusicSnapshot) => accept(value);
        const lost = (value: { roomId: string }) => { if (value.roomId === focus) { ++subscriptionId.current; listeningRef.current = false; setListening(false); roomRef.current = null; setRoom(null); setError('已失去此房间的访问权限'); } };
        socket.on('musicState', state); socket.on('musicAccessLost', lost);
        const timer = setInterval(() => { if (roomRef.current) setPosition(musicPosition(roomRef.current, Date.now() + clock.current)); }, 500);
        return () => {
            live.current = false; ++searchId.current; ++subscriptionId.current;
            clearInterval(timer); socket.off('musicState', state); socket.off('musicAccessLost', lost);
            if (socket.connected && focus && userId) void fetch('musicLeave', {}, { toast: false });
        };
    }, []);
    useEffect(() => {
        if (!connect) return;
        void refresh();
        const timer = setInterval(() => { void refresh(); }, 15000);
        const subscription = AppState.addEventListener('change', (value) => { if (value === 'active') void refresh(); });
        return () => { clearInterval(timer); subscription.remove(); };
    }, [connect]);
    async function act(action: string, data: Record<string, unknown> = {}) {
        const [err, result] = await fetch<MusicSnapshot>('musicAction', {
            roomId: focus, action, entryId: roomRef.current?.current?.entryId, ...data,
            requestId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
        });
        if (!live.current || err || !result) return false;
        accept(result); return true;
    }
    async function search() {
        if (!keywords.trim() && source !== 'local') return;
        const id = ++searchId.current; setBusy(true);
        const [, data] = await fetch<{ tracks: MusicTrack[] }>('musicSearch', { roomId: focus, provider: source, keywords: keywords.trim() });
        if (live.current && id === searchId.current) { setTracks(data?.tracks || []); setBusy(false); }
    }
    function command(input: string) {
        const parts = input.trim().split(/\s+/).slice(1);
        const sub = parts[0] || '';
        if (sub === 'login') { setPanelTab('account'); setPanel(true); return '/music login'; }
        if (sub === 'join') join();
        else if (sub === 'leave' || sub === 'stop') leave();
        else if (sub === 'list') { setPanelTab('queue'); setPanel(true); }
        else if (!sub || sub === 'help') { setPanelTab('search'); setPanel(true); }
        else if (!['pause', 'resume', 'next', 'vote', 'search', 'cookie', 'captcha', 'phone', 'password'].includes(sub)) join();
        if (sub === 'search' || sub === 'playlist') {
            if (!['local', 'netease', 'qq'].includes(parts[1])) parts.splice(1, 0, source);
        } else if (sub && !['help', 'login', 'join', 'leave', 'stop', 'list', 'pause', 'resume', 'next', 'vote', 'local', 'netease', 'qq', 'cookie', 'captcha', 'phone', 'password'].includes(sub)) parts.unshift(source);
        return '/music ' + parts.join(' ');
    }
    const value: Session = { room, listening, position, volume, error, sources, panel, panelTab, keywords, source, tracks, busy,
        open: () => { if (focus && userId) setPanel(true); }, close: () => setPanel(false), setPanelTab, setKeywords,
        setSource: (next) => { ++searchId.current; setSource(next); setTracks([]); setBusy(false); },
        join, leave, act, search, command, setVolume: (next) => {
            const v = Math.max(0, Math.min(1, next)); volumeChanged.current = true; updateVolume(v);
            void setStorageValue('music-volume', String(v)).catch(() => {});
        } };
    return <Context.Provider value={value}>
        {children}
        {connect && listening && room?.current?.url && <Playback key={`${playerEpoch}:${room.current.entryId}:${room.current.url}`} room={room} offset={clock.current} volume={volume} fail={fail} onLocalPause={leave} />}
    </Context.Provider>;
}
