import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, SafeAreaViewProps } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../utils/theme';

export function ThemeBackdrop() {
    const theme = useAppTheme();
    return <View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
        <LinearGradient colors={[theme.page, theme.pageAccent, theme.page]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={{ position: 'absolute', width: 280, height: 280, borderRadius: 140, top: -170, right: -85, backgroundColor: `${theme.accent}12` }} />
        <View style={{ position: 'absolute', width: 340, height: 340, borderRadius: 170, bottom: -240, left: -130, borderWidth: 28, borderColor: `${theme.accent}0c` }} />
    </View>;
}

export default function ThemeScreen({ children, style, ...props }: SafeAreaViewProps) {
    const theme = useAppTheme();
    return <SafeAreaView {...props} style={[{ flex: 1, backgroundColor: theme.page }, style]}>
        <ThemeBackdrop />
        {children}
    </SafeAreaView>;
}
