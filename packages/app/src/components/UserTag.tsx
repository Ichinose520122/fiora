import { usePreferences } from '../utils/preferences';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TagStyle } from '../../../utils/tagStyle';
import tagEffect from '../../../config/tagEffect';
import { getRandomColor } from '../utils/getRandomColor';

export default function UserTag({ text, tagStyle }: { text: string; tagStyle?: TagStyle }) {
    const [width, setWidth] = useState(0);
    const [reduceMotion, setReduceMotion] = useState(false);
    const [foreground, setForeground] = useState(AppState.currentState === 'active');
    const gradient = useRef(new Animated.Value(0)).current;
    const particles = useRef(Array.from({ length: tagEffect.particle.count }, () => new Animated.Value(0))).current;
    const preset = tagStyle?.preset || 'solid';
    const particle = tagStyle?.particle || 'none';
    const selected = (Array.isArray(tagStyle?.colors) ? tagStyle.colors : []).filter((color) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color));
    const palette = preset === 'monochrome' ? ['#050505', '#f5f5f5', '#141414']
        : preset === 'tripleGradient' ? selected.length >= 3 ? selected : ['#5b8ff9', '#f759ab', '#ffd666']
        : selected.length >= 2 ? selected : ['#5b8ff9', '#f759ab'];
    const preferences = usePreferences();
    const random = useRef(getRandomColor(`${text}:${Math.random()}`)).current;
    const fallback = preferences.tagColorMode === 'singleColor' ? preferences.bubbleTextColor : preferences.tagColorMode === 'randomColor' ? random : getRandomColor(text);
    useEffect(() => {
        let live = true;
        void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setReduceMotion(value); }).catch(() => {});
        const reduced = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
        const active = AppState.addEventListener('change', value => setForeground(value === 'active'));
        return () => { live = false; reduced.remove(); active.remove(); };
    }, []);
    useEffect(() => {
        gradient.setValue(0); particles.forEach(value => value.setValue(0));
        if (reduceMotion || !foreground) return;
        const animations: Animated.CompositeAnimation[] = [];
        if (preset !== 'solid') {
            const duration = tagEffect.gradient.durationSeconds * 500;
            const flow = Animated.loop(Animated.sequence([
                Animated.timing(gradient, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true, isInteraction: false }),
                Animated.timing(gradient, { toValue: 0, duration, easing: Easing.linear, useNativeDriver: true, isInteraction: false }),
            ]));
            flow.start(); animations.push(flow);
        }
        if (particle !== 'none') particles.forEach((value, index) => {
            const duration = tagEffect.particle.durationSeconds * 1000;
            const float = Animated.sequence([
                Animated.delay(duration * index / particles.length),
                Animated.loop(Animated.timing(value, { toValue: 1, duration, easing: Easing.out(Easing.ease), useNativeDriver: true, isInteraction: false })),
            ]);
            float.start(); animations.push(float);
        });
        return () => animations.forEach(animation => animation.stop());
    }, [preset, particle, reduceMotion, foreground]);
    const scale = tagEffect.gradient.backgroundSizePercent / 100;
    return <View accessibilityLabel={text} style={styles.root}>
        <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[styles.badge, preset === 'monochrome' && styles.monochrome, { backgroundColor: fallback }]}>
            {preset !== 'solid' && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { width: Math.max(width, 1) * scale, transform: [{ translateX: gradient.interpolate({ inputRange: [0, 1], outputRange: [0, -width * (scale - 1)] }) }] }]}>
                <LinearGradient colors={palette as [string, string, ...string[]]} start={{ x: 0.047, y: 0.288 }} end={{ x: 0.953, y: 0.712 }} style={StyleSheet.absoluteFill} />
            </Animated.View>}
            <Text style={styles.text}>{text}</Text>
        </View>
        {!reduceMotion && particle !== 'none' && particles.map((value, index) => {
            const angle = index / particles.length * Math.PI * 2;
            const x = Math.cos(angle) * tagEffect.particle.spreadXPx;
            const y = Math.sin(angle) * tagEffect.particle.spreadYPx;
            const size = tagEffect.particle.minSizePx + (tagEffect.particle.maxSizePx - tagEffect.particle.minSizePx) * ((index % 3) / 2);
            return <Animated.Text key={index} pointerEvents="none" accessible={false} style={[styles.particle, {
                fontSize: size, color: preset === 'solid' ? fallback : palette[index % palette.length],
                opacity: value.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.9, 0] }),
                transform: [
                    { translateX: value.interpolate({ inputRange: [0, 1], outputRange: [x * tagEffect.particle.startSpreadRatio, x] }) },
                    { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [y * tagEffect.particle.startSpreadRatio, y] }) },
                    { scale: value.interpolate({ inputRange: [0, 1], outputRange: [tagEffect.particle.startScale, tagEffect.particle.endScale] }) },
                ],
            }]}>{particle === 'star' ? '☆' : '♥'}</Animated.Text>;
        })}
    </View>;
}
const styles = StyleSheet.create({
    root: { alignSelf: 'flex-start', position: 'relative', marginRight: 5, maxWidth: '100%', flexShrink: 1 },
    badge: { minHeight: 20, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, overflow: 'hidden', justifyContent: 'center' },
    text: { color: 'white', fontSize: 11, fontWeight: '600', lineHeight: 17, textAlign: 'center', includeFontPadding: false, textShadowColor: '#24324730', textShadowRadius: 1 },
    monochrome: { borderWidth: 1, borderColor: '#ffffffd9' },
    particle: { position: 'absolute', left: '50%', top: '50%', width: 18, height: 18, marginLeft: -9, marginTop: -9, textAlign: 'center', includeFontPadding: false, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
});
