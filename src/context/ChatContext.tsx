'use client';

import { createContext, useContext, useState, useCallback } from 'react';
import { usePageStateContext } from '@/context/PageStateContext';
import { useChatGeneration } from '@/hooks/useChatGeneration';
import { useAutoStartGeneration } from '@/hooks/useAutoStartGeneration';
import type { GenerationPhase, SectionProgress } from '@/hooks/useChatGeneration';
import type { Message } from '@/types';

// ─── Context shape ──────────────────────────────────────────────

export interface ChatContextValue {
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  phase: GenerationPhase;
  sectionProgress: SectionProgress[];
  statusText: string;
  handleSend: () => void;
  handleStop: () => void;
  hasBlocks: boolean;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within a <ChatProvider>');
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { blocks, savedMessages: messages, setSavedMessages: onMessagesChange } =
    usePageStateContext();

  const [input, setInput] = useState('');

  const {
    isLoading,
    phase,
    sectionProgress,
    statusText,
    generateFullPage,
    generate,
    handleStop,
  } = useChatGeneration();

  useAutoStartGeneration({
    blocks,
    messages,
    phase,
    isLoading,
    onMessagesChange,
    generateFullPage,
  });

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setInput('');

    if (blocks.length === 0) {
      // First call — always generate a full page
      generateFullPage(trimmed);
    } else {
      // Subsequent calls — backend decides mode via inferModeFromLLM
      generate(trimmed);
    }
  }, [input, isLoading, blocks.length, generateFullPage, generate]);

  const value: ChatContextValue = {
    messages,
    input,
    setInput,
    isLoading,
    phase,
    sectionProgress,
    statusText,
    handleSend,
    handleStop,
    hasBlocks: blocks.length > 0,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
