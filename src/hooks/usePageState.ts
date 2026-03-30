'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Block, Project, Version, Message } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { duplicateExistingBlock as duplicateBlockData } from '@/lib/blocks';
import { logger } from '@/lib/logger';
import { useProjectStorage } from './useProjectStorage';

// ─── Constants ──────────────────────────────────────────────────

const MAX_UNDO_STACK = 20;
const AUTO_SAVE_DELAY_MS = 2000;
const DEFAULT_PROJECT_NAME = 'Untitled Project';

// ─── Hook ───────────────────────────────────────────────────────

export function usePageState(projectId?: string) {
  const storage = useProjectStorage(projectId);

  // ── Editing state ─────────────────────────────────────────────

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [projectName, setProjectName] = useState(DEFAULT_PROJECT_NAME);
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState<number | null>(null);
  const [undoStack, setUndoStack] = useState<Block[][]>([]);
  const [savedMessages, setSavedMessages] = useState<Message[]>([]);

  // ── Refs ───────────────────────────────────────────────────────

  const blocksRef = useRef<Block[]>([]);
  const latestBlocksRef = useRef<Block[]>([]);
  const isViewingOldVersion = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── Hydrate from storage on load ──────────────────────────────

  useEffect(() => {
    if (!storage.isReady) return;

    const data = storage.loadedData;
    if (data) {
      setBlocks(data.blocks);
      setProjectName(data.name);
      setVersions(data.versions);
      setSavedMessages(data.messages);
      latestBlocksRef.current = [...data.blocks];
    } else {
      setBlocks([]);
      setProjectName(DEFAULT_PROJECT_NAME);
      setVersions([]);
      setSavedMessages([]);
      latestBlocksRef.current = [];
    }

    isViewingOldVersion.current = false;
    setSelectedBlockId(null);
    setUndoStack([]);
    setIsDirty(false);
    setCurrentVersionIndex(null);
  }, [storage.isReady, storage.loadedData]);

  // ── Keep blocksRef in sync ────────────────────────────────────

  useEffect(() => {
    blocksRef.current = blocks;
    if (!isViewingOldVersion.current) {
      latestBlocksRef.current = blocks;
    }
  }, [blocks]);

  // ── Auto-save (debounced, timer stays here close to the state) ─

  const handleSave = useCallback(() => {
    const blocksToSave = isViewingOldVersion.current ? latestBlocksRef.current : blocks;
    const saved = storage.save({
      name: projectName,
      blocks: blocksToSave,
      versions,
      messages: savedMessages,
    });
    if (saved) setIsDirty(false);
    else setIsDirty(false); // empty project — nothing to save, clear dirty
  }, [storage, projectName, blocks, versions, savedMessages]);

  useEffect(() => {
    if (!isDirty || !storage.projectId) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      handleSave();
    }, AUTO_SAVE_DELAY_MS);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, blocks, storage.projectId]);

  // ── Undo ──────────────────────────────────────────────────────

  const pushUndo = useCallback((snapshot: Block[]) => {
    setUndoStack((prev) => {
      const next = [...prev, snapshot];
      if (next.length > MAX_UNDO_STACK) next.shift();
      return next;
    });
  }, []);

  const undo = useCallback((): string | null => {
    let undoneLabel: string | null = null;
    isViewingOldVersion.current = false;
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const restored = next.pop()!;
      const currentBlocks = blocksRef.current;
      if (currentBlocks.length > restored.length) {
        const removed = currentBlocks.filter((b) => !restored.find((r) => r.id === b.id));
        undoneLabel = removed.length > 0
          ? `Removed "${removed[0].label}"`
          : 'Reverted last change';
      } else if (currentBlocks.length < restored.length) {
        undoneLabel = 'Restored removed section';
      } else {
        undoneLabel = 'Reverted last edit';
      }
      setBlocks(restored);
      setIsDirty(true);
      return next;
    });
    return undoneLabel;
  }, []);

  // ── Block helpers (shared pattern: snapshot → mutate → dirty) ─

  const markEdited = useCallback(() => {
    isViewingOldVersion.current = false;
    setCurrentVersionIndex(null);
    setIsDirty(true);
  }, []);

  const addBlock = useCallback((block: Block) => {
    logger.action('addBlock', { blockId: block.id });
    setBlocks((prev) => {
      pushUndo([...prev]);
      return [...prev, block];
    });
    markEdited();
  }, [pushUndo, markEdited]);

  const addBlockSmart = useCallback((block: Block) => {
    logger.action('addBlockSmart', { blockId: block.id });
    setBlocks((prev) => {
      pushUndo([...prev]);
      const label = (block.label || '').toLowerCase();
      const isNav = label.includes('nav') || label.includes('header');
      const isFooter = label.includes('footer');

      if (isNav) return [block, ...prev];
      if (isFooter) {
        const existingFooterIndex = prev.findIndex((b) => (b.label || '').toLowerCase().includes('footer'));
        if (existingFooterIndex !== -1) {
          const next = [...prev];
          next[existingFooterIndex] = block;
          return next;
        }
        return [...prev, block];
      }

      const footerIndex = prev.findIndex((b) => (b.label || '').toLowerCase().includes('footer'));
      if (footerIndex !== -1) {
        const next = [...prev];
        next.splice(footerIndex, 0, block);
        return next;
      }
      return [...prev, block];
    });
    markEdited();
  }, [pushUndo, markEdited]);

  const updateBlock = useCallback((id: string, html: string) => {
    logger.action('updateBlock', { blockId: id });
    setBlocks((prev) => {
      pushUndo([...prev]);
      return prev.map((b) => (b.id === id ? { ...b, html } : b));
    });
    markEdited();
  }, [pushUndo, markEdited]);

  const insertBlockAfter = useCallback((afterBlockId: string | null | undefined, block: Block) => {
    logger.action('insertBlockAfter', { afterBlockId: afterBlockId || null, blockId: block.id });
    setBlocks((prev) => {
      pushUndo([...prev]);
      if (!afterBlockId) return [...prev, block];
      const index = prev.findIndex((entry) => entry.id === afterBlockId);
      if (index === -1) return [...prev, block];
      const next = [...prev];
      next.splice(index + 1, 0, block);
      return next;
    });
    markEdited();
  }, [pushUndo, markEdited]);

  const duplicateBlock = useCallback((id: string) => {
    logger.action('duplicateBlock', { blockId: id });
    let duplicatedId: string | null = null;
    setBlocks((prev) => {
      const index = prev.findIndex((b) => b.id === id);
      if (index === -1) return prev;
      pushUndo([...prev]);
      const nextBlock = duplicateBlockData(prev[index], prev.map((b) => b.id));
      duplicatedId = nextBlock.id;
      const next = [...prev];
      next.splice(index + 1, 0, nextBlock);
      return next;
    });
    if (duplicatedId) setSelectedBlockId(duplicatedId);
    markEdited();
  }, [pushUndo, markEdited]);

  const replaceAllBlocks = useCallback((newBlocks: Block[]) => {
    logger.action('replaceAllBlocks', { count: newBlocks.length });
    setBlocks((prev) => {
      pushUndo([...prev]);
      return newBlocks;
    });
    latestBlocksRef.current = newBlocks;
    markEdited();
  }, [pushUndo, markEdited]);

  const toggleBlockVisibility = useCallback((id: string, visible: boolean) => {
    logger.action('toggleBlockVisibility', { blockId: id, visible });
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, visible } : b)));
    setIsDirty(true);
  }, []);

  const removeBlock = useCallback((id: string) => {
    logger.action('removeBlock', { blockId: id });
    setBlocks((prev) => {
      pushUndo([...prev]);
      return prev.filter((b) => b.id !== id);
    });
    setSelectedBlockId((prev) => (prev === id ? null : prev));
    markEdited();
  }, [pushUndo, markEdited]);

  const selectBlock = useCallback((id: string | null) => {
    setSelectedBlockId(id);
  }, []);

  const reorderBlocks = useCallback((newBlocks: Block[]) => {
    logger.action('reorderBlocks');
    pushUndo([...blocksRef.current]);
    setBlocks(newBlocks);
    markEdited();
  }, [pushUndo, markEdited]);

  // ── Versions ──────────────────────────────────────────────────

  const createVersionSnapshot = useCallback((prompt?: string) => {
    const currentBlocks = latestBlocksRef.current;
    setVersions((prev) => {
      const versionNumber = prev.length + 1;
      const newVersion: Version = {
        id: uuidv4(),
        label: `Version ${versionNumber}`,
        blocks: currentBlocks.map((b) => ({ ...b })),
        timestamp: Date.now(),
        prompt,
      };
      logger.action('createVersionSnapshot', { versionNumber, blockCount: currentBlocks.length });
      setCurrentVersionIndex(versionNumber - 1);
      return [...prev, newVersion];
    });
    setIsDirty(true);
  }, []);

  const loadVersion = useCallback((version: Version, index?: number) => {
    logger.action('loadVersion', { label: version.label, index });
    isViewingOldVersion.current = true;
    if (index !== undefined) setCurrentVersionIndex(index);
    setBlocks(version.blocks.map((b) => ({ ...b })));
    setSelectedBlockId(null);
  }, []);

  const restoreCurrentBlocks = useCallback(() => {
    const latest = latestBlocksRef.current;
    logger.action('restoreCurrentBlocks', { blockCount: latest.length });
    isViewingOldVersion.current = false;
    setBlocks(latest.map((b) => ({ ...b })));
    setCurrentVersionIndex(null);
    setSelectedBlockId(null);
  }, []);

  // ── Project-level actions ─────────────────────────────────────

  const handleRename = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === projectName) return;
    logger.action('handleRename', { name: trimmed });
    setProjectName(trimmed);
    setIsDirty(true);
  }, [projectName]);

  const handleLoad = useCallback((project: Project) => {
    const data = storage.loadExternal(project);
    isViewingOldVersion.current = false;
    setBlocks(data.blocks);
    latestBlocksRef.current = [...data.blocks];
    setProjectName(data.name);
    setVersions(data.versions);
    setSavedMessages(data.messages);
    setCurrentVersionIndex(null);
    setSelectedBlockId(null);
    setUndoStack([]);
    setIsDirty(false);
  }, [storage]);

  const persistMessages = useCallback((messages: Message[]) => {
    setSavedMessages(messages);
    const blocksToSave = isViewingOldVersion.current ? latestBlocksRef.current : blocksRef.current;
    storage.persistMessages(messages, {
      name: projectName,
      blocks: blocksToSave,
      versions,
    });
  }, [storage, projectName, versions]);

  // ── Public API (unchanged) ────────────────────────────────────

  return {
    blocks,
    selectedBlockId,
    currentProjectId: storage.projectId,
    currentVersionIndex,
    isDirty,
    isReady: storage.isReady,
    projectName,
    versions,
    canUndo: undoStack.length > 0,
    savedMessages,
    addBlock,
    addBlockSmart,
    updateBlock,
    insertBlockAfter,
    duplicateBlock,
    removeBlock,
    replaceAllBlocks,
    toggleBlockVisibility,
    selectBlock,
    reorderBlocks,
    createVersionSnapshot,
    loadVersion,
    restoreCurrentBlocks,
    handleSave,
    handleLoad,
    handleRename,
    undo,
    setSavedMessages: persistMessages,
  };
}
