import React, { useEffect, useState } from 'react';
import { AppRegistry, AppState, Linking, Platform, Switch, Text, View, TouchableOpacity } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as Notifications from 'expo-notifications';
import { useIsLogin, useStore } from '../hooks/useStore';
import socket, { resumeConnection } from '../socket';
import store from '../state/store';
import { readSession } from '../utils/session';
import { prepareNotificationChannels } from '../utils/messageNotifications';
import Toast from './Toast';

const service = Platform.OS === 'android' ? requireOptionalNativeModule('FioraConnection') : null;
let task: Promise<void> | undefined;
AppRegistry.registerHeadlessTask('FioraConnection', () => () => {
    if (!task) task = (async () => {
        while (service?.isRunning() && service.isEnabled()) {
            // A restarted process restores Redux asynchronously from the saved login.
            // An initially empty Redux store is not a logout.
            if (!(await readSession())) { await service.stop(); break; }
            await resumeConnection().catch(() => {});
            await new Promise((resolve) => setTimeout(resolve, 20000));
        }
    })().finally(() => { task = undefined; });
    return task;
});

export function BackgroundConnection() {
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
            await prepareNotificationChannels();
            if (live && store.getState().user && AppState.currentState === 'active') await service.start();
        };
        void sync().catch(() => Toast.warning('后台在线未能启动，可在“我”中重新开启'));
        const app = AppState.addEventListener('change', (state) => { if (state === 'active') void sync().catch(() => {}); });
        const network = service.addListener('onNetworkAvailable', () => { void resumeConnection().catch(() => {}); });
        return () => { live = false; app.remove(); network.remove(); };
    }, [loggedIn]);
    return null;
}

export function BackgroundConnectionSetting() {
    const { connect } = useStore();
    const [enabled, setEnabled] = useState(Boolean(service?.isEnabled()));
    const [unrestricted, setUnrestricted] = useState(Boolean(service?.isBatteryUnrestricted()));
    const [allowed, setAllowed] = useState(false);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        let live = true;
        const refresh = () => {
            setEnabled(Boolean(service?.isEnabled())); setUnrestricted(Boolean(service?.isBatteryUnrestricted()));
            void Notifications.getPermissionsAsync().then((permission) => { if (live) setAllowed(permission.granted); });
        };
        refresh(); const listener = AppState.addEventListener('change', refresh);
        return () => { live = false; listener.remove(); };
    }, []);
    if (!service) return null;
    return <View style={{ padding: 16, marginTop: 18, backgroundColor: '#ffffffc9', borderRadius: 20, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ color: '#32405a', fontSize: 15 }}>后台在线</Text><Switch disabled={busy} value={enabled} onValueChange={async (value) => {
            setBusy(true);
            try {
                if (value) { await prepareNotificationChannels(); const permission = await Notifications.requestPermissionsAsync(); setAllowed(permission.granted); }
                await service.setEnabled(value);
                if (value) { if (!socket.connected) socket.connect(); await service.start(); }
                setEnabled(value);
            } catch { await service.setEnabled(false); setEnabled(false); Toast.warning('无法启动后台在线，请检查系统设置'); }
            finally { setBusy(false); }
        }} /></View>
        <Text style={{ color: connect ? '#529475' : '#b27d4c' }}>{connect ? '聊天连接正常' : '正在恢复连接…'}</Text>
        <Text style={{ fontSize: 12, color: '#8491a8', lineHeight: 19 }}>常驻通知维持后台连接，断网后自动恢复。会增加耗电；请允许通知、后台运行和自启动，并在最近任务中锁定应用。</Text>
        <TouchableOpacity onPress={() => { void Linking.openSettings(); }}><Text style={{ color: '#6377b4' }}>消息通知：{allowed ? '已允许 · 打开系统设置' : '未允许 · 去开启'}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => { void service.openBatterySettings().catch(() => Linking.openSettings()); }}><Text style={{ color: '#6377b4' }}>电池限制：{unrestricted ? '已解除' : '去允许不受限制的后台运行'}</Text></TouchableOpacity>
        <Text style={{ fontSize: 11, color: '#8491a8' }}>系统强行停止、重启或完全断网期间无法保持在线；重新打开会恢复登录并补齐消息。</Text>
    </View>;
}
