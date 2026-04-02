/**
 * Modification engine analyzer — entry point for the /api/modify route.
 *
 * Validates the request, resolves the user's intent via the LLM classifier,
 * and builds the appropriate prompt pair.
 */

import { AnalyzedRequest, RequestValidationError } from '@/lib/shared/types';
import { resolveModificationIntent, ModificationIntent, BlockSummary } from './intent-resolver';
import {
    getSystemPrompt,
    buildEditPrompt,
    buildAddSectionPrompt,
    buildGlobalStyleEditPrompt,
} from './prompts';
import { logger } from '@/lib/logger';

// ─── Types ───────────────────────────────────────────────────────

export interface ModifyRequestBody {
    prompt: string;
    apiKey?: string;
    model?: string;
    blocks: BlockSummary[];
    fullBlocks?: Array<{ id: string; label: string; html: string }>;
    selectedBlockId?: string | null;
    designStylePrompt?: string;
    projectContext?: string;
    existingSectionsSummary?: string;
}

export interface ModificationAnalysisResult extends AnalyzedRequest {
    intent: ModificationIntent;
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Analyse a modification request.
 *
 * 1. Resolve intent via the LLM intent-resolver
 * 2. Based on intent.kind, pick the right prompt builder
 * 3. Return { mode, systemPrompt, userPrompt, intent }
 */
export async function analyzeModificationRequest(
    body: ModifyRequestBody,
    apiKey: string,
): Promise<ModificationAnalysisResult> {
    const {
        prompt,
        blocks,
        fullBlocks,
        selectedBlockId,
        designStylePrompt,
        projectContext,
        existingSectionsSummary,
    } = body;

    // ── Validation ──────────────────────────────────────────────────
    if (!prompt) {
        throw new RequestValidationError('Prompt is required for modifications', 400);
    }

    if (!blocks || blocks.length === 0) {
        throw new RequestValidationError('No blocks provided — cannot modify an empty page', 400);
    }

    // ── Resolve intent ──────────────────────────────────────────────
    const intent = await resolveModificationIntent(
        prompt,
        blocks,
        selectedBlockId || null,
        apiKey,
    );

    logger.info('analyzeModificationRequest: intent resolved', { kind: intent.kind });

    // ── Build prompts based on intent ───────────────────────────────
    const systemPrompt = getSystemPrompt(designStylePrompt || undefined, projectContext || undefined);

    switch (intent.kind) {
        case 'section-edit': {
            const fullBlock = fullBlocks?.find((b) => b.id === intent.targetBlockId);
            const blockHtml = fullBlock?.html || `<!-- Block ${intent.targetBlockId} -->`;
            return {
                mode: 'edit',
                systemPrompt,
                userPrompt: buildEditPrompt(blockHtml, prompt, intent.targetBlockId),
                intent,
            };
        }

        case 'add-section': {
            return {
                mode: 'add-section',
                systemPrompt,
                userPrompt: buildAddSectionPrompt(prompt, existingSectionsSummary || undefined),
                intent,
            };
        }

        case 'remove-section': {
            // No LLM call needed — just return the removal instruction
            return {
                mode: 'remove-section',
                systemPrompt: '',
                userPrompt: '',
                intent,
            };
        }

        case 'global-style-edit': {
            // For global style edits, we process each block individually.
            // The route handler will iterate over blocks; we return the first
            // block's prompt as a template and include the intent.
            const firstBlock = fullBlocks?.[0];
            if (firstBlock) {
                return {
                    mode: 'global-style-edit',
                    systemPrompt,
                    userPrompt: buildGlobalStyleEditPrompt(firstBlock.html, prompt, firstBlock.id),
                    intent,
                };
            }
            // Fallback to add-section if no full blocks provided
            return {
                mode: 'add-section',
                systemPrompt,
                userPrompt: buildAddSectionPrompt(prompt, existingSectionsSummary || undefined),
                intent: { kind: 'add-section' },
            };
        }

        case 'multi-section-edit': {
            // Multi-section: return first target block's prompt as template
            const firstTargetId = intent.targetBlockIds[0];
            const firstTarget = fullBlocks?.find((b) => b.id === firstTargetId);
            if (firstTarget) {
                return {
                    mode: 'multi-section-edit',
                    systemPrompt,
                    userPrompt: buildEditPrompt(firstTarget.html, prompt, firstTarget.id),
                    intent,
                };
            }
            return {
                mode: 'add-section',
                systemPrompt,
                userPrompt: buildAddSectionPrompt(prompt, existingSectionsSummary || undefined),
                intent: { kind: 'add-section' },
            };
        }

        default: {
            logger.error('analyzeModificationRequest', `Unknown intent kind — defaulting to add-section`);
            return {
                mode: 'add-section',
                systemPrompt,
                userPrompt: buildAddSectionPrompt(prompt, existingSectionsSummary || undefined),
                intent: { kind: 'add-section' },
            };
        }
    }
}
