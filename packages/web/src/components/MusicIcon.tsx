import React from 'react';
import { musicMark } from '../../../utils/avatarDecoration';
export default function MusicIcon({ size = 26, color = 'currentColor' }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block' }}><path d={musicMark} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
