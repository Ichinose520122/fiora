import React, { useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Ionicons } from '@expo/vector-icons';
import { AppRelease, checkAppUpdate, releasePage } from '../../utils/appUpdate';

export default function AppUpdate() {
    const [release, setRelease] = useState<AppRelease | null>(null);
    const [message, setMessage] = useState('从 GitHub 获取最新 Android 构建');
    const [busy, setBusy] = useState(false); const [progress, setProgress] = useState<number | null>(null);
    const [apk, setApk] = useState(''); const [settings, setSettings] = useState(false);
    const current = Number(Application.nativeBuildVersion || 0);
    const mounted = useRef(true); const running = useRef(false);
    const request = useRef<AbortController | null>(null);
    const download = useRef<FileSystem.DownloadResumable | null>(null);
    async function check() {
        if (running.current) return;
        running.current = true; setBusy(true); setMessage('正在检查更新…');
        const controller = new AbortController(); request.current = controller;
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
            const next = await checkAppUpdate(controller.signal);
            if (!mounted.current) return;
            setRelease(next); setApk(''); setSettings(false);
            setMessage(next.versionCode > current ? `发现新版本 ${next.version} · ${(next.size / 1024 / 1024).toFixed(1)} MB` : '已经是最新版本');
        } catch (error) {
            if (mounted.current) setMessage(controller.signal.aborted ? '连接 GitHub 超时，请稍后重试' : error instanceof Error ? error.message : '检查更新失败');
        } finally { clearTimeout(timer); running.current = false; if (mounted.current) setBusy(false); }
    }
    useEffect(() => {
        mounted.current = true; void check();
        return () => { mounted.current = false; request.current?.abort(); void download.current?.cancelAsync().catch(() => {}); };
    }, []);
    async function install(uri: string) {
        try {
            const contentUri = await FileSystem.getContentUriAsync(uri);
            await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: contentUri, type: 'application/vnd.android.package-archive', flags: 1 });
            if (mounted.current) { setSettings(true); setMessage('安装包已就绪；按系统提示允许安装，然后完成更新'); }
        } catch {
            if (mounted.current) { setSettings(true); setMessage('请允许 Fiora 安装应用，然后点击重新安装'); }
        }
    }
    async function getApk() {
        if (!release || running.current) return;
        if (apk) { await install(apk); return; }
        if (!FileSystem.cacheDirectory) { setMessage('无法访问下载目录'); return; }
        running.current = true; setBusy(true); setProgress(0); setMessage('正在下载更新…');
        const directory = `${FileSystem.cacheDirectory}app-update/`;
        const path = `${directory}fiora-${release.versionCode}.apk`;
        try {
            await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
            // Only this component's temporary APKs are cleaned; user files are untouched.
            for (const file of await FileSystem.readDirectoryAsync(directory)) {
                if (/^fiora-\d+\.apk$/.test(file)) await FileSystem.deleteAsync(`${directory}${file}`, { idempotent: true });
            }
            if (!mounted.current) return;
            download.current = FileSystem.createDownloadResumable(release.url, path, {}, ({ totalBytesWritten }) => {
                if (mounted.current) setProgress(Math.min(1, totalBytesWritten / release.size));
            });
            const result = await download.current.downloadAsync();
            if (!result || result.status !== 200) throw new Error('下载未完成，请重试');
            const info = await FileSystem.getInfoAsync(path, { md5: true });
            if (!info.exists || info.size !== release.size || info.md5 !== release.md5) throw new Error('安装包校验失败，请重新下载');
            if (mounted.current) { setApk(path); setProgress(null); await install(path); }
        } catch (error) {
            await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
            if (mounted.current) setMessage(error instanceof Error ? error.message : '下载失败，请重试');
        } finally { download.current = null; running.current = false; if (mounted.current) { setBusy(false); setProgress(null); } }
    }
    return <View style={styles.card}>
        <View style={styles.row}><View style={styles.icon}><Ionicons name="cloud-download-outline" size={23} color="#5969b0" /></View><View style={{ flex: 1 }}><Text style={styles.title}>应用更新</Text><Text style={styles.caption}>当前 {Application.nativeApplicationVersion || '开发版'} · 构建 {current || '本地'}</Text></View></View>
        <Text style={styles.message}>{message}</Text>
        {progress !== null && <><View style={styles.track}><View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} /></View><Text style={styles.caption}>{Math.round(progress * 100)}%</Text></>}
        <View style={styles.actions}>
            <TouchableOpacity disabled={busy} style={styles.button} onPress={() => void check()}><Text style={styles.label}>{busy ? '处理中…' : '检查更新'}</Text></TouchableOpacity>
            {release && release.versionCode > current && Platform.OS === 'android' && <TouchableOpacity disabled={busy} style={[styles.button, styles.primary]} onPress={() => void getApk()}><Text style={{ color: 'white' }}>{apk ? '重新安装' : '下载并安装'}</Text></TouchableOpacity>}
            <TouchableOpacity style={styles.button} onPress={() => { void Linking.openURL(releasePage).catch(() => setMessage('无法打开浏览器')); }}><Text style={styles.label}>发布记录</Text></TouchableOpacity>
        </View>
        {settings && <TouchableOpacity onPress={() => { void IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', { data: `package:${Application.applicationId}` }).catch(() => setMessage('请到系统设置中允许 Fiora 安装未知应用')); }}><Text style={styles.label}>打开安装权限设置</Text></TouchableOpacity>}
    </View>;
}
const styles = StyleSheet.create({
    card: { backgroundColor: '#ffffffc9', borderRadius: 22, padding: 18, marginTop: 14, borderWidth: 1, borderColor: '#ffffff' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, icon: { backgroundColor: '#eef0fd', padding: 10, borderRadius: 15 },
    title: { color: '#26344d', fontSize: 16, fontWeight: '600' }, caption: { color: '#8490a5', fontSize: 11, marginTop: 5 }, message: { color: '#67758d', fontSize: 13, marginVertical: 14, lineHeight: 20 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, button: { paddingVertical: 10, paddingHorizontal: 13, backgroundColor: '#eef1fa', borderRadius: 12 }, primary: { backgroundColor: '#5969b0' }, label: { color: '#5969b0', fontSize: 13 }, track: { height: 5, backgroundColor: '#e5eaf3', borderRadius: 4, overflow: 'hidden' }, fill: { height: 5, backgroundColor: '#7481c5' },
});
