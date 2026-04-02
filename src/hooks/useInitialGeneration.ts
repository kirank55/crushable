/**
 * useInitialGeneration — handles first-time full-page generation.
 *
 * Extracted from useChatGeneration.ts (the former generateFullPage logic).
 * Owns its own phase, progress, and status state.
 * Calls /api/generate with explicit modes (plan, new).
 */

import { useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Block, Message } from '@/types';
import { getApiKey, getModel } from '@/lib/storage';
import { createBlock, buildBlockLabel, setRootSectionIdentifiers } from '@/lib/blocks';
import { parsePlanResponse, parseResponse } from '@/lib/shared/prompt-utils';
import { logger } from '@/lib/logger';
import { generateFullHTML } from '@/lib/export';
import { validateGeneratedHtml, autoFixIssues } from '@/lib/validate';
import { usePageStateContext } from '@/context/PageStateContext';

// ─── Public types ────────────────────────────────────────────────

export type GenerationPhase = 'idle' | 'planning' | 'building' | 'resolving' | 'modifying' | 'done' | 'error';

export interface SectionProgress {
    id: string;
    label: string;
    status: 'pending' | 'generating' | 'done' | 'error';
}

/** Sentinel ID used during the planning phase before real sections exist. */
export const PLANNING_SECTION_ID = '__planning__';

// ─── Constants ───────────────────────────────────────────────────

const MAX_CONCURRENT_SECTIONS = 3;

/** Keyword → section id mapping (checked in order). */
const SECTION_ID_KEYWORDS: ReadonlyArray<[RegExp, string]> = [
    [/\b(nav|navbar|navigation|header)\b/, 'home'],
    [/\bhero\b/, 'hero'],
    [/\bfeature/, 'features'],
    [/\b(pricing|offer)\b/, 'pricing'],
    [/\btestimonial/, 'testimonials'],
    [/\bfaq\b/, 'faq'],
    [/\bfooter\b/, 'footer'],
    [/\b(how it works|step|process)/, 'how-it-works'],
    [/\bcta\b/, 'cta'],
];

// ─── Pure helpers ────────────────────────────────────────────────

function buildSectionId(title: string, index: number): string {
    const lower = title.toLowerCase();
    for (const [pattern, id] of SECTION_ID_KEYWORDS) {
        if (pattern.test(lower)) return id;
    }
    const slug = lower.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug || `section-${index + 1}`;
}

function buildSectionMap(sections: string[]): string {
    return sections.map((s, i) => `${i + 1}. ${s}`).join('\n');
}

function createAssistantMessage(
    content: string,
    extra?: { plan?: string[]; sectionProgress?: Message['sectionProgress'] },
): Message {
    return {
        id: uuidv4(),
        role: 'assistant',
        content,
        timestamp: Date.now(),
        ...extra,
    };
}

function createUserMessage(content: string): Message {
    return { id: uuidv4(), role: 'user', content, timestamp: Date.now() };
}

/** Deduplicate section IDs by appending a numeric suffix on collision. */
function deduplicateIds(sections: string[]): Array<{ title: string; sectionId: string }> {
    const usedIds = new Set<string>();

    return sections.map((title, index) => {
        const baseId = buildSectionId(title, index);
        let sectionId = baseId;
        let suffix = 2;

        while (usedIds.has(sectionId)) {
            sectionId = `${baseId}-${suffix}`;
            suffix++;
        }

        usedIds.add(sectionId);
        return { title, sectionId };
    });
}

// ─── Semaphore ───────────────────────────────────────────────────

interface Semaphore {
    acquire(): Promise<void>;
    release(): void;
}

function createSemaphore(maxConcurrency: number): Semaphore {
    let running = 0;
    const queue: Array<() => void> = [];

    return {
        acquire() {
            return new Promise<void>((resolve) => {
                if (running < maxConcurrency) {
                    running++;
                    resolve();
                } else {
                    queue.push(resolve);
                }
            });
        },
        release() {
            running--;
            const next = queue.shift();
            if (next) {
                running++;
                next();
            }
        },
    };
}

// ─── API helper ──────────────────────────────────────────────────

