/**
 * useChatGeneration — thin router that delegates to the correct engine.
 *
 * - blocks.length === 0 → useInitialGeneration (plan → build sections)
 * - blocks.length > 0   → useModificationEngine (edit, add, remove, style)
 *
 * ChatInputArea / ChatContext only know about one "generate" function.
 * This router preserves that simple API while delegating internally.
 */

import { useCallback } from 'react';
import { usePageStateContext } from '@/context/PageStateContext';
import { useInitialGeneration } from './useInitialGeneration';
import { useModificationEngine } from './useModificationEngine';

// Re-export types that consumers depend on
export type { GenerationPhase, SectionProgress } from './useInitialGeneration';
export { PLANNING_SECTION_ID } from './useInitialGeneration';

export function useChatGeneration() {
    const { blocks } = usePageStateContext();
    const initialGen = useInitialGeneration();
    const modEngine = useModificationEngine();

    const generate = useCallback(
        async (userPrompt: string) => {
            if (blocks.length === 0) {
                // No content yet → use initial generation engine
                await initialGen.generateFullPage(userPrompt);
            } else {
                // Content exists → use modification engine
                await modEngine.modify(userPrompt);
            }
        },
        [blocks.length, initialGen, modEngine],
    );

    return {
        // Expose a unified interface so ChatInputArea doesn't care
        isLoading: initialGen.isLoading || modEngine.isLoading,
        phase: initialGen.phase !== 'idle' ? initialGen.phase : modEngine.phase,
        sectionProgress: initialGen.sectionProgress,
        statusText: initialGen.statusText || modEngine.statusText,
        generate,
        generateFullPage: initialGen.generateFullPage,
        handleStop: blocks.length === 0 ? initialGen.handleStop : modEngine.handleStop,
    } as const;
}
