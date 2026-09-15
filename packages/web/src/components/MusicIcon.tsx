import React from 'react';
const musicMark = 'M10 17.5V4c0-.6.6-1 1.1-.7L20 8v5l-10-4M10 17.5c0 1.9-1.8 3.5-4 3.5s-4-1.6-4-3.5S3.8 14 6 14s4 1.6 4 3.5Z';
export default function MusicIcon({ size = 26, color = 'currentColor' }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block' }}><path d={musicMark} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
