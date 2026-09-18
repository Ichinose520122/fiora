import { usePreferences } from '../utils/preferences';
import { assetUrl } from '../config';
import React, { createContext, useContext, useRef } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurTargetView, BlurView, BlurViewProps } from 'expo-blur';
const Background = createContext<React.RefObject<View | null> | undefined>(undefined);
export function GlassView(props: BlurViewProps) {
    const target = useContext(Background);
    return <BlurView {...props} blurTarget={target} blurMethod="dimezisBlurViewSdk31Plus" />;
}
export default function PageContainer({ children, disableSafeAreaView = false }: { children: React.ReactNode; disableSafeAreaView?: boolean }) {
    const target = useRef<View>(null);
    const prefs = usePreferences();
    const tint = prefs.theme === 'mint' ? 'rgba(226,244,237,0.82)' : prefs.theme === 'rose' ? 'rgba(249,232,240,0.82)' : 'rgba(237,241,251,0.84)';
    return <View style={{ flex: 1 }}>
        <BlurTargetView ref={target} style={StyleSheet.absoluteFill}>
            <ImageBackground source={prefs.background ? { uri: assetUrl(prefs.background) } : require('../assets/images/background-cool.jpg')} style={{ flex: 1 }} blurRadius={10}>
                <View style={{ flex: 1, backgroundColor: prefs.background ? 'rgba(245,247,252,0.45)' : tint }} />
            </ImageBackground>
        </BlurTargetView>
        <Background.Provider value={target}>
            {disableSafeAreaView ? children : <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1 }}>{children}</SafeAreaView>}
        </Background.Provider>
    </View>;
}
