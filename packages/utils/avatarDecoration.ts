/** Shared vector paths: SVG on web, native SVG paths on Android. */
export const musicMark = 'M19.8 18.6A9 9 0 1 1 21 12v2.1c0 3-4 3.1-4 .1V7.4l-6 1.4v6.3M17 11l-6 1.4M11 15.1c0 2.7-4.4 3.3-4.4 1.2 0-1.7 3-2.8 4.4-1.2M17 13.6c0 2.7-4.4 3.3-4.4 1.2 0-1.7 3-2.8 4.4-1.2';
export const crownMark = 'M7 20L4 8l9 5L20 3l7 10 9-5-3 12ZM8 25h24M20 17v3';
export const avatarPresets = [
    { id: 'none', name: '无挂件', color: '#a0aac0', paths: [] },
    { id: 'orbit', name: '星河环', color: '#8a8bdd', paths: ['M13 36A43 43 0 0 1 72 10M87 64A43 43 0 0 1 28 90', 'M3 64C-7 86 25 88 62 65S113 14 93 18', 'M79 8l2 6 6 2-6 2-2 6-2-6-6-2 6-2ZM18 76l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z'] },
    { id: 'bloom', name: '花间枝', color: '#cf8da6', paths: ['M10 45C-3 70 10 92 34 95M90 45c13 25 0 47-24 50', 'M12 67C-4 60-1 81 14 79M17 82C4 84 16 98 24 89M88 67c16-7 13 14-2 12M83 82c13 2 1 16-7 7', 'M49 92c-14-17-19 3-6 4-4 12 13 12 13 1 14-1 7-19-7-5Z'] },
    { id: 'cat', name: '月光猫', color: '#a391ce', paths: ['M8 26L5 0q18 2 27 13M68 13Q77 2 95 0l-3 26', 'M14 17l-2-9 10 7M86 17l2-9-10 7', 'M8 73A45 45 0 0 0 92 73M6 63l-8-3M7 68l-9 3M94 63l8-3M93 68l9 3', 'M49 91l2 4 5 1-4 3 1 5-4-3-4 3 1-5-4-3 5-1Z'] },
    { id: 'wings', name: '晴空羽', color: '#80b7cc', paths: ['M9 69C-10 62-10 38-7 27q7 14 18 15M91 69c19-7 19-31 16-42-7 14-18 15', 'M8 59C-2 53-3 45-3 38M9 50q-5-1-8-6M92 59c10-6 11-14 11-21M91 50q5-1 8-6', 'M17 81A44 44 0 0 0 83 81M38 96l12 6 12-6'] },
] as const;
export type AvatarDecoration = { decoration: string; isAdmin: boolean };
