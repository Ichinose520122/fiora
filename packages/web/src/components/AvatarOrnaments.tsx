import React, { useState } from 'react';
import { avatarPresets, resolveHeadwear } from '../../../utils/avatarDecoration';
import Style from './AvatarOrnaments.less';

let nextId = 0;
type Props = { decoration?: string; headwear?: string; isAdmin?: boolean };

/** Shared preset IDs stay intact; the web renderer adds depth and gentle movement. */
export default function AvatarOrnaments({ decoration, headwear, isAdmin }: Props) {
    const [id] = useState(() => 'avatar-jewel-' + (++nextId));
    const frame = avatarPresets.find((item) => item.id === decoration);
    const head = resolveHeadwear(headwear, isAdmin);
    return <>
        {!!frame?.paths.length && <svg className={Style.frame} data-kind={frame.id} aria-hidden="true" viewBox="-10 -10 120 120">
            <defs><linearGradient id={id + '-frame'} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={frame.color} /><stop offset=".3" stopColor="#fff5e8" />
                <stop offset=".55" stopColor={frame.color} /><stop offset=".82" stopColor="#f6eeff" /><stop offset="1" stopColor={frame.color} />
            </linearGradient></defs>
            <g className={Style.frameArt} fill="none" strokeLinecap="round" strokeLinejoin="round">
                {frame.paths.map((d) => <g key={d}>
                    <path d={d} stroke={frame.color} strokeWidth="3.2" opacity=".28" />
                    <path d={d} stroke={'url(#' + id + '-frame)'} strokeWidth="1.8" />
                </g>)}
            </g>
            <g className={Style.sparkles} fill={frame.color} stroke="#fff" strokeWidth=".6">
                <path d="M88 10l1.8 4.2L94 16l-4.2 1.8L88 22l-1.8-4.2L82 16l4.2-1.8Z" />
                <path d="M12 77l1.2 3.8L17 82l-3.8 1.2L12 87l-1.2-3.8L7 82l3.8-1.2Z" />
                <circle cx="75" cy="94" r="1.8" />
            </g>
        </svg>}
        {!!head.paths.length && <svg className={Style.head} data-kind={head.id} role="img" aria-label={head.name} viewBox="0 0 40 30">
            <defs>
                <linearGradient id={id + '-head'} x1="0" y1="0" x2=".5" y2="1">
                    <stop offset="0" stopColor="#fffdf5" /><stop offset=".55" stopColor={head.fill} /><stop offset="1" stopColor={head.color} stopOpacity=".8" />
                </linearGradient>
                <linearGradient id={id + '-ring'} x1="0" y1="0" x2=".3" y2="1">
                    <stop offset="0" stopColor="#e5ca86" /><stop offset=".4" stopColor="#fff6d6" /><stop offset=".65" stopColor="#e6c47b" /><stop offset="1" stopColor="#b99049" />
                </linearGradient>
            </defs>
            <g className={head.id === 'crown' ? undefined : Style.headArt} strokeLinecap="round" strokeLinejoin="round">
                {head.id === 'crown' && head.paths.map((d) => <path key={d} d={d} fill={head.fill} stroke={head.color} strokeWidth="2" />)}
                {head.id === 'halo' && <>
                    <ellipse cx="20" cy="17" rx="15" ry="5.5" fill="none" stroke="#f7dda0" strokeWidth="6" opacity=".15" />
                    <path d="M5 17C1 17 0 14 1 11C3 14 5 14 8 14M35 17c4 0 5-3 4-6-2 3-4 3-7 3" fill="#fffcf1" stroke="#d6bd83" strokeWidth=".65" />
                    <path d="M2 15l4 1M38 15l-4 1" fill="none" stroke="#e4d3a7" strokeWidth=".6" />
                    <ellipse cx="20" cy="17" rx="15" ry="5.5" fill="none" stroke="#be9956" strokeWidth="3.4" />
                    <ellipse cx="20" cy="16.6" rx="15" ry="5.5" fill="none" stroke={'url(#' + id + '-ring)'} strokeWidth="2.5" />
                    <path d="M7 14.2C12 10.7 27 10.7 32 13.7M10 20.4Q20 23.4 30 20.4" fill="none" stroke="#fffbea" strokeWidth=".8" />
                    <path className={Style.gleam} d="M31 9l.8 2.2L34 12l-2.2.8L31 15l-.8-2.2L28 12l2.2-.8Z" fill="#fffcdf" stroke="#d7bd83" strokeWidth=".5" />
                    <circle cx="10" cy="8" r=".8" fill="#e5cb8c" />
                </>}
                {head.id === 'star' && <>
                    <path d="M20 2.5l5.4 8.3 9.6 2-6.5 7.3.8 9-9.3-4-9.3 4 .8-9L5 12.8l9.6-2Z" fill={'url(#' + id + '-head)'} stroke="#a993c4" strokeWidth="1" />
                    <path d="M20 5.7l4.2 7 7.8 1.6-5.4 5.7.8 6.5-7.4-3.2-7.4 3.2.8-6.5-5.4-5.7 7.8-1.6Z" fill="none" stroke="#fff8ff" strokeWidth=".8" />
                    <path d="M20 5.7v12l-7.4 8.8L14 20l-6-5.7 7.8-1.6Z" fill="#fff" opacity=".3" />
                    <path d="M20 12.7l1.2 3.8 3.8 1.2-3.8 1.2-1.2 3.8-1.2-3.8-3.8-1.2 3.8-1.2Z" fill="#fffbec" />
                </>}
                {head.id === 'bow' && <>
                    <path d="M16 17Q14 24 9 27l5-1 2 3 4-10M24 17q2 7 7 10l-5-1-2 3-4-10" fill="#f3c4d6" stroke="#be8099" strokeWidth=".85" />
                    <path d="M17 12C5 1 1 6 4 19c2 7 8 2 13-2M23 12C35 1 39 6 36 19c-2 7-8 2-13-2" fill={'url(#' + id + '-head)'} stroke="#be8099" strokeWidth="1" />
                    <path d="M6 8Q10 8 16 13M34 8q-4 0-10 5" fill="none" stroke="#fff7fa" strokeWidth="1.1" />
                    <path d="M7 18q4-3 9-3M33 18q-4-3-9-3M15 23l3-5M25 23l-3-5" fill="none" stroke="#cd92aa" strokeWidth=".7" />
                    <rect x="16.3" y="10.5" width="7.4" height="9" rx="2.8" fill="#f9d9e4" stroke="#be8099" strokeWidth=".9" />
                    <path d="M18.4 12.6v4.8" stroke="#fff7fa" strokeWidth="1" />
                </>}
                {head.id === 'sprout' && <>
                    <path d="M20 28Q17 19 22 12" fill="none" stroke="#659e82" strokeWidth="1.5" />
                    <path d="M19 20C6 21 3 10 5 5c9 0 17 5 14 15Z" fill={'url(#' + id + '-head)'} stroke="#72a98b" strokeWidth=".9" />
                    <path d="M21 14C20 4 29 1 36 3c0 9-7 14-15 11Z" fill="#dbf1d9" stroke="#72a98b" strokeWidth=".9" />
                    <path d="M8 8l11 12M32 6L21 14M12 12l.5-4M15 15l-5-.5M26 10l5 .4M28 8l-.2-3" fill="none" stroke="#91bd99" strokeWidth=".65" />
                    <path d="M7 6Q14 7 17 12M24 7q4-3 8-3" fill="none" stroke="#f7fff1" strokeWidth="1" />
                    <ellipse cx="11" cy="8.5" rx="1" ry="1.6" transform="rotate(-35 11 8.5)" fill="#fff" opacity=".85" />
                </>}
                {head.id === 'flower' && <>
                    {[0, 72, 144, 216, 288].map((angle) => <g key={angle} transform={'rotate(' + angle + ' 20 16)'}>
                        <path d="M18 15C10 11 13 2 18 2c6 0 8 9 4 13Z" fill={'url(#' + id + '-head)'} stroke="#cfa777" strokeWidth=".8" />
                        <path d="M18 5q-3 2-1 6M20 10v3" fill="none" stroke="#fffdf3" strokeWidth=".8" />
                    </g>)}
                    <circle cx="20" cy="16" r="4" fill="#efd391" stroke="#c7a367" strokeWidth=".8" />
                    <circle cx="19" cy="15" r="1.6" fill="#fff0b9" />
                    <path d="M22 16v.2M19 18v.2" stroke="#c4a25d" strokeWidth=".8" />
                </>}
            </g>
        </svg>}
    </>;
}
