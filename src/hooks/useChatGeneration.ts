import { useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Block, Message } from '@/types';
import { getApiKey, getModel } from '@/lib/storage';
import { createBlock, buildBlockLabel, setRootSectionIdentifiers } from '@/lib/blocks';
import { parsePlanResponse, parseResponse } from '@/lib/prompt';
import { logger } from '@/lib/logger';
import { usePageStateContext } from '@/context/PageStateContext';

// ─── Public types ────────────────────────────────────────────────

export type GenerationPhase = 'idle' | 'planning' | 'building' | 'done' | 'error';

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

// ─── Pure helpers (no React, easily testable) ────────────────────

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

function createAssistantMessage(content: string): Message {
  return { id: uuidv4(), role: 'assistant', content, timestamp: Date.now() };
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

  // Check if the response is JSON (plan mode, etc.) or streamed text
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

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }

  logger.info(`fetchGeneration: done (mode: ${mode}) in ${Date.now() - startTime}ms`);
  return { text, resolvedMode };
}

// ─── Hook ────────────────────────────────────────────────────────

export function useChatGeneration() {
  // Pull dependencies from context — no more prop drilling
  const {
    blocks,
    savedMessages: messages,
    setSavedMessages: onMessagesChange,
    replaceAllBlocks: onReplaceAllBlocks,
    createVersionSnapshot: onVersionCreated,
    addBlockSmart: onAddBlockSmart,
    updateBlock: onUpdateBlock,
  } = usePageStateContext();

  const [isLoading, setIsLoading] = useState(false);
  const [phase, setPhase] = useState<GenerationPhase>('idle');
  const [sectionProgress, setSectionProgress] = useState<SectionProgress[]>([]);
  const [statusText, setStatusText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // Keep a ref to the latest messages so callbacks never have a stale closure.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Keep a ref to current blocks for generate()
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

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
      setStatusText('Planning your page sections…');
      setSectionProgress([
        { id: PLANNING_SECTION_ID, label: 'Planning sections…', status: 'generating' },
      ]);

      try {
        // 3. Request section plan
        logger.info('generateFullPage: requesting section plan');
        const { text: planRaw } = await fetchGeneration({ prompt: userPrompt, mode: 'plan' }, signal);
        const sections = parsePlanResponse(planRaw);
        logger.info('generateFullPage: plan received', { count: sections.length, sections });

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
              } catch (err) {
                if (signal.aborted) throw err;
                updateSectionStatus(blueprint.sectionId, 'error');
                logger.error(`generateFullPage: "${blueprint.title}" failed`, err);
              } finally {
                semaphore.release();
              }
            })(),
          ),
        );

        // 6. Commit results
        const validBlocks = generatedBlocks.filter((b): b is Block => b !== null);
        logger.info('generateFullPage: complete', { count: validBlocks.length });

        onReplaceAllBlocks(validBlocks);
        onVersionCreated(userPrompt);

        const summary = `✓ Built ${validBlocks.length} section${validBlocks.length !== 1 ? 's' : ''} for your page. You can ask me to refine any section or add new ones.`;
        onMessagesChange([...currentMessages, createAssistantMessage(summary)]);
        setPhase('done');
        setStatusText('');
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

  // ── Unified generate — backend decides mode via inferModeFromLLM ──

  const generate = useCallback(
    async (userPrompt: string) => {
      abortRef.current = new AbortController();
      const { signal } = abortRef.current;

      let currentMessages = [...messagesRef.current, createUserMessage(userPrompt)];
      onMessagesChange(currentMessages);

      setIsLoading(true);
      setPhase('building');
      setStatusText('Generating…');

      try {
        // Send prompt without mode — backend will infer via inferModeFromLLM
        // Include hasBlocks so the classifier has context
        const { text: raw, resolvedMode } = await fetchGeneration(
          { prompt: userPrompt, hasBlocks: blocksRef.current.length > 0 },
          signal,
        );

        logger.info('generate: backend resolved mode', { resolvedMode });

        // Handle response based on the mode the backend resolved
        if (resolvedMode === 'plan') {
          // Backend returned a plan JSON — this shouldn't normally happen when
          // blocks exist, but handle it gracefully by treating it like add-section
          const planData = JSON.parse(raw);
          const sections = planData.sections || parsePlanResponse(raw);
          const content = `Plan: ${sections.join(', ')}`;
          currentMessages = [...currentMessages, createAssistantMessage(content)];
          onMessagesChange(currentMessages);
        } else {
          // Streaming HTML response (new, edit, add-section, global-style-edit, etc.)
          const { summary, html } = parseResponse(raw);

          if (resolvedMode === 'edit') {
            // For edit mode, find the target block and update it
            // The backend should have processed the prompt to identify the block
            // For now, create a new block — edit targeting will refine later
            const block = createBlock(html);
            onAddBlockSmart(block);
          } else {
            // add-section, new, or default — add the block
            const block = createBlock(html);
            onAddBlockSmart(block);
          }

          const content = summary || 'Section generated.';
          currentMessages = [...currentMessages, createAssistantMessage(content)];
          onMessagesChange(currentMessages);
        }

        setPhase('done');
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          resetState();
          return;
        }

        const errorText = err instanceof Error ? err.message : 'Unknown error';
        logger.error('generate: failed', err);
        onMessagesChange([...currentMessages, createAssistantMessage(`Error: ${errorText}`)]);
        setPhase('error');
      } finally {
        setIsLoading(false);
        setStatusText('');
        abortRef.current = null;
      }
    },
    [onMessagesChange, onAddBlockSmart, onUpdateBlock, resetState],
  );

  return {
    isLoading,
    phase,
    sectionProgress,
    statusText,
    generateFullPage,
    generate,
    handleStop,
  } as const;
}
