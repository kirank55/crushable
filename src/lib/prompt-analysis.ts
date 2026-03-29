import {
    getSystemPrompt,
    buildEditPrompt,
    buildNewPrompt,
    buildPlanPrompt,
    buildDetailedPlanPrompt,
    buildAddSectionPrompt,
    buildGlobalStyleEditPrompt,
    buildModificationIntentPrompt,
    buildValidationPrompt,
    buildStyleSelectPrompt,
} from '@/lib/prompt';
import { logger } from '@/lib/logger';
import { textFromOpenRouter } from '@/lib/openrouter';

export interface AnalyzedRequest {
    mode: string;
    systemPrompt: string;
    userPrompt: string;
}

export class RequestValidationError extends Error {
    constructor(
        public readonly message: string,
        public readonly statusCode: number = 400,
    ) {
        super(message);
        this.name = 'RequestValidationError';
    }
}

export interface GenerateRequestBody {
    prompt?: string;
    currentHtml?: string;
    blockId?: string;
    mode?: string;
    apiKey?: string;
    model?: string;
    designStylePrompt?: string;
    projectContext?: string;
    planDetails?: {
        brandName?: string;
        productDescription?: string;
        designStyleLabel?: string;
        heroTitle?: string;
        subtitle?: string;
        ctaText?: string;
    };
    fullHtml?: string;
    existingSectionsSummary?: string;
    blocksSummary?: string;
    selectedBlockId?: string;
}

/** All modes the LLM classifier is allowed to return. */
const KNOWN_MODES = [
    'new',
    'edit',
    'add-section',
    'plan',
    'detailed-plan',
    'style-select',
    'validate',
    'global-style-edit',
    'modification-intent',
] as const;

type KnownMode = typeof KNOWN_MODES[number];

/**
 * Ask the LLM to pick the correct generation mode for the given user prompt.
 * Returns a `KnownMode` string; falls back to `'new'` if the LLM returns
 * something unrecognised.
 */
async function inferModeFromLLM(userPrompt: string, apiKey: string): Promise<KnownMode> {
    const systemPrompt =
        'You are a routing classifier for a landing-page builder. ' +
        'Given a user request, respond with EXACTLY ONE of the following mode identifiers and nothing else:\n' +
        KNOWN_MODES.join(' | ') + '\n\n' +
        'Rules:\n' +
        '- "new"               → build an entirely new HTML section from scratch\n' +
        '- "edit"              → modify a specific existing block\n' +
        '- "add-section"       → append a new section to an existing page\n' +
        '- "plan"              → produce a section plan as a JSON array\n' +
        '- "detailed-plan"     → write a detailed brand/product execution plan\n' +
        '- "style-select"      → pick a design style ID for a product\n' +
        '- "validate"          → review HTML for structural / UX issues\n' +
        '- "global-style-edit" → apply a style change across all blocks\n' +
        '- "modification-intent" → resolve ambiguous modification intent\n' +
        'Return only the mode identifier, no punctuation, no explanation.';

    logger.info('inferModeFromLLM: calling LLM for mode inference', { promptLength: userPrompt.length });

    const raw = await textFromOpenRouter({ prompt: userPrompt, systemPrompt, apiKey });
    const inferred = raw.trim().toLowerCase() as KnownMode;

    if ((KNOWN_MODES as readonly string[]).includes(inferred)) {
        logger.info(`inferModeFromLLM: LLM returned mode "${inferred}"`);
        return inferred;
    }

    logger.error('inferModeFromLLM', `LLM returned unrecognised mode "${inferred}" — falling back to "new"`);
    return 'new';
}

/**
 * Validate the request body and resolve the correct system + user prompt pair
 * for the given generation mode.
 *
 * When `body.mode` is undefined the function asks the LLM to infer the mode
 * from the user's prompt.  Pass `apiKey` so that inference call can authenticate.
 *
 * Throws `RequestValidationError` on invalid input so the route can return a
 * structured HTTP error without knowing any prompt details.
 */
