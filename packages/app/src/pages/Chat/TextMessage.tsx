import { ThemedText as Text } from '../../components/ThemedText';
import { useAppTheme } from '../../utils/theme';
import React from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import Expression from '../../components/Expression';
import Toast from '../../components/Toast';
import { Message } from '../../types/redux';
import expressions from '../../utils/expressions';
import { usePreferences } from '../../utils/preferences';

export default function TextMessage({ message, isSelf }: { message: Message; isSelf: boolean }) {
    const theme = useAppTheme();
    const preferences = usePreferences();
    const children: React.ReactNode[] = [];
    const content = String(message.content || '');
    const regex = /#\(([^)\s]+)\)|https?:\/\/[^\s<>]+/g;
    const color = isSelf ? preferences.bubbleTextColor : theme.text;
    const copy = () => {
        const module = requireOptionalNativeModule('FioraConnection');
        if (module) void module.copyText(content).then(() => Toast.success('已复制')).catch(() => Toast.warning('复制失败'));
        else void Share.share({ message: content });
    };
    const text = (value: string, key: number) => <Text key={key} onLongPress={copy} style={[styles.text, { color }]}>{value}</Text>;
    let offset = 0;
    for (const match of content.matchAll(regex)) {
        const index = match.index!;
        if (index > offset) children.push(text(content.slice(offset, index), offset));
        const expression = match[1] ? expressions.default.indexOf(match[1]) : -1;
        if (expression >= 0) children.push(<Expression key={`expression-${index}`} size={30} index={expression} />);
        else if (!match[1]) children.push(<Text key={`url-${index}`} onLongPress={copy} onPress={() => { void Linking.openURL(match[0]).catch(() => Toast.warning('无法打开链接')); }} style={[styles.text, { color: isSelf ? preferences.bubbleTextColor : theme.accent, textDecorationLine: 'underline' }]}>{match[0]}</Text>);
        else children.push(text(match[0], index));
        offset = index + match[0].length;
    }
    if (offset < content.length) children.push(text(content.slice(offset), offset));
    return <View style={styles.container}>{children}</View>;
}
const styles = StyleSheet.create({ container: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }, text: { flexShrink: 1, fontSize: 15, lineHeight: 23 } });
