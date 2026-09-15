import { Platform } from 'react-native';

const os = Platform.OS === 'ios' ? 'iOS' : 'Android';

export const isiOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

export default {
    os,
    browser: 'App',
    environment: `Fiora ${os}`,
};
