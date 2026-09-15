import AsyncStorage from '@react-native-async-storage/async-storage';
import platform from './platform';
import { decodeBase64 } from './base64';
const key = 'fiora-session-v2';
export type Session = { token: string; environment: string };
let generation = 0;
let writes: Promise<unknown> = Promise.resolve();
export const sessionGeneration = () => generation;
export function tokenEnvironment(token: string) {
    // This only recovers the original client identifier; the server verifies the JWT.
    try {
        const bytes = decodeBase64(token.split('.')[1]);
        const json = JSON.parse(decodeURIComponent(Array.from(bytes).map((byte) => `%${byte.toString(16).padStart(2, '0')}`).join('')));
        return typeof json.environment === 'string' ? json.environment : platform.environment;
    } catch { return platform.environment; }
}
export async function readSession(): Promise<Session | null> {
    await writes;
    const saved = await AsyncStorage.getItem(key);
    if (saved) {
        try {
            const value = JSON.parse(saved);
            if (typeof value?.token === 'string' && value.token) return { token: value.token, environment: tokenEnvironment(value.token) };
        } catch { /* Try the previous installation's storage format. */ }
    }
    const token = await AsyncStorage.getItem('token');
    return token ? { token, environment: tokenEnvironment(token) } : null;
}
export function saveSession(token: string) {
    if (!token) return Promise.reject(new Error('登录响应缺少 token'));
    generation += 1;
    const value = JSON.stringify({ token, environment: tokenEnvironment(token) });
    const task = writes.then(() => AsyncStorage.setItem(key, value));
    writes = task.catch(() => {});
    return task;
}
export function clearSession() {
    generation += 1;
    const task = writes.then(() => AsyncStorage.multiRemove([key, 'token']));
    writes = task.catch(() => {});
    return task;
}
