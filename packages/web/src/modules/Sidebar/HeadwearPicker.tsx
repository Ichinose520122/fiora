import React, { useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { headwearPresets } from '../../../../utils/avatarDecoration';
import Avatar from '../../components/Avatar';
import Input from '../../components/Input';
import Style from './AppearancePicker.less';
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
    const current = headwearPresets.find((item) => item.id === selected);
    return <section className={`${Style.section} ${admin ? Style.compact : ''}`}>
        <h3 className={Style.heading}>{admin ? '头像头饰' : '挑一枚小心情'}</h3>
        <p className={Style.caption}>{admin ? '给指定用户设置头饰，皇冠也可以在这里授予。' : '细小的光芒与轻柔摆动，让头像多一点自己的样子。'}</p>
        {admin && <label className={Style.target}>设置对象<Input value={username} onChange={setUsername} placeholder="输入完整用户名" /></label>}
        <div className={Style.preview}>
            <Avatar src={user.avatar} size={72} userId={admin ? undefined : user._id} decoration={admin ? 'none' : undefined} headwear={selected} />
            <div className={Style.previewText}><strong>{current?.name || '默认'}</strong><p>{admin ? '以你的头像预览头饰，保存后应用到上方指定用户。' : '头饰独立于头像挂件，可以自由搭配。'}</p></div>
        </div>
        <div className={Style.grid}>
            {headwearPresets.filter((item) => item.id !== 'crown' || admin || appearance?.isAdmin).map((item) => <button key={item.id} type="button" disabled={busy} aria-pressed={selected === item.id} onClick={() => admin ? setSelection(item.id) : void save(item.id)} className={Style.choice}>
                <Avatar src={user.avatar} size={48} userId={admin ? undefined : user._id} decoration="none" headwear={item.id} /><span>{item.name}</span>
            </button>)}
        </div>
        <p className={Style.caption}>皇冠仅由管理员设置，不附带管理权限。换掉获赠皇冠后，需要管理员重新授予。</p>
        {admin && <button type="button" className={Style.save} disabled={busy || !username.trim()} onClick={() => void save(selection)}>{busy ? '正在保存…' : '保存用户头饰'}</button>}
    </section>;
}
