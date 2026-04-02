/**
 * useModificationEngine — handles all post-generation modifications.
 *
 * Sends requests to /api/modify, which resolves intent via LLM
 * and returns modified HTML. This hook applies the results to the page state.
 */

import { useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Block, Message } from '@/types';
import { getApiKey, getModel } from '@/lib/storage';
import { createBlock } from '@/lib/blocks';
import { parseResponse } from '@/lib/shared/prompt-utils';
import { logger } from '@/lib/logger';
import { usePageStateContext } from '@/context/PageStateContext';
import { extractBlockExcerpt } from '@/lib/modification/extract-excerpt';

// ─── Types ───────────────────────────────────────────────────────

// Use the shared GenerationPhase which includes both engine phases
import type { GenerationPhase } from './useInitialGeneration';

interface ModificationResponse {
    intent: {
        kind: string;
        targetBlockId?: string;
        targetBlockIds?: string[];
    };
    mode: string;
}

// ─── Pure helpers ────────────────────────────────────────────────

function createAssistantMessage(content: string): Message {
    return {
        id: uuidv4(),
        role: 'assistant',
        content,
        timestamp: Date.now(),
    };
}

function createUserMessage(content: string): Message {
    return { id: uuidv4(), role: 'user', content, timestamp: Date.now() };
}

// ─── API helper ──────────────────────────────────────────────────

