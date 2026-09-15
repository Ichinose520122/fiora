import Constants from 'expo-constants';
const configured = Constants.expoConfig?.extra?.serverUrl || 'https://chat.nekopara.cc';
const origin = new URL(configured);
if (origin.protocol !== 'https:' || origin.username || origin.password) throw new Error('App 服务器必须使用 HTTPS');
export const serverUrl = origin.origin;
export const serverReferer = serverUrl + '/';
export function assetUrl(value: string) {
    if (value.startsWith('//')) return 'https:' + value;
    if (value.startsWith('/')) return serverUrl + value;
    return value;
}
