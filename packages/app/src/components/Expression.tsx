import React from 'react';
import { View, Image, PixelRatio } from 'react-native';
export default function Expression({ size, index, style }: { size: number; index: number; style?: any }) {
    const dimension = PixelRatio.roundToNearestPixel(size);
    return <View style={[{ width: dimension, height: dimension, overflow: 'hidden' }, style]}>
        <Image source={require('../assets/images/baidu.png')} resizeMode="stretch" resizeMethod="scale" fadeDuration={0} style={{ width: dimension, height: dimension * 50, transform: [{ translateY: -dimension * index }] }} />
    </View>;
}
