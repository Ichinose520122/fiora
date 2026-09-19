import { useAppTheme } from '../../utils/theme';
import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { avatarPresets } from '../../../../utils/avatarDecoration';
import Avatar from '../../components/Avatar';
import { useUser } from '../../hooks/useStore';
import useAvatarDecoration, { refreshAvatarDecorations } from '../../hooks/useAvatarDecoration';
import fetch from '../../utils/fetch';
import Toast from '../../components/Toast';
export default function AvatarDecorationPicker() {
    const theme = useAppTheme();

    const user = useUser();
    const appearance = useAvatarDecoration(user?._id);
    const [busy, setBusy] = useState(false);
    const [selected, setSelected] = useState<string>();
    if (!user) return null;
    return <View style={{ padding: 16, marginTop: 18, backgroundColor: theme.color('#ffffffc9', 'backgroundColor'), borderRadius: 20 }}>
        <Text style={{ color: theme.color('#32405a', 'color'), fontSize: 15, marginBottom: 22 }}>头像挂件</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{avatarPresets.map((item) => <TouchableOpacity accessibilityLabel={item.name} accessibilityState={{ selected: (selected ?? appearance?.decoration ?? 'none') === item.id }} disabled={busy} key={item.id} style={{ width: 76, alignItems: 'center', gap: 12, paddingTop: 16, paddingBottom: 10, borderRadius: 16, borderWidth: 1, borderColor: (selected ?? appearance?.decoration ?? 'none') === item.id ? theme.color('#919bd0', 'borderColor') : theme.color('#e9edf5', 'borderColor'), backgroundColor: theme.color('#f7f8fd', 'backgroundColor') }} onPress={async () => {
            setBusy(true);
            try { const [error] = await fetch('setAvatarDecoration', { decoration: item.id }); if (!error) { setSelected(item.id); refreshAvatarDecorations(); Toast.success('头像挂件已保存'); } }
            finally { setBusy(false); }
        }}><Avatar src={user.avatar} size={44} userId={user._id} decoration={item.id} /><Text style={{ fontSize: 12, color: theme.color('#667391', 'color') }}>{item.name}</Text></TouchableOpacity>)}</View>
        <Text style={{ fontSize: 11, color: theme.color('#98a2b5', 'color'), marginTop: 12 }}>挂件随账号保存，网页与 App 同步。管理员皇冠自动显示。</Text>
    </View>;
}