/** POST to `/api/modify` and return the response. */
async function fetchModification(
    payload: Record<string, unknown>,
    signal?: AbortSignal,
): Promise<{ text: string; intent: ModificationResponse['intent']; mode: string }> {
    const startTime = Date.now();
    logger.info('fetchModification: POST /api/modify');

    const res = await fetch('/api/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
            apiKey: getApiKey(),
            model: getModel(),
            ...payload,
        }),
    });

    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Modification failed (${res.status})`);
    }

    const contentType = res.headers.get('Content-Type') || '';
    const resolvedMode = res.headers.get('X-Resolved-Mode') || 'unknown';
    const intentHeader = res.headers.get('X-Intent');
    const intent = intentHeader ? JSON.parse(intentHeader) : { kind: 'add-section' };

    // JSON response (remove-section — no streaming needed)
    if (contentType.includes('application/json')) {
        const json = await res.json();
        logger.info(`fetchModification: JSON response (mode: ${json.mode}) after ${Date.now() - startTime}ms`);
        return { text: '', intent: json.intent || intent, mode: json.mode || resolvedMode };
    }

    // Streamed text response (edit, add-section, global-style-edit, etc.)
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response stream');

    const decoder = new TextDecoder();
    let text = '';

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
    }

    logger.info(`fetchModification: done in ${Date.now() - startTime}ms`);
    return { text, intent, mode: resolvedMode };
}

// ─── Hook ────────────────────────────────────────────────────────

export function useModificationEngine() {
    const {
        blocks,
        selectedBlockId,
        savedMessages: messages,
        setSavedMessages: onMessagesChange,
        addBlockSmart: onAddBlockSmart,
        updateBlock: onUpdateBlock,
        removeBlock: onRemoveBlock,
        createVersionSnapshot: onVersionCreated,
    } = usePageStateContext();

    const [isLoading, setIsLoading] = useState(false);
    const [phase, setPhase] = useState<GenerationPhase>('idle');
    const [statusText, setStatusText] = useState('');
    const abortRef = useRef<AbortController | null>(null);

    const messagesRef = useRef(messages);
    messagesRef.current = messages;

    const blocksRef = useRef(blocks);
    blocksRef.current = blocks;

    // ── Stop ──────────────────────────────────────────────────────

    const handleStop = useCallback(() => {
        abortRef.current?.abort();
        setIsLoading(false);
        setPhase('idle');
        setStatusText('');
    }, []);

    // ── Modify ──────────────────────────────────────────────────

    const modify = useCallback(
        async (userPrompt: string) => {
            abortRef.current = new AbortController();
            const { signal } = abortRef.current;

            let currentMessages = [...messagesRef.current, createUserMessage(userPrompt)];
            onMessagesChange(currentMessages);

            setIsLoading(true);
            setPhase('resolving');
            setStatusText('Understanding your request…');

            try {
                const currentBlocks = blocksRef.current;

                // Build block summaries for the intent resolver
                const blockSummaries = currentBlocks.map((b) => {
                    const { excerpt, headings } = extractBlockExcerpt(b.html);
                    return {
                        id: b.id,
                        label: b.label,
                        excerpt,
                        headings,
                    };
                });

                // Build full blocks for the prompt builder (need HTML)
                const fullBlocks = currentBlocks.map((b) => ({
                    id: b.id,
                    label: b.label,
                    html: b.html,
                }));

                // Build existing sections summary for add-section context
                const existingSectionsSummary = currentBlocks
                    .map((b) => `- "${b.label}" (id: ${b.id})`)
                    .join('\n');

                const { text, intent, mode } = await fetchModification(
                    {
                        prompt: userPrompt,
                        blocks: blockSummaries,
                        fullBlocks,
                        selectedBlockId,
                        existingSectionsSummary,
                    },
                    signal,
                );

                setPhase('modifying');

                logger.info('modify: applying intent', { kind: intent.kind, mode });

                let summary = '';

                switch (intent.kind) {
                    case 'section-edit': {
                        const targetId = intent.targetBlockId!;
                        const targetBlock = currentBlocks.find((b) => b.id === targetId);
                        setStatusText(`Editing "${targetBlock?.label || targetId}"…`);
                        const { summary: editSummary, html } = parseResponse(text);
                        onUpdateBlock(targetId, html);
                        summary = editSummary || `Edited "${targetBlock?.label || targetId}".`;
                        break;
                    }

                    case 'add-section': {
                        setStatusText('Adding new section…');
                        const { summary: addSummary, html } = parseResponse(text);
                        const block = createBlock(html);
                        onAddBlockSmart(block);
                        summary = addSummary || 'Added a new section.';
                        break;
                    }

                    case 'remove-section': {
                        const targetId = intent.targetBlockId!;
                        const targetBlock = currentBlocks.find((b) => b.id === targetId);
                        setStatusText(`Removing "${targetBlock?.label || targetId}"…`);
                        onRemoveBlock(targetId);
                        summary = `Removed "${targetBlock?.label || targetId}".`;
                        break;
                    }

                    case 'global-style-edit': {
                        setStatusText('Applying style changes across all sections…');
                        // For now, parse the single response — full multi-block iteration
                        // will be implemented in a later phase
                        const { summary: styleSummary, html } = parseResponse(text);
                        if (currentBlocks.length > 0) {
                            onUpdateBlock(currentBlocks[0].id, html);
                        }
                        summary = styleSummary || 'Applied global style changes.';
                        break;
                    }

                    case 'multi-section-edit': {
                        const targetIds = intent.targetBlockIds || [];
                        setStatusText(`Editing ${targetIds.length} sections…`);
                        // For now, parse the single response for the first target
                        const { summary: multiSummary, html } = parseResponse(text);
                        if (targetIds.length > 0) {
                            onUpdateBlock(targetIds[0], html);
                        }
                        summary = multiSummary || `Edited ${targetIds.length} sections.`;
                        break;
                    }

                    default:
                        summary = 'Modification applied.';
                }

                onVersionCreated(userPrompt);
                currentMessages = [...currentMessages, createAssistantMessage(summary)];
                onMessagesChange(currentMessages);
                setPhase('done');
            } catch (err) {
                if ((err as Error)?.name === 'AbortError') {
                    setIsLoading(false);
                    setPhase('idle');
                    setStatusText('');
                    return;
                }

                const errorText = err instanceof Error ? err.message : 'Unknown error';
                logger.error('modify: failed', err);
                onMessagesChange([...currentMessages, createAssistantMessage(`Error: ${errorText}`)]);
                setPhase('error');
            } finally {
                setIsLoading(false);
                setStatusText('');
                abortRef.current = null;
            }
        },
        [onMessagesChange, onAddBlockSmart, onUpdateBlock, onRemoveBlock, onVersionCreated, selectedBlockId],
    );

    return {
        isLoading,
        phase,
        statusText,
        modify,
        handleStop,
    } as const;
}
