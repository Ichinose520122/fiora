import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Actions, navigation } from '../navigation';
import { setNotificationToken } from '../service';
import action from '../state/action';
import { useSelfId, useStore } from '../hooks/useStore';
import store from '../state/store';
import { prepareNotificationChannels, setRemotePushReady } from '../utils/messageNotifications';
import { usePreferences } from '../utils/preferences';

export default function Notification() {
    const userId = useSelfId();
    const { connect } = useStore();
    const preferences = usePreferences();
    useEffect(() => {
        let pending: Notifications.NotificationResponse | null = null;
        let alive = true;
        const open = () => {
            if (!pending || !navigation.isReady() || AppState.currentState !== 'active') return;
            const state = store.getState();
            if (!state.user || !state.connect) return;
            const { focus, userId: recipient } = pending.notification.request.content.data || {};
            if (recipient && recipient !== state.user._id) { pending = null; return; }
            const room = state.linkmans.find((item) => item._id === focus);
            if (!room) return;
            pending = null;
            action.setFocus(room._id);
            Actions.chat({ title: room.name });
            void Notifications.clearLastNotificationResponseAsync().catch(() => {});
        };
        const receive = (response: Notifications.NotificationResponse) => { pending = response; open(); };
        const listener = Notifications.addNotificationResponseReceivedListener(receive);
        void Notifications.getLastNotificationResponseAsync().then((response) => { if (alive && response) receive(response); });
        const unsubscribe = store.subscribe(open);
        const app = AppState.addEventListener('change', open);
        const timer = setInterval(open, 1000);
        return () => { alive = false; listener.remove(); unsubscribe(); app.remove(); clearInterval(timer); };
    }, []);
    useEffect(() => {
        let live = true;
        setRemotePushReady(false);
        if (!userId || !connect || !preferences.notifications) return;
        void (async () => {
            await prepareNotificationChannels();
            if (AppState.currentState !== 'active') return;
            const permission = await Notifications.requestPermissionsAsync();
            const projectId = Constants.expoConfig?.extra?.eas?.projectId;
            if (!permission.granted || !live || !projectId) return;
            const token = await Notifications.getExpoPushTokenAsync({ projectId });
            if (live && await setNotificationToken(token.data)) setRemotePushReady(true);
        })().catch(() => { /* Local socket notifications remain available if push registration fails. */ });
        return () => { live = false; setRemotePushReady(false); };
    }, [userId, connect, preferences.notifications]);
    return null;
}
