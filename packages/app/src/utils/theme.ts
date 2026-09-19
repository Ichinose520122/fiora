import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Preferences, usePreferences } from './preferences';

export const themePresets = {
    mint: { accent: '#509f91', page: '#edf7f3', surface: '#ffffff', text: '#275a53' },
    mist: { accent: '#6377b4', page: '#f3f5fc', surface: '#ffffff', text: '#32405a' },
    rose: { accent: '#b57591', page: '#fcf1f5', surface: '#ffffff', text: '#71485c' },
};
export function mixColors(a: string, b: string, weight: number) {
    const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const left = rgb(a); const right = rgb(b);
    return '#' + left.map((v, i) => Math.round(v * (1 - weight) + right[i] * weight).toString(16).padStart(2, '0')).join('');
}
export function resolveAppTheme(prefs: Preferences) {
    const preset = themePresets[prefs.theme as keyof typeof themePresets] || themePresets.mint;
    const pick = (value: string, fallback: string) => /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
    const accent = pick(prefs.accentColor, preset.accent); const page = pick(prefs.pageColor, preset.page);
    const surface = pick(prefs.surfaceColor, preset.surface); const text = pick(prefs.primaryTextColor, preset.text);
    const muted = mixColors(text, surface, 0.44); const soft = mixColors(surface, accent, 0.13); const border = mixColors(surface, accent, 0.23);
    const rgb = [1, 3, 5].map(i => parseInt(accent.slice(i, i + 2), 16));
    const onAccent = rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114 > 165 ? '#18352f' : '#ffffff';
    // Adapt the existing mist palette by semantic role; preserve red warnings,
    // success indicators, cover artwork and user-supplied chat bubble colors.
    const color = (value: string, role = 'color') => {
        const input = value === 'white' ? '#ffffff' : value === 'black' ? '#000000' : value;
        if (!/^#(?:[a-f0-9]{3}|[a-f0-9]{6}|[a-f0-9]{8})$/i.test(input)) return value;
        const hex = input.length === 4 ? '#' + input.slice(1).split('').map(c => c + c).join('') : input;
        const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
        const alpha = hex.length === 9 ? hex.slice(7) : '';
        const light = Math.max(r, g, b); const neutral = light - Math.min(r, g, b) < 0.07;
        const blue = b >= r && b >= g;
        if (!neutral && !blue) return value;
        if (role === 'backgroundColor') return (neutral && light > 0.98 ? surface : light > 0.94 ? page : light > 0.72 ? soft : accent) + alpha;
        if (role.toLowerCase().includes('border')) return border + alpha;
        if (neutral && light > 0.98) return value; // White icon labels retain contrast on solid buttons.
        return (light < 0.43 ? text : !neutral && light - Math.min(r, g, b) > 0.13 && r < 0.65 ? accent : muted) + alpha;
    };
    return { accent, page, surface, text, muted, soft, border, onAccent, color };
}
export type AppTheme = ReturnType<typeof resolveAppTheme>;
export function useAppTheme() {
    const prefs = usePreferences();
    return useMemo(() => resolveAppTheme(prefs), [prefs.theme, prefs.accentColor, prefs.pageColor, prefs.surfaceColor, prefs.primaryTextColor]);
}
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(base: T): T {
    const theme = useAppTheme();
    return useMemo(() => Object.fromEntries(Object.entries(base).map(([name, style]) => [name,
        Object.fromEntries(Object.entries(StyleSheet.flatten(style as any) || {}).map(([key, value]) => [key, typeof value === 'string' && /color$/i.test(key) ? theme.color(value, key) : value])),
    ])) as unknown as T, [base, theme]);
}
