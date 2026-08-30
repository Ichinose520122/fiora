/**
 * 炫彩标签的视觉参数。
 * 修改这里并重新构建前端即可调整粒子数量、大小、速度和扩散范围。
 */
export default {
    gradient: {
        angle: 115,
        durationSeconds: 5,
        backgroundSizePercent: 240,
    },
    particle: {
        count: 6,
        durationSeconds: 2.8,
        minSizePx: 8,
        maxSizePx: 13,
        spreadXPx: 34,
        spreadYPx: 18,
        startScale: 0.45,
        endScale: 1.15,
    },
};

