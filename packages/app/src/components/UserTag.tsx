import { usePreferences } from '../utils/preferences';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { TagStyle } from '../../../utils/tagStyle';
import tagEffect from '../../../config/tagEffect';
import { getRandomColor } from '../utils/getRandomColor';

export default function UserTag({ text, tagStyle, animated = true }: { text: string; tagStyle?: TagStyle; animated?: boolean }) {
    const [size, setSize] = useState({ width: 1, height: 22 });
    const [reduceMotion, setReduceMotion] = useState(false);
    const [foreground, setForeground] = useState(AppState.currentState === 'active');
    const gradient = useRef(new Animated.Value(0)).current;
    const particleClock = useRef(new Animated.Value(0)).current;
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
        gradient.setValue(0); particleClock.setValue(0);
        if (!animated || reduceMotion || !foreground) return;
        const animations: Animated.CompositeAnimation[] = [];
        if (preset !== 'solid') {
            const duration = tagEffect.gradient.durationSeconds * 500;
            const flow = Animated.loop(Animated.sequence([
                Animated.timing(gradient, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true, isInteraction: false }),
                Animated.timing(gradient, { toValue: 0, duration, easing: Easing.linear, useNativeDriver: true, isInteraction: false }),
            ]));
            flow.start(); animations.push(flow);
        }
        if (particle !== 'none') {
            const float = Animated.loop(Animated.timing(particleClock, { toValue: 1, duration: tagEffect.particle.durationSeconds * 1000, easing: Easing.linear, useNativeDriver: true, isInteraction: false }));
            float.start(); animations.push(float);
        }
        return () => animations.forEach(animation => animation.stop());
    }, [preset, particle, reduceMotion, foreground, animated]);
    const scale = tagEffect.gradient.backgroundSizePercent / 100;
    const gradientWidth = size.width * scale; const gradientHeight = size.height * scale;
    // CSS gradient angle uses physical pixels, not a normalized square direction.
    const radians = tagEffect.gradient.angle * Math.PI / 180;
    const dx = Math.sin(radians); const dy = -Math.cos(radians);
    const length = Math.abs(gradientWidth * dx) + Math.abs(gradientHeight * dy);
    const easeOut = Easing.bezier(0, 0, 0.58, 1);
    const progress = Array.from({ length: 41 }, (_, index) => index / 40);
    return <View accessibilityLabel={text} onLayout={event => { const { width, height } = event.nativeEvent.layout; setSize(previous => previous.width === width && previous.height === height ? previous : { width, height }); }} style={[styles.root, preset === 'monochrome' && styles.glow]}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.background, { backgroundColor: fallback }]}>
            {preset !== 'solid' && <Animated.View style={{ position: 'absolute', left: 0, top: -(gradientHeight - size.height) / 2, width: gradientWidth, height: gradientHeight, transform: [{ translateX: gradient.interpolate({ inputRange: [0, 1], outputRange: [0, -size.width * (scale - 1)] }) }] }}>
                <Svg width={gradientWidth} height={gradientHeight}>
                    <Defs><LinearGradient id="tag-flow" gradientUnits="userSpaceOnUse" x1={(gradientWidth - dx * length) / 2} y1={(gradientHeight - dy * length) / 2} x2={(gradientWidth + dx * length) / 2} y2={(gradientHeight + dy * length) / 2}>{palette.map((color, index) => <Stop key={index} offset={index / (palette.length - 1)} stopColor={color} />)}</LinearGradient></Defs>
                    <Rect width={gradientWidth} height={gradientHeight} fill="url(#tag-flow)" />
                </Svg>
            </Animated.View>}
            {preset === 'monochrome' && <View style={[StyleSheet.absoluteFill, styles.monochrome]} />}
        </View>
        <Text style={styles.text}>{text}</Text>
        {animated && !reduceMotion && particle !== 'none' && Array.from({ length: tagEffect.particle.count }, (_, index) => {
            const value = Animated.modulo(Animated.add(particleClock, index / tagEffect.particle.count), 1);
            const angle = index / tagEffect.particle.count * Math.PI * 2;
            const x = Math.cos(angle) * tagEffect.particle.spreadXPx;
            const y = Math.sin(angle) * tagEffect.particle.spreadYPx;
            const particleSize = tagEffect.particle.minSizePx + (tagEffect.particle.maxSizePx - tagEffect.particle.minSizePx) * ((index % 3) / 2);
            const color = preset === 'solid' ? fallback : palette[index % palette.length];
            const interpolate = (from: number, to: number) => value.interpolate({ inputRange: progress, outputRange: progress.map(p => from + (to - from) * easeOut(p)) });
            return <Animated.Text key={index} pointerEvents="none" accessible={false} style={[styles.particle, {
                fontSize: particleSize, lineHeight: particleSize, width: particleSize, height: particleSize, marginLeft: -particleSize / 2, marginTop: -particleSize / 2, color, textShadowColor: color,
                opacity: value.interpolate({ inputRange: progress, outputRange: progress.map(p => p < 0.25 ? 0.9 * easeOut(p / 0.25) : 0.9 * (1 - easeOut((p - 0.25) / 0.75))) }),
                transform: [
                    { translateX: interpolate(x * tagEffect.particle.startSpreadRatio, x) },
                    { translateY: interpolate(y * tagEffect.particle.startSpreadRatio, y) },
                    { scale: interpolate(tagEffect.particle.startScale, tagEffect.particle.endScale) },
                ],
            }]}>{particle === 'star' ? '☆' : '♥'}</Animated.Text>;
        })}
    </View>;
}
const styles = StyleSheet.create({
    root: { alignSelf: 'flex-start', position: 'relative', marginRight: 5, maxWidth: '100%', flexShrink: 0, minHeight: 22, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
    background: { borderRadius: 7, overflow: 'hidden', zIndex: 0 },
    text: { zIndex: 2, color: '#fff', fontSize: 12, fontWeight: '600', lineHeight: 18, textAlign: 'center', includeFontPadding: false, transform: [{ translateY: 1 }] },
    glow: { borderWidth: 1, borderColor: '#ffffffd9', boxShadow: '0 0 6px rgba(255,255,255,0.7)' },
    monochrome: { borderRadius: 6, boxShadow: 'inset 0 0 4px rgba(0,0,0,0.65)' },
    particle: { zIndex: 1, position: 'absolute', left: '50%', top: '50%', textAlign: 'center', includeFontPadding: false, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
});
