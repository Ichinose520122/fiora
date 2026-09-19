import React, { forwardRef } from 'react';
import { Text as NativeText, TextInput as NativeInput, TextProps, TextInputProps } from 'react-native';
import { useAppTheme } from '../utils/theme';

export const ThemedText = forwardRef<NativeText, TextProps>(({ style, ...props }, ref) => {
    const theme = useAppTheme();
    return <NativeText ref={ref} {...props} style={[{ color: theme.text }, style]} />;
});
export type ThemedTextInput = NativeInput;
export const ThemedTextInput = forwardRef<NativeInput, TextInputProps>(({ style, ...props }, ref) => {
    const theme = useAppTheme();
    return <NativeInput ref={ref} placeholderTextColor={theme.muted} selectionColor={theme.accent}
        keyboardAppearance={theme.dark ? 'dark' : 'light'} {...props} style={[{ color: theme.text }, style]} />;
});
