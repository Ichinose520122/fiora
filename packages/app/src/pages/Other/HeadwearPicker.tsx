import React, { useRef, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { ThemedText as Text, ThemedTextInput as TextInput } from '../../components/ThemedText';
import { headwearPresets } from '../../../../utils/avatarDecoration';
import { useAppTheme } from '../../utils/theme';
import { useUser } from '../../hooks/useStore';
import Avatar from '../../components/Avatar';
import Toast from '../../components/Toast';
import useAvatarDecoration, { refreshAvatarDecorations } from '../../hooks/useAvatarDecoration';
import fetch from '../../utils/fetch';

export default function HeadwearPicker({ admin = false }: { admin?: boolean }) {
    const theme = useAppTheme();
    const user = useUser();
    const appearance = useAvatarDecoration(user?._id);
    const [username, setUsername] = useState('');
    const [selection, setSelection] = useState('crown');
    const [busy, setBusy] = useState(false);
    const pending = useRef(false);
    if (!user) return null;
    const selected = admin ? selection : appearance?.headwear || 'auto';
    async function save(headwear: string) {
        if (pending.current) return;
        if (admin && !username.trim()) { Toast.warning('请填写要设置头饰的用户名'); return; }
        pending.current = true; setBusy(true);
        try {
            const [error] = await fetch(admin ? 'setUserHeadwear' : 'setAvatarHeadwear', admin ? { username: username.trim(), headwear } : { headwear });
            if (!error) { refreshAvatarDecorations(); Toast.success('头像头饰已保存'); }
        } finally { pending.current = false; setBusy(false); }
    }
    return <View style={{ paddingVertical: 18, gap: 16 }}>
        <Text style={{ color: theme.text, fontSize: 16 }}>{admin ? '设置用户头饰' : '头像头饰'}</Text>
        {admin && <TextInput accessibilityLabel="要设置头饰的用户名" value={username} onChangeText={setUsername} placeholder="要设置头饰的用户名" placeholderTextColor={theme.color('#8a95aa')} autoCapitalize="none" autoCorrect={false} editable={!busy} maxLength={64} style={{ padding: 12, borderRadius: 12, color: theme.text, backgroundColor: theme.input }} />}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {headwearPresets.filter((item) => item.id !== 'crown' || admin || appearance?.isAdmin).map((item) => <TouchableOpacity key={item.id} accessibilityRole="button" accessibilityLabel={item.name} accessibilityState={{ selected: selected === item.id }} disabled={busy} onPress={() => admin ? setSelection(item.id) : void save(item.id)} style={{ alignItems: 'center', gap: 12, width: 88, paddingTop: 24, paddingBottom: 12, borderRadius: 16, borderWidth: 1, borderColor: selected === item.id ? theme.color('#919bd0', 'borderColor') : theme.border, backgroundColor: theme.input }}>
                <Avatar src={user.avatar} size={44} userId={admin ? undefined : user._id} decoration="none" headwear={item.id} /><Text style={{ fontSize: 12, color: theme.text }}>{item.name}</Text>
            </TouchableOpacity>)}
        </View>
        <Text style={{ fontSize: 12, color: theme.text, opacity: 0.7 }}>普通头饰可自由选择。皇冠由管理员设置，仅为装饰，不授予管理权限。更换普通头饰后，皇冠需由管理员重新设置。</Text>
        {admin && <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={() => void save(selection)} style={{ padding: 14, borderRadius: 12, alignItems: 'center', backgroundColor: theme.input }}><Text style={{ color: theme.text }}>{busy ? '保存中…' : '保存用户头饰'}</Text></TouchableOpacity>}
    </View>;
}
