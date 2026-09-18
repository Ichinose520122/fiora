import { requireOptionalNativeModule } from 'expo';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { getPreferences, preferencesReady } from './preferences';
import { Message } from '../types/redux';

const delivered = new Set<string>();
let remoteReady = false;
export function setRemotePushReady(ready: boolean) { remoteReady = ready; }
Notifications.setNotificationHandler({ handleNotification: async () => ({
    shouldShowBanner: getPreferences().notifications && AppState.currentState !== 'active',
    shouldShowList: getPreferences().notifications && AppState.currentState !== 'active',
    shouldPlaySound: getPreferences().sound && AppState.currentState !== 'active',
    shouldSetBadge: false,
}) });
export async function prepareNotificationChannels() {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync('chat-messages', {
        name: '聊天消息', importance: Notifications.AndroidImportance.HIGH,
        sound: 'default', vibrationPattern: [0, 200, 100, 200],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
    await Notifications.setNotificationChannelAsync('chat-silent', {
        name: '静音消息', importance: Notifications.AndroidImportance.DEFAULT, sound: null, enableVibrate: false,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
}
export async function notifyMessage(message: Message, roomId: string, userId: string, roomName?: string) {
    await preferencesReady;
    const settings = getPreferences();
    if (settings.voice && AppState.currentState === 'active' && message.type === 'text' && (settings.selfVoice || message.from?._id !== userId)) {
        void requireOptionalNativeModule('FioraConnection')?.speak(String(message.content).slice(0, 300)).catch(() => {});
    }
    if (!settings.notifications || remoteReady || AppState.currentState === 'active' || message.from?._id === userId || !message._id || delivered.has(message._id)) return;
    delivered.add(message._id);
    if (delivered.size > 256) delivered.delete(delivered.values().next().value!);
    try {
        await prepareNotificationChannels();
        const content = message.type === 'text' ? String(message.content).slice(0, 120)
            : ({ image: '[图片]', file: '[文件]', code: '[代码]', inviteV2: '[群邀请]', system: '[系统消息]' } as Record<string, string>)[message.type] || '[新消息]';
        await Notifications.scheduleNotificationAsync({
            identifier: `message-${message._id}`,
            content: {
                title: roomName || message.from?.username || '新消息',
                body: settings.preview ? `${roomName ? `${message.from?.username || '用户'}：` : ''}${content}` : '你收到了一条新消息',
                sound: settings.sound ? 'default' : undefined,
                data: { focus: roomId, userId },
            },
            trigger: Platform.OS === 'android' ? { channelId: settings.sound ? 'chat-messages' : 'chat-silent' } : null,
        });
    } catch { delivered.delete(message._id); }
}
