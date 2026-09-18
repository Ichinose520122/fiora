import React, { SyntheticEvent, useState, useMemo } from 'react';
import { crownMark } from '../../../utils/avatarDecoration';
import { avatarPresets } from '../utils/avatarPresets';
import useAvatarDecoration from '../hooks/useAvatarDecoration';
import { getOSSFileUrl } from '../utils/uploadFile';

export const avatarFailback = '/avatar/0.jpg';

type Props = {
    /** 头像链接 */
    src: string;
    userId?: string;
    decoration?: string;
    /** 展示大小 */
    size?: number;
    /** 额外类名 */
    className?: string;
    /** 点击事件 */
    onClick?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
};

function Avatar({
    src,
    userId, decoration,
    size = 60,
    className = '',
    onClick,
    onMouseEnter,
    onMouseLeave,
}: Props) {
    const appearance = useAvatarDecoration(userId);
    const preset = avatarPresets.find((item) => item.id === (decoration ?? appearance?.decoration));
    const [failTimes, updateFailTimes] = useState(0);

    /**
     * Handle avatar load fail event. Use faillback avatar instead
     * If still fail then ignore error event
     */
    function handleError(e: SyntheticEvent<HTMLImageElement>) {
        if (failTimes >= 2) {
            return;
        }
        e.currentTarget.src = avatarFailback;
        updateFailTimes(failTimes + 1);
    }

    const url = useMemo(() => {
        if (/^(blob|data):/.test(src)) {
            return src;
        }
        return getOSSFileUrl(
            src,
            `image/resize,w_${size * 2},h_${size * 2}/quality,q_90`,
        );
    }, [src]);

    return (
        <span className={className} style={{ width: size, height: size, position: 'relative', display: 'inline-flex', flexShrink: 0, overflow: 'visible', verticalAlign: 'middle' }} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}><img
            style={{ width: size, height: size, borderRadius: size / 2 }}
            src={url}
            alt=""
            onError={handleError}
        />
        {!!preset?.paths.length && <svg aria-hidden="true" viewBox="-10 -10 120 120" style={{ pointerEvents: 'none', position: 'absolute', width: '120%', height: '120%', left: '-10%', top: '-10%', overflow: 'visible' }}>{preset.paths.map((d) => <path key={d} d={d} fill="none" stroke={preset.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />)}</svg>}
        {appearance?.isAdmin && <svg role="img" aria-label="管理员" viewBox="0 0 40 30" style={{ pointerEvents: 'none', position: 'absolute', width: '48%', height: '35%', left: '26%', top: '-23%' }}><path d={crownMark} fill="#fff1c2" stroke="#ca9b43" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>}
        </span>
    );
}

export default Avatar;