export async function analyzeRequest(body: GenerateRequestBody, apiKey?: string): Promise<AnalyzedRequest> {
    const {
        prompt,
        currentHtml,
        blockId,
        mode,
        designStylePrompt,
        projectContext,
        planDetails,
        fullHtml,
        existingSectionsSummary,
        blocksSummary,
        selectedBlockId,
    } = body;

    // ── Validation ──────────────────────────────────────────────────────────
    const promptRequiredModes = [
        'plan',
        'style-select',
        'edit',
        'add-section',
        'global-style-edit',
        'modification-intent',
    ];
    const promptOptionalModes = ['detailed-plan', 'validate'];

    if (!prompt && promptRequiredModes.includes(mode || '')) {
        logger.error('analyzeRequest', `Missing prompt for mode "${mode}"`);
        throw new RequestValidationError('Prompt is required', 400);
    }

    if (!prompt && !promptOptionalModes.includes(mode || '') && !mode) {
        logger.error('analyzeRequest', 'Missing prompt for new block mode');
        throw new RequestValidationError('Prompt is required', 400);
    }

    // ── Mode resolution ──────────────────────────────────────────────────────
    //
    // If `mode` is undefined, ask the LLM to infer it from the user's prompt.
    // The classifier returns one of the KNOWN_MODES identifiers; unknown replies
    // fall back to 'new' so this path is always safe.
    let systemPrompt: string;
    let userPrompt: string;
    let resolvedMode: string;

    if (!mode) {
        if (apiKey && prompt) {
            resolvedMode = await inferModeFromLLM(prompt, apiKey);
            logger.info(`analyzeRequest: mode inferred by LLM as "${resolvedMode}"`);
        } else {
            resolvedMode = 'new';
            logger.info('analyzeRequest: mode not provided and no apiKey/prompt for inference — defaulting to "new"');
        }
    } else {
        resolvedMode = mode;
    }

    if (mode === 'detailed-plan') {
        const d = planDetails || {};
        systemPrompt =
            'You are a landing page strategist. Generate a detailed, conversion-focused execution plan tailored to the specific product and brand. Return ONLY the plan text in the exact numbered format requested, with no markdown code blocks or extra commentary.';
        userPrompt = buildDetailedPlanPrompt(
            d.brandName || 'Your brand',
            d.productDescription || 'A product',
            d.designStyleLabel || 'Professional',
            d.heroTitle || 'A strong value-focused hero headline',
            d.subtitle || 'A concise supporting message that explains the offer and why it matters.',
            d.ctaText || 'Get Started',
        );
        logger.info('analyzeRequest: detailed-plan mode', { brandName: d.brandName });

    } else if (mode === 'plan') {
        systemPrompt =
            'You are a landing page planner. Given a user request, return a JSON array of section names to build. Choose 4-6 sections.';
        userPrompt = buildPlanPrompt(prompt!);
        logger.info('analyzeRequest: plan mode');

    } else if (mode === 'style-select') {
        systemPrompt =
            'You select the most appropriate design style ID for a product description. Return only one valid style ID.';
        userPrompt = buildStyleSelectPrompt(prompt!);
        logger.info('analyzeRequest: style-select mode');

    } else if (mode === 'validate') {
        systemPrompt =
            'You review landing page HTML and identify structural and UX issues. Return concise plain text findings.';
        userPrompt = buildValidationPrompt(fullHtml || prompt || '');
        logger.info('analyzeRequest: validate mode');

    } else if (mode === 'modification-intent' && blocksSummary) {
        systemPrompt = 'You resolve a user intent for modifying an existing landing page. Return only JSON.';
        userPrompt = buildModificationIntentPrompt(prompt!, blocksSummary, selectedBlockId || null);
        logger.info('analyzeRequest: modification-intent mode');

    } else if (mode === 'global-style-edit' && currentHtml && blockId) {
        systemPrompt = getSystemPrompt(designStylePrompt || undefined, projectContext || undefined);
        userPrompt = buildGlobalStyleEditPrompt(currentHtml, prompt!, blockId);
        logger.info('analyzeRequest: global-style-edit mode', { blockId, currentHtmlLength: currentHtml.length });

    } else if (mode === 'add-section') {
        systemPrompt = getSystemPrompt(designStylePrompt || undefined, projectContext || undefined);
        userPrompt = buildAddSectionPrompt(prompt!, existingSectionsSummary || undefined);
        logger.info('analyzeRequest: add-section mode');

    } else if (mode === 'edit' && currentHtml && blockId) {
        systemPrompt = getSystemPrompt(designStylePrompt || undefined, projectContext || undefined);
        userPrompt = buildEditPrompt(currentHtml, prompt!, blockId);
        logger.info('analyzeRequest: edit mode', { blockId, currentHtmlLength: currentHtml.length });

    } else {
        // Default: generate a new block
        systemPrompt = getSystemPrompt(designStylePrompt || undefined, projectContext || undefined);
        userPrompt = buildNewPrompt(prompt!);
        logger.info('analyzeRequest: new block mode');
    }

    logger.prompt('system', systemPrompt);
    logger.prompt('user', userPrompt);

    return { mode: resolvedMode, systemPrompt, userPrompt };
}
