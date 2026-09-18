import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { avatarPresets, crownMark } from '../../../utils/avatarDecoration';
import useAvatarDecoration from '../hooks/useAvatarDecoration';
import { getOSSFileUrl } from '../utils/uploadFile';

import Image from './Image';

type Props = {
    src: string | number;
    size: number;
    userId?: string;
    decoration?: string;
};
export default function Avatar({ src, size, userId, decoration }: Props) {
    const appearance = useAvatarDecoration(userId);
    const preset = avatarPresets.find((item) => item.id === (decoration ?? appearance?.decoration));
    const targetUrl = getOSSFileUrl(
        typeof src === 'number' || (typeof src === 'string' && src.length > 0) ? src : '/avatar/0.jpg',
        `image/resize,w_${size * 2},h_${size * 2}/quality,q_90`,
    ) as string;
    return (
        <View style={{ width: size, height: size, flexShrink: 0 }}><Image
            src={targetUrl}
            width={size}
            height={size}
            style={{ borderRadius: size / 2 }}
        />
        {!!preset?.paths.length && <Svg pointerEvents="none" width={size * 1.2} height={size * 1.2} viewBox="-10 -10 120 120" style={{ position: 'absolute', left: -size * 0.1, top: -size * 0.1 }}>{preset.paths.map((d) => <Path key={d} d={d} fill="none" stroke={preset.color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />)}</Svg>}
        {appearance?.isAdmin && <Svg pointerEvents="none" width={size * 0.48} height={size * 0.35} viewBox="0 0 40 30" style={{ position: 'absolute', top: -size * 0.23, left: size * 0.26 }}><Path d={crownMark} fill="#fff1c2" stroke="#ca9b43" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /></Svg>}
        </View>
    );
}
