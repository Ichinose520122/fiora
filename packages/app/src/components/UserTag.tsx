import React from 'react';
import { Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TagStyle } from '../../../utils/tagStyle';
import { getRandomColor } from '../utils/getRandomColor';
export default function UserTag({ text, tagStyle }: { text: string; tagStyle?: TagStyle }) {
    const fallback = getRandomColor(text);
    const selected = (tagStyle?.colors || []).filter((color) => /^#[0-9a-f]{6}$/i.test(color));
    const palette = tagStyle?.preset === 'monochrome' ? ['#243247', '#758497', '#243247'] : selected.length >= 2 ? selected : ['#5b85c4', '#9b79b9', '#ce99b3'];
    const solid = selected[0] || fallback;
    const colors = tagStyle?.preset && tagStyle.preset !== 'solid' ? palette : [solid, solid];
    return <LinearGradient colors={colors as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ alignSelf: 'flex-start', borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, marginRight: 6, maxWidth: 145, borderWidth: 0.5, borderColor: '#ffffff80', flexDirection: 'row', alignItems: 'center' }}>
        {tagStyle?.particle && tagStyle.particle !== 'none' && <Text style={{ color: 'white', fontSize: 10, marginRight: 3 }}>{tagStyle.particle === 'star' ? '✧' : '♥'}</Text>}
        <Text numberOfLines={1} style={{ color: 'white', fontSize: 10, fontWeight: '700', flexShrink: 1, includeFontPadding: false }}>{text}</Text>
    </LinearGradient>;
}
