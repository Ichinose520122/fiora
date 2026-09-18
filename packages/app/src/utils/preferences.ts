import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export const defaultPreferences = {
    theme: 'mist', tagColorMode: 'fixedColor', bubbleColor: '#dee6fa', bubbleTextColor: '#344a71',
    background: '', notifications: true, sound: true, preview: true, voice: false, selfVoice: false,
};
export type Preferences = typeof defaultPreferences;
let value = { ...defaultPreferences };
const listeners = new Set<() => void>();
let changed = false;
let writes: Promise<unknown> = Promise.resolve();
const key = 'fiora-native-preferences-v1';
export const preferencesReady = AsyncStorage.getItem(key).then((saved) => {
    if (saved && !changed) {
        const data = JSON.parse(saved);
        for (const k of Object.keys(defaultPreferences) as (keyof Preferences)[]) {
            if (typeof data[k] === typeof defaultPreferences[k]) (value as any)[k] = data[k];
        }
        for (const k of ['bubbleColor', 'bubbleTextColor'] as const) {
            if (!/^#[0-9a-f]{6}$/i.test(value[k])) value[k] = defaultPreferences[k];
        }
        value = { ...value }; listeners.forEach((listener) => listener());
    }
}).catch(() => {});
export function getPreferences() { return value; }
export function setPreferences(next: Partial<Preferences>) {
    changed = true; value = { ...value, ...next };
    listeners.forEach((listener) => listener());
    const json = JSON.stringify(value);
    const task = writes.then(() => AsyncStorage.setItem(key, json));
    writes = task.catch(() => {});
    return task;
}
export function usePreferences() {
    return useSyncExternalStore((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, getPreferences);
}
