/**
 * Initial-generation analyzer.
 *
 * Handles only the modes used during first-time page creation.
 * The mode is always explicitly provided by the client — no LLM inference needed.
 */

import { AnalyzedRequest, RequestValidationError } from '@/lib/shared/types';
import {
    getSystemPrompt,
    buildDescriptionPrompt,
    buildPlanPrompt,
    buildDetailedPlanPrompt,
    buildStyleSelectPrompt,
    buildValidationPrompt,
    buildNewPrompt,
} from './prompts';
import { logger } from '@/lib/logger';

export type InitialGenerationMode =
    | 'describe'
    | 'plan'
    | 'detailed-plan'
    | 'style-select'
    | 'validate'
    | 'new';

export interface InitialGenerationRequestBody {
    prompt?: string;
    mode: InitialGenerationMode;
    productDescription?: string;
    designStyle?: string;
    designStylePrompt?: string;
    projectContext?: string;
    fullHtml?: string;
    planDetails?: {
        brandName?: string;
        productDescription?: string;
        designStyleLabel?: string;
        heroTitle?: string;
        subtitle?: string;
        ctaText?: string;
    };
}

/**
 * Resolve the system + user prompt pair for an initial generation request.
 *
 * No LLM-based mode inference — the client always sends an explicit mode
 * because the initial generation flow is deterministic: plan → build sections.
 */
export function analyzeInitialRequest(body: InitialGenerationRequestBody): AnalyzedRequest {
    const { prompt, mode, productDescription, designStyle, designStylePrompt, projectContext, fullHtml, planDetails } = body;

    // ── Validation ──────────────────────────────────────────────────
    const promptRequiredModes: InitialGenerationMode[] = ['describe', 'plan', 'style-select', 'new'];

    if (!prompt && promptRequiredModes.includes(mode)) {
        logger.error('analyzeInitialRequest', `Missing prompt for mode "${mode}"`);
        throw new RequestValidationError('Prompt is required', 400);
    }

    // ── Mode resolution (deterministic — no inference) ──────────────
    switch (mode) {
        case 'describe': {
            logger.info('analyzeInitialRequest: describe mode');
            return {
                mode: 'describe',
                systemPrompt:
                    'You convert raw homepage briefs into concise product descriptions for downstream planning. Return plain text only with no bullets, markdown, or labels.',
                userPrompt: buildDescriptionPrompt(prompt!),
            };
        }

        case 'plan': {
            logger.info('analyzeInitialRequest: plan mode');
            return {
                mode: 'plan',
                systemPrompt:
                    'You are a landing page planner. Given a user request, return a JSON array of section names to build. Choose 4-6 sections.',
                userPrompt: buildPlanPrompt(prompt!, productDescription, designStyle),
            };
        }

        case 'detailed-plan': {
            const d = planDetails || {};
            logger.info('analyzeInitialRequest: detailed-plan mode', { brandName: d.brandName });
            return {
                mode: 'detailed-plan',
                systemPrompt:
                    'You are a landing page strategist. Generate a detailed, conversion-focused execution plan tailored to the specific product and brand. Return ONLY the plan text in the exact numbered format requested, with no markdown code blocks or extra commentary.',
                userPrompt: buildDetailedPlanPrompt(
                    d.brandName || 'Your brand',
                    d.productDescription || 'A product',
                    d.designStyleLabel || 'Professional',
                    d.heroTitle || 'A strong value-focused hero headline',
                    d.subtitle || 'A concise supporting message that explains the offer and why it matters.',
                    d.ctaText || 'Get Started',
                ),
            };
        }

        case 'style-select': {
            logger.info('analyzeInitialRequest: style-select mode');
            return {
                mode: 'style-select',
                systemPrompt:
                    'You select the most appropriate design style ID for a product description. Return only one valid style ID.',
                userPrompt: buildStyleSelectPrompt(prompt!),
            };
        }

        case 'validate': {
            logger.info('analyzeInitialRequest: validate mode');
            return {
                mode: 'validate',
                systemPrompt:
                    'You review landing page HTML and identify structural and UX issues. Return concise plain text findings.',
                userPrompt: buildValidationPrompt(fullHtml || prompt || ''),
            };
        }

        case 'new': {
            logger.info('analyzeInitialRequest: new block mode');
            return {
                mode: 'new',
                systemPrompt: getSystemPrompt(designStylePrompt || undefined, projectContext || undefined),
                userPrompt: buildNewPrompt(prompt!),
            };
        }

        default: {
            logger.error('analyzeInitialRequest', `Unknown mode: ${mode}`);
            throw new RequestValidationError(`Unknown mode: ${mode}`, 400);
        }
    }
}
