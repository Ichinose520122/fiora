import Style from './AppearancePicker.less';
import HeadwearPicker from './HeadwearPicker';
import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { avatarPresets } from '../../utils/avatarPresets';
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
    const current = selected ?? appearance?.decoration ?? 'none';
    return <section className={Style.section}>
        <h3 className={Style.heading}>头像装扮</h3>
        <p className={Style.caption}>珠光线条、细小星芒，把喜欢的风景戴在身边。</p>
        <div className={Style.preview}>
            <Avatar src={user.avatar} size={72} userId={user._id} decoration={current} />
            <div className={Style.previewText}><strong>{avatarPresets.find((item) => item.id === current)?.name || '无挂件'}</strong><p>选择即保存 · 网页与 App 共用装扮款式</p></div>
        </div>
        <div className={Style.grid}>{avatarPresets.map((item) => <button type="button" aria-pressed={current === item.id} disabled={busy} key={item.id} className={Style.choice} onClick={async () => {
            setBusy(true);
            try { const [error] = await fetch('setAvatarDecoration', { decoration: item.id }); if (!error) { setSelected(item.id); refreshAvatarDecorations(); Message.success('头像挂件已保存'); } }
            finally { setBusy(false); }
        }}><Avatar src={user.avatar} size={48} decoration={item.id} headwear="none" /><span>{item.name}</span></button>)}</div>
        <p className={Style.caption}>所有用户均可选择。系统开启“减少动态效果”时，装饰会静止显示。</p>
        <hr className={Style.divider} />
        <HeadwearPicker />
    </section>;
}
