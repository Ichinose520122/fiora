import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { MusicSnapshot, MusicTrack, MusicProvider, musicPosition } from '@fiora/utils/music';
import { State } from '../../state/reducer';
import socket from '../../socket';
import fetch from '../../utils/fetch';
import Message from '../../components/Message';

type Source = { id: MusicProvider; name: string; enabled: boolean };
interface Session {
    room: MusicSnapshot | null;
    listening: boolean;
    playing: boolean;
    volume: number;
    position: number;
    error: string;
    sources: Source[];
    panel: boolean;
    keywords: string;
    selectedSource: MusicProvider;
    searchResults: MusicTrack[];
    busy: boolean;
    open: (keywords?: string) => void;
    close: () => void;
    join: () => void;
    leave: () => void;
    setVolume: (volume: number) => void;
    setKeywords: (value: string) => void;
    setSource: (value: MusicProvider) => void;
    search: () => Promise<void>;
    act: (action: string, data?: any) => Promise<boolean>;
    command: (command: string) => Promise<boolean>;
}
const Context = createContext<Session>(null as any);
export const useMusic = () => useContext(Context);
export function MusicSessionProvider({ children }: { children: React.ReactNode }) {
    const focus = useSelector((state: State) => state.focus);
    const userId = useSelector((state: State) => state.user?._id);
    const connected = useSelector((state: State) => state.connect);
    const [room, setRoom] = useState<MusicSnapshot | null>(null);
    const [sources, setSources] = useState<Source[]>([]);
    const [listening, setListening] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [position, setPosition] = useState(0);
    const [volume, updateVolume] = useState(() => {
        const saved = window.localStorage.getItem('music-volume');
        return saved !== null && Number.isFinite(Number(saved)) ? Math.min(1, Math.max(0, Number(saved))) : 0.5;
    });
    const [error, setError] = useState('');
    const [panel, setPanel] = useState(false);
    const [keywords, setKeywords] = useState('');
    const [selectedSource, setSource] = useState<MusicProvider>('netease');
    const [searchResults, setSearchResults] = useState<MusicTrack[]>([]);
    const [busy, setBusy] = useState(false);
    const audio = useRef<HTMLAudioElement | null>(null);
    const roomRef = useRef<MusicSnapshot | null>(null);
    const identity = useRef({ focus, userId });
    identity.current = { focus, userId };
    const listeningRef = useRef(false);
    const clockOffset = useRef(0);
    const generation = useRef(0);
    const searchSequence = useRef(0);
    const syncPending = useRef(false);
    const playPending = useRef(false);
    const blocked = useRef(false);
    const setVolume = (value: number) => {
        updateVolume(value);
        window.localStorage.setItem('music-volume', String(value));
        if (audio.current) audio.current.volume = value;
    };
    function accept(value: MusicSnapshot, started?: number) {
        if (!value || value.roomId !== identity.current.focus) return;
        if (roomRef.current?.roomId === value.roomId && value.revision < roomRef.current.revision) return;
        clockOffset.current = value.serverTime - (started ? (started + Date.now()) / 2 : Date.now());
        roomRef.current = value;
        setRoom(value);
    }
    async function refresh() {
        if (syncPending.current || !userId || !focus || !connected) return;
        syncPending.current = true;
        const version = generation.current;
        const started = Date.now();
        const [err, result] = await fetch<MusicSnapshot & { sources: Source[] }>('musicGetState',
            { roomId: focus, listening: listeningRef.current }, { toast: false });
        syncPending.current = false;
        if (version !== generation.current) return;
        if (result) { accept(result, started); setSources(result.sources); }
        else if (err && !/断开|超时/.test(err)) {
            setError(err); listeningRef.current = false; setListening(false); audio.current?.pause();
            fetch('musicLeave', {}, { toast: false });
        }
    }
    function synchronize() {
        const el = audio.current;
        const current = roomRef.current;
        if (!el || !current) return;
        if (!socket.connected) { el.pause(); return; }
        const expected = musicPosition(current, Date.now() + clockOffset.current);
        setPosition(expected);
        if (!listeningRef.current || !current.current || current.paused) { el.pause(); return; }
        if (el.readyState >= 1 && Math.abs(el.currentTime - expected) > 0.8) {
            try { el.currentTime = expected; } catch (_) { /* wait for metadata */ }
        }
        if (el.paused && !blocked.current && !playPending.current && el.readyState >= 2) {
            playPending.current = true;
            el.play().catch((err) => {
                if (err.name !== 'AbortError') {
                    blocked.current = true;
                    setError('浏览器暂停了播放，请点击“加入 / 重试播放”');
                }
            }).finally(() => { playPending.current = false; });
        }
    }
    function join() {
        listeningRef.current = true;
        setListening(true);
        blocked.current = false;
        setError('');
        // Call play synchronously in the user gesture for mobile autoplay policies.
        if (audio.current && roomRef.current?.current && !roomRef.current.paused) {
            const url = roomRef.current.current.url;
            if (url && audio.current.src !== new URL(url, window.location.origin).href) audio.current.src = url;
            audio.current.play().catch((err) => {
                if (err.name === 'AbortError') return;
                blocked.current = true;
                setError('播放未能开始，请重试；也可以换一首歌曲');
            });
        }
        refresh();
        synchronize();
    }
    function leave() {
        listeningRef.current = false;
        setListening(false);
        audio.current?.pause();
        refresh();
    }
    useEffect(() => {
        const el = document.createElement('audio');
        el.preload = 'auto';
        el.hidden = true;
        el.setAttribute('aria-label', '一起听音频');
        document.body.appendChild(el);
        el.volume = volume;
        el.onplaying = () => { setPlaying(true); setError(''); };
        el.onpause = () => setPlaying(false);
        el.onwaiting = () => setPlaying(false);
        el.onloadedmetadata = synchronize;
        el.oncanplay = synchronize;
        el.onerror = () => {
            blocked.current = true;
            setPlaying(false);
            setError('歌曲加载失败，可重试播放或投票切歌');
        };
        // A single listener ending/buffering must never advance the shared queue.
        audio.current = el;
        const tick = window.setInterval(synchronize, 500);
        return () => { clearInterval(tick); el.pause(); el.removeAttribute('src'); el.load(); el.remove(); audio.current = null; };
    }, []);
    useEffect(() => {
        generation.current += 1;
        roomRef.current = null;
        setRoom(null);
        setPosition(0);
        setError('');
        setSearchResults([]);
        searchSequence.current += 1;
        setBusy(false);
        setPanel(false);
        listeningRef.current = false;
        setListening(false);
        audio.current?.pause();
        if (audio.current) { audio.current.removeAttribute('src'); audio.current.load(); }
        return () => { if (socket.connected) fetch('musicLeave', {}, { toast: false }); };
    }, [focus, userId]);
    useEffect(() => {
        if (!connected) { audio.current?.pause(); return undefined; }
        refresh();
        const timer = window.setInterval(refresh, 15000);
        const visible = () => { if (!document.hidden) { blocked.current = false; refresh(); } };
        document.addEventListener('visibilitychange', visible);
        window.addEventListener('focus', visible);
        return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', visible); };
    }, [focus, userId, connected]);
    useEffect(() => {
        const state = (value: MusicSnapshot) => accept(value);
        const lost = (value: { roomId: string }) => {
            if (value.roomId === identity.current.focus) {
                listeningRef.current = false; setListening(false); audio.current?.pause();
                roomRef.current = null; setRoom(null); setError('已失去此房间的访问权限');
            }
        };
        socket.on('musicState', state); socket.on('musicAccessLost', lost);
        return () => { socket.off('musicState', state); socket.off('musicAccessLost', lost); };
    }, []);
    useEffect(() => {
        const el = audio.current;
        if (!el) return;
        blocked.current = false;
        setError('');
        if (room?.current?.url && listening) {
            const target = new URL(room.current.url, window.location.origin).href;
            if (el.src !== target) { el.src = target; el.load(); }
        } else { el.pause(); el.removeAttribute('src'); el.load(); }
        synchronize();
    }, [room?.current?.entryId, room?.current?.url, listening]);
    useEffect(() => { synchronize(); }, [room?.revision, connected]);
    async function act(action: string, data: any = {}) {
        const target = focus;
        const requestId = Date.now().toString(36) + Math.random().toString(36).slice(2);
        const [err, result] = await fetch<MusicSnapshot>('musicAction', {
            roomId: target, action, entryId: roomRef.current?.current?.entryId, ...data, requestId,
        });
        if (err || !result) return false;
        if (target === identity.current.focus) accept(result);
        return true;
    }
    async function doSearch(source = selectedSource, query = keywords) {
        const sequence = ++searchSequence.current;
        const target = focus;
        setBusy(true);
        const [, result] = await fetch<{ tracks: MusicTrack[] }>('musicSearch',
            { roomId: target, provider: source, keywords: query });
        if (sequence === searchSequence.current && target === identity.current.focus) {
            setSearchResults(result?.tracks || []); setBusy(false);
        }
        return result?.tracks || [];
    }
    async function command(input: string) {
        const parts = input.trim().split(/\s+/);
        parts.shift();
        const sub = parts[0] || '';
        const rest = parts.slice(1).join(' ');
        if (!sub || sub === 'help' || sub === 'list') { setPanel(true); return true; }
        if (sub === 'join') { join(); return true; }
        if (sub === 'leave') { leave(); return true; }
        if (['pause', 'resume', 'next', 'vote'].includes(sub)) return act(sub);
        if (sub === 'search') { setKeywords(rest); setPanel(true); await doSearch(selectedSource, rest); return true; }
        if (sub === 'playlist') {
            if (!rest) { Message.info('用法：/music playlist 歌单ID或链接'); return false; }
            join(); return act('playlist', { provider: selectedSource, id: rest });
        }
        let source = selectedSource;
        let query = parts.join(' ');
        if (['local', 'netease', 'qq'].includes(sub)) {
            source = sub as MusicProvider; query = rest; setSource(source);
        }
        if (!query) { setPanel(true); return true; }
        // Literal IDs and complete links are resolved by the server; never fetch user URLs.
        if (source === 'netease' && (/^\d+$/.test(query) || /^https?:/.test(query))) {
            join(); return act('add', { provider: source, id: query });
        }
        const tracks = await doSearch(source, query);
        if (focus !== identity.current.focus) return false;
        if (!tracks.length) { Message.info('没有找到歌曲，试试其他关键词或音乐源'); return false; }
        join();
        const ok = await act('add', { provider: source, id: tracks[0].id });
        if (ok) Message.success('已点歌：' + tracks[0].title);
        return ok;
    }
    const value: Session = { room, listening, playing, volume, position, error, sources, panel, keywords,
        selectedSource, searchResults, busy, open: (query) => {
            if (!focus || !userId) { Message.info('先选择一个群聊或私聊'); return; }
            if (typeof query === 'string') setKeywords(query);
            setPanel(true);
        }, close: () => setPanel(false), join, leave, setVolume, setKeywords, setSource,
        search: async () => { await doSearch(); }, act, command };
    return <Context.Provider value={value}>{children}</Context.Provider>;
}
