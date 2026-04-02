/**
 * LLM-based intent classification for modification requests.
 *
 * Determines what modification the user wants based on their prompt
 * and the current page state.
 */

import { textFromOpenRouter } from '@/lib/openrouter';
import { parseJsonObjectResponse } from '@/lib/shared/prompt-utils';
import { buildModificationIntentPrompt } from './prompts';
import { logger } from '@/lib/logger';

// ─── Types ───────────────────────────────────────────────────────

export interface BlockSummary {
    id: string;
    label: string;
    excerpt: string;
    /** Heading text (h1-h6) extracted from the block HTML */
    headings?: string[];
}

export type ModificationIntent =
    | { kind: 'section-edit'; targetBlockId: string }
    | { kind: 'add-section' }
    | { kind: 'remove-section'; targetBlockId: string }
    | { kind: 'global-style-edit' }
    | { kind: 'multi-section-edit'; targetBlockIds: string[] };

interface IntentLLMResponse {
    requestKind: string;
    selectedBlockId?: string | null;
    targetBlockIds?: string[];
    summary?: string;
    confidence?: 'high' | 'medium' | 'low';
}

// ─── Helpers ─────────────────────────────────────────────────────

function buildBlocksSummary(blocks: BlockSummary[]): string {
    return blocks
        .map((b) => {
            const parts = [`- [${b.id}] "${b.label}"`];
            if (b.headings?.length) {
                parts.push(`  Headings: ${b.headings.map((h) => `"${h}"`).join(' | ')}`);
            }
            parts.push(`  Text: ${b.excerpt}`);
            return parts.join('\n');
        })
        .join('\n');
}

/**
 * Scan block content for text that appears in the user's prompt.
 *
 * Returns a hint string the LLM can use to prioritise the correct block.
 * This catches cases like the user referencing "Unmatched Gaming Performance"
 * which exists only in one section's heading.
 */
function buildContentMatchHints(userPrompt: string, blocks: BlockSummary[]): string {
    const promptLower = userPrompt.toLowerCase();
    const matches: { blockId: string; matchedText: string; source: 'heading' | 'content' }[] = [];

    for (const block of blocks) {
        // Check headings first — these are the strongest signal
        for (const heading of block.headings || []) {
            if (promptLower.includes(heading.toLowerCase())) {
                matches.push({ blockId: block.id, matchedText: heading, source: 'heading' });
            }
        }

        // Check for multi-word phrases from the prompt appearing in content
        // Build sliding windows of 3+ words from the prompt
        const promptWords = promptLower.split(/\s+/).filter((w) => w.length > 1);
        for (let len = Math.min(5, promptWords.length); len >= 3; len--) {
            for (let i = 0; i <= promptWords.length - len; i++) {
                const phrase = promptWords.slice(i, i + len).join(' ');
                if (phrase.length < 10) continue; // Skip short/common phrases
                const contentLower = block.excerpt.toLowerCase();
                if (contentLower.includes(phrase)) {
                    // Only add if the phrase is unique to this block
                    const matchCount = blocks.filter((b) =>
                        b.excerpt.toLowerCase().includes(phrase),
                    ).length;
                    if (matchCount === 1) {
                        matches.push({ blockId: block.id, matchedText: phrase, source: 'content' });
                    }
                }
            }
        }
    }

    if (matches.length === 0) return '';

    // Deduplicate by blockId + matchedText
    const seen = new Set<string>();
    const unique = matches.filter((m) => {
        const key = `${m.blockId}:${m.matchedText}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    return [
        '',
        'CONTENT MATCH ANALYSIS (auto-detected):',
        'The following blocks contain text that matches phrases from the user\'s request:',
        ...unique.map((m) => `- Block "${m.blockId}" ${m.source === 'heading' ? 'has heading' : 'contains'} "${m.matchedText}"`),
        'Strongly prefer these matches over thematic guesses.',
    ].join('\n');
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Resolve the user's modification intent using the LLM classifier.
 *
 * Three-tier targeting:
 * 1. Explicit selection — user clicked a block → selectedBlockId is set
 * 2. LLM inference — if no block is selected, the classifier picks the best target
 * 3. Fallback — if inference confidence is "low", returns add-section as safe default
 */
export async function resolveModificationIntent(
    userPrompt: string,
    blocks: BlockSummary[],
    selectedBlockId: string | null,
    apiKey: string,
): Promise<ModificationIntent> {
    const blocksSummary = buildBlocksSummary(blocks);
    const contentMatchHints = buildContentMatchHints(userPrompt, blocks);
    const validIds = new Set(blocks.map((b) => b.id));

    logger.info('resolveModificationIntent: calling LLM', {
        promptLength: userPrompt.length,
        blockCount: blocks.length,
        hasSelection: !!selectedBlockId,
        contentMatchHints: contentMatchHints || '(none)',
    });

    const systemPrompt = 'You resolve a user intent for modifying an existing landing page. Return only JSON.';
    const prompt = buildModificationIntentPrompt(userPrompt, blocksSummary, selectedBlockId, contentMatchHints);

    const raw = await textFromOpenRouter({ prompt, systemPrompt, apiKey });
    const parsed = parseJsonObjectResponse<IntentLLMResponse>(raw);

    if (!parsed) {
        logger.error('resolveModificationIntent', 'Failed to parse LLM response — defaulting to add-section');
        return { kind: 'add-section' };
    }

    logger.info('resolveModificationIntent: LLM returned', {
        kind: parsed.requestKind,
        selectedBlockId: parsed.selectedBlockId,
        targetBlockIds: parsed.targetBlockIds,
        confidence: parsed.confidence,
    });

    // Map LLM response to a strongly-typed ModificationIntent
    switch (parsed.requestKind) {
        case 'section-edit': {
            const targetId = parsed.selectedBlockId;
            if (!targetId || !validIds.has(targetId)) {
                logger.error('resolveModificationIntent', `Invalid block id "${targetId}" — defaulting to add-section`);
                return { kind: 'add-section' };
            }
            return { kind: 'section-edit', targetBlockId: targetId };
        }

        case 'remove-section': {
            const targetId = parsed.selectedBlockId;
            if (!targetId || !validIds.has(targetId)) {
                logger.error('resolveModificationIntent', `Invalid block id "${targetId}" for remove`);
                return { kind: 'add-section' };
            }
            return { kind: 'remove-section', targetBlockId: targetId };
        }

        case 'global-style-edit':
            return { kind: 'global-style-edit' };

        case 'multi-section-edit': {
            const ids = (parsed.targetBlockIds || []).filter((id) => validIds.has(id));
            if (ids.length === 0) {
                logger.error('resolveModificationIntent', 'No valid block ids for multi-section-edit');
                return { kind: 'add-section' };
            }
            if (ids.length === 1) {
                return { kind: 'section-edit', targetBlockId: ids[0] };
            }
            return { kind: 'multi-section-edit', targetBlockIds: ids };
        }

        case 'add-section':
        default:
            return { kind: 'add-section' };
    }
}
