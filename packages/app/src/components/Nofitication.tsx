import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { Actions } from '../navigation';
import { setNotificationToken } from '../service';
import action from '../state/action';
import { useSelfId, useStore } from '../hooks/useStore';
import store from '../state/store';

export default function Notification() {
    const userId = useSelfId();
    const { connect } = useStore();
    const [token, setToken] = useState('');
    useEffect(() => {
        Notifications.setNotificationHandler({ handleNotification: async () => ({
            shouldShowBanner: AppState.currentState !== 'active',
            shouldShowList: true,
            shouldPlaySound: AppState.currentState !== 'active',
            shouldSetBadge: false,
        }) });
        const response = Notifications.addNotificationResponseReceivedListener(({ notification }) => {
            const focus = notification.request.content.data?.focus;
            if (typeof focus === 'string' && store.getState().linkmans.some((item) => item._id === focus)) {
                action.setFocus(focus);
                if (Actions.currentScene !== 'chat') Actions.chat();
            }
        });
        return () => response.remove();
    }, []);
    useEffect(() => {
        let active = true;
        // Remote push requires a linked EAS project and platform credentials.
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!userId || !projectId) return;
        (async () => {
            if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('default', {
                name: '聊天消息', importance: Notifications.AndroidImportance.DEFAULT,
            });
            const permission = await Notifications.requestPermissionsAsync();
            if (!permission.granted || !active) return;
            const value = await Notifications.getExpoPushTokenAsync({ projectId });
            if (active) setToken(value.data);
        })().catch(() => { /* Push setup does not block login or chat. */ });
        return () => { active = false; };
    }, [userId]);
    useEffect(() => { if (connect && userId && token) setNotificationToken(token); }, [connect, userId, token]);
    return null;
}
