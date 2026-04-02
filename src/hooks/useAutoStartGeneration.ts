import { useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Message } from '@/types';
import { logger } from '@/lib/logger';

interface UseAutoStartGenerationParams {
  blocks: unknown[];
  messages: Message[];
  phase: string;
  isLoading: boolean;
  onMessagesChange: (messages: Message[]) => void;
  generateFullPage: (prompt: string, skipAppend?: boolean) => void;
}

/**
 * Auto-starts generation when a project is opened from the homepage
 * with exactly one user message and no blocks yet.
 * Fires at most once per mount via a ref guard.
 */
export function useAutoStartGeneration({
  blocks,
  messages,
  phase,
  isLoading,
  onMessagesChange,
  generateFullPage,
}: UseAutoStartGenerationParams) {
  const hasAutoStartedRef = useRef(false);

  useEffect(() => {
    if (hasAutoStartedRef.current) return;

    const shouldAutoStart =
      blocks.length === 0 &&
      messages.length === 1 &&
      messages[0].role === 'user' &&
      phase === 'idle' &&
      !isLoading;

    if (!shouldAutoStart) return;

    hasAutoStartedRef.current = true;
    logger.info('useAutoStartGeneration: auto-starting from homepage brief');

    const welcomeMsg: Message = {
      id: uuidv4(),
      role: 'assistant',
      content:
        'Project created!\n\nGenerating your page…',
      timestamp: Date.now(),
    };

    onMessagesChange([...messages, welcomeMsg]);
    generateFullPage(messages[0].content, true);
  }, [blocks.length, messages, phase, isLoading, generateFullPage, onMessagesChange]);
}
