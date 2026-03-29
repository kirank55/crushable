'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Block, Project, Version, Message } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { duplicateExistingBlock as duplicateBlockData } from '@/lib/blocks';
import {
  saveProject,
  loadProject,
  getCurrentProjectId as getStoredCurrentProjectId,
  setCurrentProjectId as setStoredCurrentProjectId,
} from '@/lib/storage';
import { logger } from '@/lib/logger';

const MAX_UNDO_STACK = 20;
const DEFAULT_PROJECT_NAME = 'Untitled Project';

// It returns `true` ONLY IF the user has added blocks, chatted, created versions, OR renamed the project from "Untitled Project". Otherwise, it returns false (which prevents saving empty junk to local storage).
function hasMeaningfulContent({
  blocks,
  messages,
  projectName,
  versions,
}: {
  blocks: Block[];
  messages: Message[];
  projectName: string;
  versions: Version[];
}): boolean {
  return (
    blocks.length > 0 ||
    messages.length > 0 ||
    versions.length > 0 ||
    projectName.trim() !== DEFAULT_PROJECT_NAME
  );
}

export function usePageState(projectId?: string) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [currentProjectId, setProjectId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [projectName, setProjectName] = useState(DEFAULT_PROJECT_NAME);
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState<number | null>(null);
  const [undoStack, setUndoStack] = useState<Block[][]>([]);
  const [savedMessages, setSavedMessages] = useState<Message[]>([]);
  const [isReady, setIsReady] = useState(false);

  // A mutable React reference to hold our auto-save timer ID so we can cancel it.
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // A mutable React reference to hold the current blocks for the auto-save timer.
  const blocksRef = useRef<Block[]>([]);
  // A mutable React reference to hold the latest blocks (when not viewing an old version).
  const latestBlocksRef = useRef<Block[]>([]);
  // A mutable React reference to track if we are viewing an old version.
  const isViewingOldVersion = useRef(false);

  // Load project on mount
  useEffect(() => {
    setIsReady(false);

    // If a real ID is passed in the URL (URL: /project/1234)
    if (projectId && projectId !== 'new') {
      const project = loadProject(projectId);
      if (project) {
        setBlocks(project.blocks);
        setProjectId(project.id);
        setProjectName(project.name);
        setVersions(project.versions || []);
        setSavedMessages(project.messages || []);
        setStoredCurrentProjectId(project.id);
        latestBlocksRef.current = [...project.blocks];
        isViewingOldVersion.current = false;
        logger.action('Loaded project by ID', { id: project.id, name: project.name });
      }
    } else if (projectId === 'new') {
      // If the URL says /project/new...
      // Wipe all states clean (empty arrays) so we have a blank slate.
      const id = uuidv4();
      setBlocks([]);
      setProjectId(id);
      setProjectName(DEFAULT_PROJECT_NAME);
      setVersions([]);
      setSavedMessages([]);
      setUndoStack([]);
      setIsDirty(false);
      setStoredCurrentProjectId(null);
      latestBlocksRef.current = [];
      isViewingOldVersion.current = false;
      logger.action('Created new project via route', { id });
    } else {
      // Otherwise, try to load the last project the user worked on.
      const lastId = getStoredCurrentProjectId();
      if (lastId) {
        const project = loadProject(lastId);
        if (project) {
          setBlocks(project.blocks);
          setProjectId(project.id);
          setProjectName(project.name);
          setVersions(project.versions || []);
          setSavedMessages(project.messages || []);
          setStoredCurrentProjectId(project.id);
          latestBlocksRef.current = [...project.blocks];
          isViewingOldVersion.current = false;
          logger.action('Loaded last project', { id: project.id, name: project.name });
        }
      }
    }

    setIsReady(true);
  }, [projectId]);

  // Auto-save 2s after any dirty change
  useEffect(() => {
    if (!isDirty || !currentProjectId) return;
    // Cancel any existing save-timers (this is "debouncing", preventing spam saves if the user types quickly).
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      handleSave();
    }, 2000);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, blocks, currentProjectId]);

  // Keep blocksRef in sync
  useEffect(() => {
    blocksRef.current = blocks;
    if (!isViewingOldVersion.current) {
      latestBlocksRef.current = blocks;
    }
  }, [blocks]);

  const pushUndo = useCallback((snapshot: Block[]) => {
    setUndoStack((prev) => {
      // 1. Add the snapshot to the stack
      const next = [...prev, snapshot];
      // 2. If the stack is too full, remove the oldest snapshot
      if (next.length > MAX_UNDO_STACK) next.shift();
      return next;
    });
  }, []);

  const addBlock = useCallback((block: Block) => {
    logger.action('addBlock', { blockId: block.id });
    isViewingOldVersion.current = false;
    setBlocks((prev) => {
      // Take a snapshot of the current blocks BEFORE adding the new one
      pushUndo([...prev]);
      // Add the new block to the end of the array
      return [...prev, block];
    });
    setCurrentVersionIndex(null);
    setIsDirty(true);
  }, [pushUndo]);

  const addBlockSmart = useCallback((block: Block) => {
    logger.action('addBlockSmart', { blockId: block.id });
    isViewingOldVersion.current = false;
    setBlocks((prev) => {
      // Take a snapshot of the current blocks BEFORE adding the new one
      pushUndo([...prev]);
      // Normalize the new block's label and HTML to lowercase for easier matching
      const label = (block.label || '').toLowerCase();
      // const html = (block.html || '').toLowerCase();
      // Check if the block is a navigation or header block
      const isNav = label.includes('nav') || label.includes('header');
      // Check if the block is a footer block
      const isFooter = label.includes('footer');

      // If it's a nav/header block, add it to the beginning of the array
      if (isNav) return [block, ...prev];
      // If it's a footer block, replace the existing footer or add it to the end
      if (isFooter) {
        const existingFooterIndex = prev.findIndex((b) => (b.label || '').toLowerCase().includes('footer'));
        if (existingFooterIndex !== -1) {
          const next = [...prev];
          next[existingFooterIndex] = block;
          return next;
        }
        return [...prev, block];
      }

      // Find the index of the first footer block
      const footerIndex = prev.findIndex((b) => (b.label || '').toLowerCase().includes('footer'));
      // If a footer block is found, insert the new block before it
      if (footerIndex !== -1) {
        const next = [...prev];
        next.splice(footerIndex, 0, block);
        return next;
      }
      // Otherwise, add the new block to the end of the array
      return [...prev, block];
    });
    setCurrentVersionIndex(null);
    setIsDirty(true);
  }, [pushUndo]);

  const updateBlock = useCallback((id: string, html: string) => {
    logger.action('updateBlock', { blockId: id });
    // Mark that we are no longer viewing an old version
    isViewingOldVersion.current = false;
    // Update the blocks state
    setBlocks((prev) => {
      // Take a snapshot of the current blocks BEFORE updating
      pushUndo([...prev]);
      // Map over the blocks and update the specific block by ID
      return prev.map((b) => (b.id === id ? { ...b, html } : b));
    });
    setCurrentVersionIndex(null);
    setIsDirty(true);
  }, [pushUndo]);

  const insertBlockAfter = useCallback((afterBlockId: string | null | undefined, block: Block) => {
    logger.action('insertBlockAfter', { afterBlockId: afterBlockId || null, blockId: block.id });
    isViewingOldVersion.current = false;
    setBlocks((prev) => {
      pushUndo([...prev]);
      // If no afterBlockId is provided, add the block to the end
      if (!afterBlockId) return [...prev, block];
      // Find the index of the block to insert after
      const index = prev.findIndex((entry) => entry.id === afterBlockId);
      // If the block is not found, add it to the end
      if (index === -1) return [...prev, block];
      // Create a copy of the blocks array
      const next = [...prev];
      next.splice(index + 1, 0, block);
      return next;
    });
    setCurrentVersionIndex(null);
    setIsDirty(true);
  }, [pushUndo]);

  const duplicateBlock = useCallback((id: string) => {
    logger.action('duplicateBlock', { blockId: id });
    isViewingOldVersion.current = false;
    let duplicatedId: string | null = null;
    setBlocks((prev) => {
      // Find the index of the block to duplicate
      const index = prev.findIndex((b) => b.id === id);
      // If the block is not found, return the previous state
      if (index === -1) return prev;
      // Take a snapshot of the current blocks BEFORE duplicating
      pushUndo([...prev]);
      // Create a duplicate of the block
      const nextBlock = duplicateBlockData(prev[index], prev.map((b) => b.id));
      duplicatedId = nextBlock.id;
      // Create a copy of the blocks array
      const next = [...prev];
      // Insert the duplicated block after the original block
      next.splice(index + 1, 0, nextBlock);
      return next;
    });
    if (duplicatedId) setSelectedBlockId(duplicatedId);
    setCurrentVersionIndex(null);
    setIsDirty(true);
  }, [pushUndo]);

  const replaceAllBlocks = useCallback((newBlocks: Block[]) => {
    logger.action('replaceAllBlocks', { count: newBlocks.length });
    isViewingOldVersion.current = false;
    setBlocks((prev) => {
      pushUndo([...prev]);
      return newBlocks;
    });
    latestBlocksRef.current = newBlocks;
    setCurrentVersionIndex(null);
    setIsDirty(true);
  }, [pushUndo]);

  const toggleBlockVisibility = useCallback((id: string, visible: boolean) => {
    logger.action('toggleBlockVisibility', { blockId: id, visible });
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, visible } : b)));
    setIsDirty(true);
  }, []);

  const removeBlock = useCallback((id: string) => {
    logger.action('removeBlock', { blockId: id });
    isViewingOldVersion.current = false;
    setBlocks((prev) => {
      pushUndo([...prev]);
      return prev.filter((b) => b.id !== id);
    });
    setSelectedBlockId((prev) => (prev === id ? null : prev));
    setCurrentVersionIndex(null);
    setIsDirty(true);
  }, [pushUndo]);

  const undo = useCallback((): string | null => {
    let undoneLabel: string | null = null;
    isViewingOldVersion.current = false;
    setUndoStack((prev) => {
      // If there are no snapshots in the undo stack, return the previous state
      if (prev.length === 0) return prev;
      // Create a copy of the undo stack
      const next = [...prev];
      // Remove the last snapshot from the stack
      const restored = next.pop()!;
      // Get the current blocks
      const currentBlocks = blocksRef.current;
      // If the current blocks array is longer than the restored array, it means blocks were removed
      if (currentBlocks.length > restored.length) {
        // Find the removed blocks
        const removed = currentBlocks.filter((b) => !restored.find((r) => r.id === b.id));
        undoneLabel = removed.length > 0 ?
          `Removed "${removed[0].label}"` :
          'Reverted last change';
      } else if (currentBlocks.length < restored.length) {
        // If the current blocks array is shorter than the restored array, it means blocks were added
        undoneLabel = 'Restored removed section';
      } else {
        // If the current blocks array has the same length as the restored array, it means blocks were updated
        undoneLabel = 'Reverted last edit';
      }
      setBlocks(restored);
      setIsDirty(true);
      return next;
    });
    return undoneLabel;
  }, []);

  const selectBlock = useCallback((id: string | null) => {
    setSelectedBlockId(id);
  }, []);

  const reorderBlocks = useCallback((newBlocks: Block[]) => {
    logger.action('reorderBlocks');
    isViewingOldVersion.current = false;
    pushUndo([...blocksRef.current]);
    setBlocks(newBlocks);
    setCurrentVersionIndex(null);
    setIsDirty(true);
  }, [pushUndo]);

  const createVersionSnapshot = useCallback((prompt?: string) => {
    const currentBlocks = latestBlocksRef.current;
    setVersions((prev) => {
      const versionNumber = prev.length + 1;
      const newVersion: Version = {
        id: uuidv4(),
        label: `Version ${versionNumber}`,
        // Create a deep copy of the blocks
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
    // Set the blocks to the version's blocks
    setBlocks(version.blocks.map((b) => ({ ...b })));
    // Clear the selected block
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

  const handleSave = useCallback(() => {
    const id = currentProjectId || uuidv4();
    const blocksToSave = isViewingOldVersion.current ? latestBlocksRef.current : blocks;
    if (!hasMeaningfulContent({ blocks: blocksToSave, messages: savedMessages, projectName, versions })) {
      setStoredCurrentProjectId(null);
      setIsDirty(false);
      logger.action('handleSave skipped empty project');
      return;
    }
    const project: Project = {
      id,
      name: projectName,
      blocks: blocksToSave,
      versions,
      messages: savedMessages,
      updatedAt: Date.now(),
    };
    saveProject(project);
    setProjectId(id);
    setStoredCurrentProjectId(id);
    setIsDirty(false);
    logger.action('handleSave', { projectId: id, projectName });
  }, [currentProjectId, projectName, blocks, versions, savedMessages]);

  const handleLoad = useCallback((project: Project) => {
    logger.action('handleLoad', { id: project.id, name: project.name });
    isViewingOldVersion.current = false;
    setBlocks(project.blocks);
    latestBlocksRef.current = [...project.blocks];
    setProjectId(project.id);
    setProjectName(project.name);
    setVersions(project.versions || []);
    setCurrentVersionIndex(null);
    setStoredCurrentProjectId(project.id);
    setSelectedBlockId(null);
    setSavedMessages(project.messages || []);
    setUndoStack([]);
    setIsDirty(false);
  }, []);

  const handleRename = useCallback((name: string) => {
    logger.action('handleRename', { name });
    setProjectName(name);
    setIsDirty(true);
  }, []);

  const persistMessages = useCallback((messages: Message[]) => {
    setSavedMessages(messages);
    const id = currentProjectId || uuidv4();
    const blocksToSave = isViewingOldVersion.current ? latestBlocksRef.current : blocksRef.current;
    const project: Project = {
      id,
      name: projectName,
      blocks: blocksToSave,
      versions,
      messages,
      updatedAt: Date.now(),
    };
    saveProject(project);
    setProjectId(id);
    setStoredCurrentProjectId(id);
    logger.action('persistMessages', { projectId: id, messageCount: messages.length });
  }, [currentProjectId, projectName, versions]);

  return {
    blocks,
    selectedBlockId,
    currentProjectId,
    currentVersionIndex,
    isDirty,
    isReady,
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
