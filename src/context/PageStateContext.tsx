'use client';

import { createContext, useContext } from 'react';
import { Block, Message, Version } from '@/types';

// ─── Context shape ──────────────────────────────────────────────

export interface PageStateContextValue {
  // State
  blocks: Block[];
  savedMessages: Message[];
  versions: Version[];
  isDirty: boolean;
  projectName: string;
  currentVersionIndex: number | null;

  // UI state
  versionsOpen: boolean;
  toggleVersions: () => void;
  closeVersions: () => void;

  // Actions — blocks
  addBlockSmart: (block: Block) => void;
  replaceAllBlocks: (blocks: Block[]) => void;

  // Actions — messages
  setSavedMessages: (messages: Message[]) => void;

  // Actions — versions
  createVersionSnapshot: (prompt?: string) => void;
  loadVersion: (version: Version, index?: number) => void;
  restoreCurrentBlocks: () => void;

  // Actions — project
  handleSave: () => void;
  handleRename: (name: string) => void;
}

const PageStateContext = createContext<PageStateContextValue | null>(null);

// ─── Hook ───────────────────────────────────────────────────────

export function usePageStateContext(): PageStateContextValue {
  const ctx = useContext(PageStateContext);
  if (!ctx) {
    throw new Error('usePageStateContext must be used within a <PageStateProvider>');
  }
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────

export const PageStateProvider = PageStateContext.Provider;
