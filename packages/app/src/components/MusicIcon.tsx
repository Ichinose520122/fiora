import { useAppTheme } from '../utils/theme';
import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { musicMark } from '../../../utils/avatarDecoration';
export default function MusicIcon({ size = 24, color }: { size?: number; color?: string }) {
    const theme = useAppTheme();
    return <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="一起听"><Path d={musicMark} fill="none" stroke={color || theme.accent} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
