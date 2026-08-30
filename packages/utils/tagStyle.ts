export const TagStylePresets = [
    'solid',
    'dualGradient',
    'tripleGradient',
    'monochrome',
] as const;

export const TagParticleTypes = ['none', 'star', 'heart'] as const;

export type TagStylePreset = typeof TagStylePresets[number];
export type TagParticleType = typeof TagParticleTypes[number];

export interface TagStyle {
    preset: TagStylePreset;
    colors: string[];
    particle: TagParticleType;
}

export const defaultTagStyle: TagStyle = {
    preset: 'solid',
    colors: [],
    particle: 'none',
};