/** POST to `/api/generate` and return the full streamed response text. */
async function fetchGeneration(
    payload: Record<string, unknown>,
    signal?: AbortSignal,
): Promise<{ text: string; resolvedMode?: string }> {
    const mode = payload.mode ?? 'unknown';
    const startTime = Date.now();
    logger.info(`fetchGeneration: POST /api/generate (mode: ${mode})`);

    const res = await fetch('/api/generate', {
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
        throw new Error(body?.error ?? `Generation failed (${res.status})`);
    }

    const contentType = res.headers.get('Content-Type') || '';
    const resolvedMode = res.headers.get('X-Resolved-Mode') || undefined;

    if (contentType.includes('application/json')) {
        const json = await res.json();
        logger.info(`fetchGeneration: JSON response (mode: ${json.mode}) after ${Date.now() - startTime}ms`);
        return { text: JSON.stringify(json), resolvedMode: json.mode };
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response stream');

    logger.info(`fetchGeneration: streaming (mode: ${mode}) after ${Date.now() - startTime}ms`);

    const decoder = new TextDecoder();
    let text = '';

    for (; ;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
    }

    logger.info(`fetchGeneration: done (mode: ${mode}) in ${Date.now() - startTime}ms`);
    return { text, resolvedMode };
}

// ─── Hook ────────────────────────────────────────────────────────

export function useInitialGeneration() {
    const {
        savedMessages: messages,
        setSavedMessages: onMessagesChange,
        replaceAllBlocks: onReplaceAllBlocks,
        createVersionSnapshot: onVersionCreated,
        projectName,
        handleRename,
    } = usePageStateContext();

    const [isLoading, setIsLoading] = useState(false);
    const [phase, setPhase] = useState<GenerationPhase>('idle');
    const [sectionProgress, setSectionProgress] = useState<SectionProgress[]>([]);
    const [statusText, setStatusText] = useState('');
    const abortRef = useRef<AbortController | null>(null);

    const messagesRef = useRef(messages);
    messagesRef.current = messages;

    // ── Progress helpers ──────────────────────────────────────────

    const updateSectionStatus = useCallback(
        (sectionId: string, status: SectionProgress['status']) => {
            setSectionProgress((prev) =>
                prev.map((p) => (p.id === sectionId ? { ...p, status } : p)),
            );
        },
        [],
    );

    const resetState = useCallback(() => {
        setIsLoading(false);
        setPhase('idle');
        setStatusText('');
        setSectionProgress([]);
    }, []);

    // ── Stop ──────────────────────────────────────────────────────

    const handleStop = useCallback(() => {
        abortRef.current?.abort();
        resetState();
    }, [resetState]);

    // ── Full page generation ──────────────────────────────────────


    const generateFullPage = useCallback(
        async (userPrompt: string, skipAppend = false) => {
            abortRef.current = new AbortController();
            const { signal } = abortRef.current;

            // 1. Append user message (unless skip requested, e.g. auto-start)
            let currentMessages = messagesRef.current;
            if (!skipAppend) {
                currentMessages = [...currentMessages, createUserMessage(userPrompt)];
                onMessagesChange(currentMessages);
            }

            // 2. Start planning phase
            setIsLoading(true);
            setPhase('planning');
            setStatusText('Planning your page sectionsâ€¦');
            setSectionProgress([
                { id: PLANNING_SECTION_ID, label: 'Planning sectionsâ€¦', status: 'generating' },
            ]);

            try {
                // 3. Request section plan
                logger.info('generateFullPage: requesting section plan');
                const { text: planRaw } = await fetchGeneration({ prompt: userPrompt, mode: 'plan' }, signal);
                const { brandName, sections } = parsePlanResponse(planRaw);
                logger.info('generateFullPage: plan received', { brandName, count: sections.length, sections });

                // Rename project immediately from the API-generated brand name
                if (brandName && projectName === 'Untitled Project') {
                    logger.info('generateFullPage: auto-naming project from plan', { brandName });
                    handleRename(brandName);
                }

                const sectionMap = buildSectionMap(sections);
                const blueprints = deduplicateIds(sections);

                // 4. Transition to building phase
                setSectionProgress(
                    blueprints.map((b) => ({ id: b.sectionId, label: b.title, status: 'pending' as const })),
                );
                setPhase('building');
                setStatusText(`Building ${sections.length} sections…`);

                // 5. Generate each section concurrently (bounded by semaphore)
                const generatedBlocks: Array<Block | null> = new Array(blueprints.length).fill(null);
                const semaphore = createSemaphore(MAX_CONCURRENT_SECTIONS);

                // Progressive preview: show the preview as soon as 2 consecutive leading blocks are done.
                const PREVIEW_THRESHOLD = 2;
                let previewFlushedCount = 0;

                const flushPreviewIfReady = () => {
                    // Walk from index 0 and count how many leading slots are filled
                    let readyCount = 0;
                    while (readyCount < generatedBlocks.length && generatedBlocks[readyCount] !== null) {
                        readyCount++;
                    }
                    // Only push a new preview when we cross the threshold and have more blocks than before
                    if (readyCount >= PREVIEW_THRESHOLD && readyCount > previewFlushedCount) {
                        previewFlushedCount = readyCount;
                        const previewBlocks = generatedBlocks.slice(0, readyCount).filter((b): b is Block => b !== null);
                        logger.info(`generateFullPage: preview flush â€” ${previewBlocks.length} blocks`);
                        onReplaceAllBlocks(previewBlocks);
                    }
                };

                await Promise.all(
                    blueprints.map((blueprint, index) =>
                        (async () => {
                            await semaphore.acquire();
                            try {
                                updateSectionStatus(blueprint.sectionId, 'generating');

                                const sectionPrompt = [
                                    `Create a "${blueprint.title}" section for a landing page. This is section ${index + 1} of ${sections.length}.`,
                                    `Use id="${blueprint.sectionId}" and data-block-id="${blueprint.sectionId}" on the root <section>. Do not reuse ids from previous sections.`,
                                    `Page section map:\n${sectionMap}`,
                                ].join('\n\n');

                                const { text: raw } = await fetchGeneration({ prompt: sectionPrompt, mode: 'new' }, signal);
                                const { html } = parseResponse(raw);
                                const finalHtml = setRootSectionIdentifiers(html, blueprint.sectionId);

                                generatedBlocks[index] = createBlock(finalHtml, buildBlockLabel(blueprint.sectionId));
                                updateSectionStatus(blueprint.sectionId, 'done');
                                logger.info(`generateFullPage: "${blueprint.title}" done`);
                                flushPreviewIfReady();
                            } catch (err) {
                                if (signal.aborted) throw err;
                                updateSectionStatus(blueprint.sectionId, 'error');
                                logger.error(`generateFullPage: "${blueprint.title}" failed`, err);
                                flushPreviewIfReady();
                            } finally {
                                semaphore.release();
                            }
                        })(),
                    ),
                );

                // 6. Collect final results
                const validBlocks = generatedBlocks.filter((b): b is Block => b !== null);
                logger.info('generateFullPage: complete', { count: validBlocks.length });

                // 7. Run validation + auto-fix silently, then commit the final corrected version
                let committedBlocks = validBlocks;
                let validationNote = '';
                try {
                    const fullHtml = generateFullHTML(validBlocks);
                    const issues = validateGeneratedHtml(fullHtml);
                    logger.info('generateFullPage: validation', { issueCount: issues.length });

                    if (issues.length > 0) {
                        const { blocks: fixedBlocks, applied } = autoFixIssues(validBlocks, issues);
                        if (applied.length > 0) {
                            committedBlocks = fixedBlocks;
                            validationNote = ` Auto-fixed ${applied.length} issue${applied.length !== 1 ? 's' : ''}: ${applied.slice(0, 3).join(' ')}`;
                            logger.info('generateFullPage: auto-fixed', { applied });
                        }
                    }
                } catch (valErr) {
                    logger.error('generateFullPage: validation failed (non-fatal)', valErr);
                }

                onReplaceAllBlocks(committedBlocks);
                onVersionCreated(userPrompt);

                // Capture final progress state for the persisted message
                const finalProgress = blueprints.map((b) => {
                    const found = generatedBlocks[blueprints.indexOf(b)];
                    return {
                        id: b.sectionId,
                        label: b.title,
                        status: (found ? 'done' : 'error') as 'done' | 'error',
                    };
                });

                const summary = `âœ“ Built ${validBlocks.length} section${validBlocks.length !== 1 ? 's' : ''} for your page.${validationNote} You can ask me to refine any section or add new ones.`;
                onMessagesChange([
                    ...currentMessages,
                    createAssistantMessage(summary, {
                        plan: sections,
                        sectionProgress: finalProgress,
                    }),
                ]);
                setPhase('done');
                setStatusText('');
                // Clear ephemeral progress â€” data is now persisted in the message
                setSectionProgress([]);
            } catch (err) {
                if ((err as Error)?.name === 'AbortError') {
                    resetState();
                    return;
                }

                const errorText = err instanceof Error ? err.message : 'Unknown error';
                logger.error('generateFullPage: failed', err);
                onMessagesChange([...currentMessages, createAssistantMessage(`Error: ${errorText}`)]);
                setPhase('error');
                setStatusText('');
            } finally {
                setIsLoading(false);
                abortRef.current = null;
            }
        },
        [onMessagesChange, onReplaceAllBlocks, onVersionCreated, updateSectionStatus, resetState],
    );

    return {
        isLoading,
        phase,
        sectionProgress,
        statusText,
        generateFullPage,
        handleStop,
    } as const;
}
