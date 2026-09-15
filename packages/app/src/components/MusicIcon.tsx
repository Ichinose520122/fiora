import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { musicMark } from '../../../utils/avatarDecoration';
export default function MusicIcon({ size = 24, color = '#7b8dad' }) {
    return <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityLabel="一起听"><Path d={musicMark} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
