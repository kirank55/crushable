export const DESIGN_STYLE_IDS = ['professional', 'playful', 'minimal', 'bold', 'elegant'] as const;

export type DesignStyleId = (typeof DESIGN_STYLE_IDS)[number];

const DESIGN_STYLE_PROMPTS: Record<DesignStyleId, string> = {
    professional:
        'Create a polished, conversion-focused interface with restrained color, clear hierarchy, generous whitespace, and confident but understated visual details. Favor clean grids, structured sections, subtle shadows, and practical CTAs over decorative flourishes.',
    playful:
        'Create a lively, approachable interface with energetic color, rounded forms, upbeat visual rhythm, and friendly typography. Use brighter accents, layered cards, and expressive composition while keeping the layout clear and conversion-focused.',
    minimal:
        'Create a refined minimal interface with disciplined spacing, sparse color usage, sharp typography, and strong restraint. Favor simple compositions, reduced ornamentation, clean alignment, and deliberate negative space.',
    bold:
        'Create a high-impact interface with assertive contrast, strong visual anchors, oversized type moments, and dynamic section composition. Use dramatic hierarchy, punchy accents, and memorable layouts without sacrificing clarity or usability.',
    elegant:
        'Create a premium, sophisticated interface with elevated typography, balanced spacing, tasteful contrast, and carefully composed visual details. Favor subtle gradients, refined card treatments, and a calm luxurious tone.',
};

export function isDesignStyleId(value: string): value is DesignStyleId {
    return (DESIGN_STYLE_IDS as readonly string[]).includes(value);
}

export function normalizeDesignStyleId(value?: string | null): DesignStyleId {
    const normalized = value?.trim().toLowerCase() || '';
    return isDesignStyleId(normalized) ? normalized : 'professional';
}

export function getDesignStylePrompt(styleId: DesignStyleId): string {
    return DESIGN_STYLE_PROMPTS[styleId];
}

export function getDesignStyleLabel(styleId: DesignStyleId): string {
    return styleId.charAt(0).toUpperCase() + styleId.slice(1);
}