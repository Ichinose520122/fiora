import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { avatarPresets } from '../../../../utils/avatarDecoration';
import Avatar from '../../components/Avatar';
import { State } from '../../state/reducer';
import useAvatarDecoration, { refreshAvatarDecorations } from '../../hooks/useAvatarDecoration';
import fetch from '../../utils/fetch';
import Message from '../../components/Message';
export default function AvatarDecorationPicker() {
    const user = useSelector((state: State) => state.user);
    const appearance = useAvatarDecoration(user?._id);
    const [busy, setBusy] = useState(false);
    const [selected, setSelected] = useState<string>();
    if (!user) return null;
    return <section style={{ padding: '12px 0 22px' }}>
        <p style={{ marginBottom: 20 }}>头像挂件</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>{avatarPresets.map((item) => <button type="button" aria-pressed={(selected ?? appearance?.decoration ?? 'none') === item.id} disabled={busy} key={item.id} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: 84, padding: '20px 8px 12px', borderRadius: 16, border: `1px solid ${(selected ?? appearance?.decoration ?? 'none') === item.id ? '#919bd0' : '#e4e8f2'}`, background: '#f7f8fd', color: '#667391' }} onClick={async () => {
            setBusy(true);
            try { const [error] = await fetch('setAvatarDecoration', { decoration: item.id }); if (!error) { setSelected(item.id); refreshAvatarDecorations(); Message.success('头像挂件已保存'); } }
            finally { setBusy(false); }
        }}><Avatar src={user.avatar} size={46} userId={user._id} decoration={item.id} /><span>{item.name}</span></button>)}</div>
        <p style={{ fontSize: 12, opacity: 0.6, marginTop: 12 }}>挂件随账号保存，网页与 App 同步。管理员皇冠自动显示。</p>
    </section>;
}
