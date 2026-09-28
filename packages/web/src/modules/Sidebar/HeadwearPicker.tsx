import React, { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { headwearPresets } from '../../../../utils/avatarDecoration';
import Avatar from '../../components/Avatar';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Message from '../../components/Message';
import { State } from '../../state/reducer';
import useAvatarDecoration, { refreshAvatarDecorations } from '../../hooks/useAvatarDecoration';
import fetch from '../../utils/fetch';

export default function HeadwearPicker({ admin = false }: { admin?: boolean }) {
    const user = useSelector((state: State) => state.user);
    const appearance = useAvatarDecoration(user?._id);
    const [username, setUsername] = useState('');
    const [selection, setSelection] = useState('crown');
    const [busy, setBusy] = useState(false);
    const pending = useRef(false);
    if (!user) return null;
    const selected = admin ? selection : appearance?.headwear || 'auto';
    async function save(headwear: string) {
        if (pending.current) return;
        if (admin && !username.trim()) { Message.error('请填写要设置头饰的用户名'); return; }
        pending.current = true; setBusy(true);
        try {
            const [error] = await fetch(admin ? 'setUserHeadwear' : 'setAvatarHeadwear', admin ? { username: username.trim(), headwear } : { headwear });
            if (!error) { refreshAvatarDecorations(); Message.success('头像头饰已保存'); }
        } finally { pending.current = false; setBusy(false); }
    }
    return <section style={{ padding: '12px 0 22px' }}>
        <p style={{ marginBottom: 20 }}>{admin ? '设置用户头饰' : '头像头饰'}</p>
        {admin && <Input value={username} onChange={setUsername} placeholder="要设置头饰的用户名" />}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
            {headwearPresets.filter((item) => item.id !== 'crown' || admin || appearance?.isAdmin).map((item) => <button key={item.id} type="button" disabled={busy} aria-pressed={selected === item.id} onClick={() => admin ? setSelection(item.id) : void save(item.id)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: 90, padding: '24px 4px 12px', borderRadius: 16, border: selected === item.id ? '1px solid #919bd0' : '1px solid #e4e8f2', background: '#f7f8fd', color: '#667391' }}>
                <Avatar src={user.avatar} size={44} userId={admin ? undefined : user._id} decoration="none" headwear={item.id} /><span>{item.name}</span>
            </button>)}
        </div>
        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 12 }}>普通头饰可自由选择。皇冠由管理员设置，仅为装饰，不授予管理权限。更换普通头饰后，皇冠需由管理员重新设置。</p>
        {admin && <Button onClick={() => void save(selection)}>{busy ? '保存中…' : '保存用户头饰'}</Button>}
    </section>;
}
