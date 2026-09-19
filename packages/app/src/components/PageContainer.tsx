import { useAppTheme } from '../utils/theme';
import { usePreferences } from '../utils/preferences';
import { assetUrl } from '../config';
import React, { createContext, useContext, useRef } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurTargetView, BlurView, BlurViewProps } from 'expo-blur';
import { ThemeBackdrop } from './ThemeScreen';
const Background = createContext<React.RefObject<View | null> | undefined>(undefined);
export function GlassView(props: BlurViewProps) {
    const target = useContext(Background);
    const theme = useAppTheme();
    return <BlurView {...props} tint={theme.dark ? 'dark' : props.tint} blurTarget={target} blurMethod="dimezisBlurViewSdk31Plus" />;
}
export default function PageContainer({ children, disableSafeAreaView = false }: { children: React.ReactNode; disableSafeAreaView?: boolean }) {
    const target = useRef<View>(null);
    const theme = useAppTheme();
    const prefs = usePreferences();
    return <View style={{ flex: 1, backgroundColor: theme.page }}>
        <BlurTargetView ref={target} style={StyleSheet.absoluteFill}>
            {prefs.background ? <ImageBackground source={{ uri: assetUrl(prefs.background) }} style={{ flex: 1 }} blurRadius={10}>
                <View style={{ flex: 1, backgroundColor: `${theme.page}73` }} />
            </ImageBackground> : <ThemeBackdrop />}
        </BlurTargetView>
        <Background.Provider value={target}>
            {disableSafeAreaView ? children : <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1 }}>{children}</SafeAreaView>}
        </Background.Provider>
    </View>;
}
