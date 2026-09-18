import { useEffect } from 'react';
import { Alert, AppState, Share } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import * as Application from 'expo-application';
import { navigation } from '../navigation';
const native = requireOptionalNativeModule('FioraConnection');
export function recordScreen() { void native?.markScreen(navigation.getCurrentRoute()?.name || 'launch').catch(() => {}); }
function share(report: string) { return Share.share({ message: `Fiora ${Application.nativeApplicationVersion} (${Application.nativeBuildVersion})\n${report}` }); }
export async function shareCrash() {
    try {
        const report = await native?.getLastCrash();
        if (report) await share(report);
        else Alert.alert('故障诊断', '此版本还没有保存异常记录。');
    } catch { Alert.alert('故障诊断', '暂时无法读取异常记录。'); }
}
export default function CrashReport() {
    useEffect(() => {
        if (!native || AppState.currentState !== 'active') return;
        void native.consumeCrash().then((report: string) => {
            if (!report) return;
            Alert.alert('检测到上次异常退出', '错误信息只保存在手机上。可以分享诊断信息帮助定位问题，不会自动上传。', [
                { text: '稍后', style: 'cancel' }, { text: '分享诊断', onPress: () => { void share(report).catch(() => {}); } },
            ]);
        }).catch(() => {});
    }, []);
    return null;
}
