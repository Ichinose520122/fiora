import { ThemedText as Text, ThemedTextInput as TextInput } from '../../components/ThemedText';
import { useAppTheme, useThemedStyles } from '../../utils/theme';
import React, { useRef, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { Form, Label, Button, View } from '../../components/NativeUI';
import { Actions } from '../../navigation';

import PageContainer from '../../components/PageContainer';

type Props = {
    buttonText: string;
    jumpText: string;
    jumpPage: string;
    invite?: boolean;
    onSubmit: (username: string, password: string, inviteCode?: string) => Promise<void>;
};

export default function Base({
    buttonText,
    jumpText,
    jumpPage,
    onSubmit,
    invite = false,
}: Props) {
    const theme = useAppTheme(); const styles = useThemedStyles(baseStyles);

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [busy, setBusy] = useState(false);
    const submitting = useRef(false);

    const $username = useRef<TextInput>(null);
    const $password = useRef<TextInput>(null);

    async function handlePress() {
        if (submitting.current) return;
        if (!username.trim() || !password || (invite && !inviteCode.trim())) {
            Alert.alert('请填写用户名、密码及所需邀请码'); return;
        }
        $username.current!.blur();
        $password.current!.blur();
        submitting.current = true; setBusy(true);
        try { await onSubmit(username.trim(), password, inviteCode.trim()); }
        catch { Alert.alert('登录信息保存失败，请重试'); }
        finally { submitting.current = false; setBusy(false); }
    }

    function handleJump() {
        if (Actions[jumpPage]) {
            Actions.replace(jumpPage);
        } else {
            Alert.alert(`跳转 ${jumpPage} 失败`);
        }
    }
    return (
        <PageContainer>
            <View style={styles.container}>
                <Form style={{ backgroundColor: theme.surface, padding: 20, borderRadius: 22, borderWidth: 1, borderColor: theme.border }}>
                    <Label style={styles.label}>用户名</Label>
                    <TextInput
                        style={[styles.input, { color: theme.text, backgroundColor: theme.input, borderColor: theme.border }]}
                        // @ts-ignore
                        ref={$username}
                        clearButtonMode="while-editing"
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        autoComplete="username"
                    />
                    <Label style={styles.label}>密码</Label>
                    <TextInput
                        style={[styles.input]}
                        // @ts-ignore
                        ref={$password}
                        secureTextEntry
                        clearButtonMode="while-editing"
                        onChangeText={setPassword}
                        autoCapitalize="none"
                        autoComplete="password"
                    />
                    {invite && <><Label style={styles.label}>邀请码</Label><TextInput value={inviteCode} onChangeText={setInviteCode} style={[styles.input, { color: theme.text, backgroundColor: theme.input, borderColor: theme.border }]} autoCapitalize="none" autoCorrect={false} /></>}
                </Form>
                <Button
                    primary
                    block
                    style={styles.button}
                    disabled={busy}
                    onPress={handlePress}
                >
                    <Text style={[styles.buttonText, { color: theme.onAccent }]}>{busy ? '处理中…' : buttonText}</Text>
                </Button>
                <Button disabled={busy} transparent style={styles.signup} onPress={handleJump}>
                    <Text style={styles.signupText}>{jumpText}</Text>
                </Button>
            </View>
        </PageContainer>
    );
}

const baseStyles = StyleSheet.create({
    container: {
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 20,
    },
    button: {
        marginTop: 18,
    },
    buttonText: {
        fontSize: 18,
        color: '#fafafa',
    },
    signup: {
        alignSelf: 'flex-end',
    },
    signupText: {
        color: '#2a7bf6',
        fontSize: 14,
    },
    label: {
        marginBottom: 8,
    },
    input: {
        height: 42,
        fontSize: 16,
        borderRadius: 12,
        marginBottom: 12,
        paddingLeft: 6,
        borderWidth: 1,
        borderColor: '#777',
    },
});
