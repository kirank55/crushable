'use client';

import { createContext, useContext } from 'react';
import { Block, Message, Version } from '@/types';
import type { DesignStyleId } from '@/lib/initial-generation/design-styles';

export type ViewMode = 'preview' | 'code' | 'console';

export interface PageStateContextValue {
  // State
  blocks: Block[];
  selectedBlockId: string | null;
  savedMessages: Message[];
  versions: Version[];
  isDirty: boolean;
  projectName: string;
  productDescription: string;
  designStyle?: DesignStyleId;
  currentVersionIndex: number | null;

  // UI state
  versionsOpen: boolean;
  toggleVersions: () => void;
  closeVersions: () => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  mobilePreview: boolean;
  setMobilePreview: (mobile: boolean) => void;

  // Actions — blocks
  addBlockSmart: (block: Block) => void;
  removeBlock: (id: string) => void;
  replaceAllBlocks: (blocks: Block[]) => void;
  updateBlock: (id: string, html: string) => void;

  // Actions — messages
  setSavedMessages: (messages: Message[]) => void;

  // Actions — versions
  createVersionSnapshot: (prompt?: string) => void;
  loadVersion: (version: Version, index?: number) => void;
  restoreCurrentBlocks: () => void;

  // Actions — project
  handleSave: () => void;
  handleRename: (name: string) => void;
  setProjectMetadata: (metadata: { productDescription?: string; designStyle?: DesignStyleId }) => void;
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
