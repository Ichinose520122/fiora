import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { TwitterPicker } from 'react-color';
import { State } from '../../state/reducer';
import { LocalStorageKey } from '../../localStorage';
import setCssVariable from '../../utils/setCssVariable';
import Common from './Common.less';

export default function BubbleColors() {
    const { primaryColor, primaryTextColor } = useSelector((state: State) => state.status);
    const [background, setBackground] = useState(() => window.localStorage.getItem(LocalStorageKey.SelfBubbleColor) || '');
    const [foreground, setForeground] = useState(() => window.localStorage.getItem(LocalStorageKey.SelfBubbleTextColor) || '');
    const fields = [
        { key: LocalStorageKey.SelfBubbleColor, title: '自己的气泡颜色', value: background, fallback: primaryColor, set: setBackground },
        { key: LocalStorageKey.SelfBubbleTextColor, title: '自己的气泡文字', value: foreground, fallback: primaryTextColor, set: setForeground },
    ];
    return <div className={Common.block}>
        <p className={Common.title}>聊天气泡</p>
        <p style={{ fontSize: 12, color: '#777', marginBottom: 16 }}>独立设置自己的消息颜色，不改变侧栏和当前主题。设置保存在此浏览器。</p>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>{fields.map((field) => <div key={field.key}>
            <p style={{ marginBottom: 12 }}>{field.title}</p>
            <TwitterPicker color={`rgb(${field.value || field.fallback})`} onChange={(color: { rgb: { r: number; g: number; b: number } }) => {
                const value = `${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}`;
                window.localStorage.setItem(field.key, value);
                field.set(value);
                setCssVariable(primaryColor, primaryTextColor);
            }} />
            <button type="button" onClick={() => {
                window.localStorage.removeItem(field.key); field.set('');
                setCssVariable(primaryColor, primaryTextColor);
            }} style={{ marginTop: 10, cursor: 'pointer', padding: '5px 10px', borderRadius: 6, border: '1px solid #ddd', background: 'transparent', color: '#555' }}>跟随主题</button>
        </div>)}</div>
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}><span style={{ padding: '10px 14px', borderRadius: '17px 5px 17px 17px', backgroundColor: `rgb(${background || primaryColor})`, color: `rgb(${foreground || primaryTextColor})` }}>这是我的消息预览</span></div>
    </div>;
}
