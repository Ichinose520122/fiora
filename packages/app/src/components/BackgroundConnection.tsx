import Constants from 'expo-constants';
import React, { useEffect, useState } from 'react';
import { AppRegistry, AppState, Linking, Platform, Switch, Text, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as Notifications from 'expo-notifications';
import { useIsLogin } from '../hooks/useStore';
import socket from '../socket';
import store from '../state/store';
import waitForSession from '../utils/waitForSession';
import Toast from './Toast';

const service = Platform.OS === 'android' ? requireOptionalNativeModule('FioraConnection') : null;
let task: Promise<void> | undefined;
AppRegistry.registerHeadlessTask('FioraConnection', () => () => {
    if (!task) task = (async () => {
        while (service?.isRunning()) {
            const user = store.getState().user;
            if (!user) { await service.stop(); break; }
            if (!socket.connected || !store.getState().connect) await waitForSession(user._id).catch(() => {});
            await new Promise((resolve) => setTimeout(resolve, 15000));
        }
    })().finally(() => { task = undefined; });
    return task;
});

export function BackgroundConnection() {
    const loggedIn = useIsLogin();
    useEffect(() => {
        if (!service) return;
        let active = true;
        const sync = async () => {
            if (!loggedIn) { await service.stop(); return; }
            if (AppState.currentState !== 'active' || !service.isEnabled()) return;
            await Notifications.requestPermissionsAsync();
            if (active && store.getState().user && AppState.currentState === 'active') await service.start();
        };
        void sync().catch(() => Toast.warning('后台在线未能启动，可在“我”中重新开启'));
        const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void sync().catch(() => {}); });
        return () => { active = false; subscription.remove(); };
    }, [loggedIn]);
    useEffect(() => {
        if (!loggedIn || Constants.expoConfig?.extra?.eas?.projectId) return;
        const message = (item: any) => {
            if (AppState.currentState === 'active' || item.from?._id === store.getState().user?._id) return;
            const focus = store.getState().linkmans.some((room) => room._id === item.to) ? item.to : undefined;
            void Notifications.scheduleNotificationAsync({ content: { title: item.from?.username || '新消息', body: item.type === 'text' ? String(item.content).slice(0, 120) : item.type === 'file' ? '[文件]' : item.type === 'image' ? '[图片]' : '收到新消息', data: { focus } }, trigger: null }).catch(() => {});
        };
        socket.on('message', message);
        return () => { socket.off('message', message); };
    }, [loggedIn]);
    return null;
}

export function BackgroundConnectionSetting() {
    const [enabled, setEnabled] = useState(Boolean(service?.isEnabled()));
    const [busy, setBusy] = useState(false);
    useEffect(() => { const listener = AppState.addEventListener('change', () => setEnabled(Boolean(service?.isEnabled()))); return () => listener.remove(); }, []);
    if (!service) return null;
    return <View style={{ padding: 16, marginTop: 18, backgroundColor: '#ffffffc9', borderRadius: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={{ color: '#32405a', fontSize: 15 }}>后台在线</Text><Switch disabled={busy} value={enabled} onValueChange={async (value) => {
            setBusy(true);
            try {
                if (value) await Notifications.requestPermissionsAsync();
                await service.setEnabled(value);
                if (value) await service.start();
                setEnabled(value);
            } catch { await service.setEnabled(false); setEnabled(false); Toast.warning('无法启动后台在线，请检查系统设置'); }
            finally { setBusy(false); }
        }} /></View>
        <Text style={{ fontSize: 12, color: '#8491a8', lineHeight: 19 }}>通过常驻通知保持聊天连接，会增加耗电。建议在系统设置允许后台运行；强行停止、清理应用或断网仍会中断连接。</Text>
        <Text onPress={() => { void Linking.openSettings(); }} style={{ marginTop: 10, color: '#6377b4' }}>打开系统设置</Text>
    </View>;
}
