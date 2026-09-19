import { ThemedText as Text } from './ThemedText';
import { useAppTheme } from '../utils/theme';
import Constants from 'expo-constants';
import React, { useEffect, useState } from 'react';
import { Alert, AppRegistry, AppState, Linking, Platform, Switch, View, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo';
import * as Notifications from 'expo-notifications';
import { useIsLogin, useStore } from '../hooks/useStore';
import socket, { resumeConnection } from '../socket';
import store from '../state/store';
import { readSession } from '../utils/session';
import { prepareNotificationChannels } from '../utils/messageNotifications';
import Toast from './Toast';

const service = Platform.OS === 'android' ? requireOptionalNativeModule('FioraConnection') : null;
let offeringBatteryAccess = false;
async function offerBatteryAccess() {
    if (!service || service.isBatteryUnrestricted() || offeringBatteryAccess) return;
    offeringBatteryAccess = true;
    try {
        const key = 'fiora-background-access-prompt-v1';
        if (await AsyncStorage.getItem(key)) return;
        // Let the system notification permission dialog finish first.
        if ((await Notifications.getPermissionsAsync()).status === 'undetermined') return;
        if (AppState.currentState !== 'active' || !service.isEnabled() || !store.getState().user) return;
        await AsyncStorage.setItem(key, 'shown');
        Alert.alert('允许锁屏后接收消息', '后台在线已开启。请在系统中允许 Fiora 不受电池优化限制，否则锁屏后系统仍可能暂停网络；这会增加耗电。', [
            { text: '稍后设置', style: 'cancel' },
            { text: '去允许', onPress: () => { void service.openBatterySettings().catch(() => Linking.openSettings()); } },
        ]);
    } finally { offeringBatteryAccess = false; }
}
const tasks = new Map<number, Promise<void>>();
AppRegistry.registerHeadlessTask('FioraConnection', () => () => {
    const generation = service?.getGeneration();
    if (!tasks.has(generation)) {
        const task = (async () => {
            // Install this listener inside the headless task too: a restarted
            // process need not mount the React settings/UI component.
            const network = service?.addListener('onNetworkAvailable', () => { void resumeConnection().catch(() => {}); });
            let previousConnected: boolean | undefined;
            const unsubscribe = store.subscribe(() => {
                const connected = socket.connected && store.getState().connect;
                if (connected !== previousConnected) {
                    previousConnected = connected;
                    void service?.heartbeat(connected).catch(() => {});
                }
            });
            try {
                while (service?.isRunning() && service.isEnabled() && service.getGeneration() === generation) {
                    try {
                        // A transient storage failure must not finish the headless task.
                        if (!(await readSession())) { await service.stop(); break; }
                        await service.heartbeat(socket.connected && store.getState().connect);
                        // History sync may take several requests; don't block service health updates.
                        void resumeConnection().catch(() => {});
                    } catch { /* Retry temporary storage/native failures on the next tick. */ }
                    await new Promise(resolve => setTimeout(resolve, 20000));
                }
            } finally { network?.remove(); unsubscribe(); }
        })().finally(() => { tasks.delete(generation); });
        tasks.set(generation, task);
    }
    return tasks.get(generation)!;
});

export function BackgroundConnection() {
    const theme = useAppTheme();

    const loggedIn = useIsLogin();
    useEffect(() => {
        if (!service) return;
        let live = true;
        const sync = async () => {
            if (!loggedIn) {
                // Do not stop a sticky restart while automatic login is still loading.
                if (!(await readSession()) && live && !store.getState().user) await service.stop();
                return;
            }
            if (AppState.currentState !== 'active' || !service.isEnabled()) return;
            // Notification setup failure must not prevent the connection service itself.
            await prepareNotificationChannels().catch(() => {});
            if (live && store.getState().user && AppState.currentState === 'active') {
                await service.start();
                void offerBatteryAccess().catch(() => {});
            }
        };
        void sync().catch(() => Toast.warning('后台在线未能启动，可在“我”中重新开启'));
        const app = AppState.addEventListener('change', (state) => { if (state === 'active') void sync().catch(() => {}); });
        const timer = setInterval(() => {
            if (AppState.currentState === 'active' && !service.isRunning()) void sync().catch(() => {});
        }, 10000);
        return () => { live = false; app.remove(); clearInterval(timer); };
    }, [loggedIn]);
    return null;
}

export function BackgroundConnectionSetting() {
    const theme = useAppTheme();

    const { connect } = useStore();
    const [enabled, setEnabled] = useState(Boolean(service?.isEnabled()));
    const [unrestricted, setUnrestricted] = useState(Boolean(service?.isBatteryUnrestricted()));
    const [allowed, setAllowed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [health, setHealth] = useState({ running: false, responsive: false });
    const [channelAllowed, setChannelAllowed] = useState(true);
    useEffect(() => {
        let live = true;
        const refresh = () => {
            if (!live) return;
            setHealth(service?.getStatus() || { running: false, responsive: false });
            void Notifications.getNotificationChannelAsync('chat-messages').then(channel => { if (live) setChannelAllowed(!channel || channel.importance !== Notifications.AndroidImportance.NONE); }).catch(() => {});
            setEnabled(Boolean(service?.isEnabled())); setUnrestricted(Boolean(service?.isBatteryUnrestricted()));
            void Notifications.getPermissionsAsync().then((permission) => { if (live) setAllowed(permission.granted); }).catch(() => {});
        };
        refresh(); const listener = AppState.addEventListener('change', refresh);
        const timer = setInterval(refresh, 5000);
        return () => { live = false; listener.remove(); clearInterval(timer); };
    }, []);
    if (!service) return null;
    return <View style={{ padding: 16, marginTop: 18, backgroundColor: theme.color('#ffffffc9', 'backgroundColor'), borderRadius: 20, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ color: theme.color('#32405a', 'color'), fontSize: 15 }}>后台在线</Text><Switch disabled={busy} value={enabled} onValueChange={async (value) => {
            setBusy(true);
            try {
                if (value) { await prepareNotificationChannels(); const permission = await Notifications.requestPermissionsAsync(); setAllowed(permission.granted); }
                await service.setEnabled(value);
                if (value) { if (!socket.connected) socket.connect(); await service.start(); }
                setEnabled(value);
            } catch { await service.setEnabled(false); setEnabled(false); Toast.warning('无法启动后台在线，请检查系统设置'); }
            finally { setBusy(false); }
        }} /></View>
        <Text style={{ color: connect ? theme.color('#529475', 'color') : theme.color('#b27d4c', 'color') }}>{connect ? '聊天连接正常' : '正在恢复连接…'}</Text>
        <Text style={{ color: theme.muted }}>{!enabled ? '后台服务已关闭' : !health.running ? '后台服务未运行' : !health.responsive ? '后台服务已启动，等待连接任务响应' : '后台服务运行中，连接任务响应正常'}</Text>
        <Text style={{ fontSize: 12, color: theme.color('#8491a8', 'color'), lineHeight: 19 }}>常驻通知维持后台连接，断网后自动恢复。会增加耗电；请允许通知、后台运行和自启动，并在最近任务中锁定应用。</Text>
        <TouchableOpacity onPress={() => { void Linking.openSettings(); }}><Text style={{ color: theme.color('#6377b4', 'color') }}>消息通知：{!allowed ? '未允许 · 去开启' : !channelAllowed ? '聊天通知类别已关闭 · 去开启' : '已允许 · 打开系统设置'}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => { void service.openBatterySettings().catch(() => Linking.openSettings()); }}><Text style={{ color: theme.color('#6377b4', 'color') }}>电池限制：{unrestricted ? '已解除' : '去允许不受限制的后台运行'}</Text></TouchableOpacity>
        <TouchableOpacity onPress={async () => {
            try {
                await prepareNotificationChannels();
                const permission = await Notifications.requestPermissionsAsync();
                setAllowed(permission.granted);
                if (!permission.granted) { Toast.warning('请先允许系统通知'); return; }
                await Notifications.scheduleNotificationAsync({ content: { title: 'Fiora 通知检查', body: '能看到此通知，说明系统通知通道可用', sound: 'default' }, trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: 'chat-messages' } });
                Toast.success('请切到桌面，3 秒后查看通知');
            } catch { Toast.warning('通知发送失败，请检查系统通知设置'); }
        }}><Text style={{ color: theme.accent }}>发送测试通知（3 秒后）</Text></TouchableOpacity>
        {!Constants.expoConfig?.extra?.eas?.projectId && <Text style={{ fontSize: 11, color: theme.muted }}>当前使用后台连接接收消息；尚未配置系统离线推送，进程被结束后无法收到新消息通知。</Text>}
        <Text style={{ fontSize: 11, color: theme.color('#8491a8', 'color') }}>系统强行停止、重启或完全断网期间无法保持在线；重新打开会恢复登录并补齐消息。</Text>
    </View>;
}
