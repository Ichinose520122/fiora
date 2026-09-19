import React, { useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, Text as NativeText, TextInput, ToastAndroid, TouchableOpacity, View as NativeView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../utils/theme';

// Preserve the existing native screen layouts while replacing the retired UI dependency.
export function Text({ style, ...props }: any) { const theme = useAppTheme(); return <NativeText {...props} style={[{ color: theme.text }, style]} />; }
export const View = NativeView;
export const Form = NativeView;
export const Label = Text;
export const List = NativeView;
export function Container({ style, ...props }: any) { return <NativeView {...props} style={[{ flex: 1 }, style]} />; }
export const Root = Container;
export function Content(props: any) { return <ScrollView {...props} keyboardShouldPersistTaps="handled" />; }
export function Button({ transparent, block, primary, danger, style, children, ...props }: any) {
    const theme = useAppTheme();
    return <TouchableOpacity accessibilityRole="button" {...props} style={[{ padding: 10, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: transparent ? 'transparent' : danger ? '#c45f6a' : theme.accent }, block && { alignSelf: 'stretch' }, style]}>{children}</TouchableOpacity>;
}
export function Header({ searchBar, rounded, style, ...props }: any) { return <NativeView {...props} style={[{ flexDirection: 'row', padding: 10 }, style]} />; }
export function Item({ rounded, style, ...props }: any) { return <NativeView {...props} style={[{ flexDirection: 'row', flex: 1, alignItems: 'center', borderRadius: 6 }, style]} />; }
export function Input({ style, ...props }: any) { const theme = useAppTheme(); return <TextInput placeholderTextColor={theme.muted} selectionColor={theme.accent} keyboardAppearance={theme.dark ? 'dark' : 'light'} {...props} style={[{ flex: 1, minHeight: 40, padding: 6, color: theme.text }, style]} />; }
export function Body({ style, ...props }: any) { return <NativeView {...props} style={[{ flex: 1 }, style]} />; }
export function Right({ style, ...props }: any) { return <NativeView {...props} style={[{ alignItems: 'flex-end', justifyContent: 'center' }, style]} />; }
export function ListItem({ icon, style, onPress, children, ...props }: any) { const theme = useAppTheme(); return <TouchableOpacity {...props} disabled={!onPress} onPress={onPress} style={[{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: theme.border }, style]}>{children}</TouchableOpacity>; }
export function Icon({ name, active, type, style, ...props }: any) { const theme = useAppTheme(); return <Ionicons color={theme.accent} {...props} name={(name || 'help-circle-outline').replace(/^(ios|md)-/, '')} size={24} style={style} />; }
export function Spinner({ color, style }: any) { const theme = useAppTheme(); return <ActivityIndicator color={color || theme.accent} size="large" style={style} />; }
export const Toast = { show: ({ text }: { text: string; [key: string]: any }) => Platform.OS === 'android' ? ToastAndroid.show(text, ToastAndroid.LONG) : Alert.alert('', text) };
export const ActionSheet = { show: ({ title, options, cancelButtonIndex }: any, callback: (index: number) => void) => Alert.alert(title, undefined, options.map((text: string, index: number) => ({ text, style: index === cancelButtonIndex ? 'cancel' : 'default', onPress: () => callback(index) }))) };
export function Tab({ children }: any) { return <>{children}</>; }
export function Tabs({ children }: any) {
    const theme = useAppTheme();
    const [selected, setSelected] = useState(0);
    const tabs = React.Children.toArray(children) as React.ReactElement<any>[];
    return <NativeView style={{ flex: 1 }}><NativeView style={{ flexDirection: 'row' }}>{tabs.map((tab, i) => <Button key={i} transparent onPress={() => setSelected(i)} style={{ flex: 1, borderBottomWidth: selected === i ? 2 : 0, borderColor: theme.accent }}><Text>{tab.props.heading}</Text></Button>)}</NativeView>{tabs[selected]}</NativeView>;
}
