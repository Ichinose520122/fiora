import React from 'react';

import tagEffect from '@fiora/config/tagEffect';
import { defaultTagStyle, TagStyle } from '@fiora/utils/tagStyle';
import Style from './UserTag.less';

interface UserTagProps {
    text: string;
    tagStyle?: TagStyle;
    fallbackColor: string;
    className?: string;
}

function getGradientColors(tagStyle: TagStyle) {
    if (tagStyle.preset === 'monochrome') {
        return ['#050505', '#f5f5f5', '#141414'];
    }
    if (tagStyle.preset === 'dualGradient' && tagStyle.colors.length < 2) {
        return ['#5b8ff9', '#f759ab'];
    }
    if (tagStyle.preset === 'tripleGradient' && tagStyle.colors.length < 3) {
        return ['#5b8ff9', '#f759ab', '#ffd666'];
    }
    return tagStyle.colors;
}

function UserTag(props: UserTagProps) {
    const {
        text,
        tagStyle = defaultTagStyle,
        fallbackColor,
        className = '',
    } = props;
    const isGradient = tagStyle.preset !== 'solid';
    const colors = getGradientColors(tagStyle);
    const rootStyle: React.CSSProperties = isGradient
        ? {
            backgroundImage: `linear-gradient(${tagEffect.gradient.angle}deg, ${colors.join(
                ', ',
            )})`,
            backgroundSize: `${tagEffect.gradient.backgroundSizePercent}% ${tagEffect.gradient.backgroundSizePercent}%`,
            animationDuration: `${tagEffect.gradient.durationSeconds}s`,
        }
        : { backgroundColor: fallbackColor };

    const particleCount =
        tagStyle.particle === 'none' ? 0 : tagEffect.particle.count;
    const particleCharacter = tagStyle.particle === 'star' ? '☆' : '♥';
    const particleColors = colors.length > 0 ? colors : [fallbackColor];

    return (
        <span
            className={`${Style.tag} ${
                isGradient ? Style.animatedGradient : ''
            } ${tagStyle.preset === 'monochrome' ? Style.monochrome : ''} ${
                particleCount > 0 ? Style.hasParticles : ''
            } ${className}`}
            style={rootStyle}
        >
            <span className={Style.text}>{text}</span>
            {Array.from({ length: particleCount }).map((_, index) => {
                const progress = index / particleCount;
                const angle = progress * Math.PI * 2;
                const sizeProgress = (index % 3) / 2;
                const particleStyle = {
                    '--particle-x': `${Math.cos(angle) *
                        tagEffect.particle.spreadXPx}px`,
                    '--particle-y': `${Math.sin(angle) *
                        tagEffect.particle.spreadYPx}px`,
                    '--particle-start-scale': tagEffect.particle.startScale,
                    '--particle-end-scale': tagEffect.particle.endScale,
                    color: particleColors[index % particleColors.length],
                    fontSize: `${
                        tagEffect.particle.minSizePx +
                        (tagEffect.particle.maxSizePx -
                            tagEffect.particle.minSizePx) *
                            sizeProgress
                    }px`,
                    animationDuration: `${tagEffect.particle.durationSeconds}s`,
                    animationDelay: `${
                        (-tagEffect.particle.durationSeconds * index) /
                        particleCount
                    }s`,
                } as React.CSSProperties;
                return (
                    <span
                        // eslint-disable-next-line react/no-array-index-key
                        key={index}
                        className={Style.particle}
                        style={particleStyle}
                        aria-hidden="true"
                    >
                        {particleCharacter}
                    </span>
                );
            })}
        </span>
    );
}

export default React.memo(UserTag);
