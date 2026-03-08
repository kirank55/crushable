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

function hasMeaningfulProjectContent({
    blocks,
    messages,
    designStyle,
    projectName,
    versions,
}: {
    blocks: Block[];
    messages: Message[];
    designStyle?: string;
    projectName: string;
    versions: Version[];
}): boolean {
    return (
        blocks.length > 0 ||
        messages.length > 0 ||
        versions.length > 0 ||
        !!designStyle ||
        projectName.trim() !== DEFAULT_PROJECT_NAME
    );
}

export function usePageState(projectId?: string) {
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [currentProjectId, setProjectId] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [projectName, setProjectName] = useState('Untitled Project');
    const [versions, setVersions] = useState<Version[]>([]);
    const [currentVersionIndex, setCurrentVersionIndex] = useState<number | null>(null);
    const [designStyle, setDesignStyleState] = useState<string | undefined>(undefined);
    const [undoStack, setUndoStack] = useState<Block[][]>([]);
    const [savedMessages, setSavedMessages] = useState<Message[]>([]);
    const [isReady, setIsReady] = useState(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const blocksRef = useRef<Block[]>([]);
    // Separate ref for the "latest working state" — NOT overwritten by version browsing
    const latestBlocksRef = useRef<Block[]>([]);
    const isViewingOldVersion = useRef(false);

    // Load project on mount based on projectId prop
    useEffect(() => {
        setIsReady(false);

        if (projectId && projectId !== 'new') {
            // Load a specific project by ID
            const project = loadProject(projectId);
            if (project) {
                setBlocks(project.blocks);
                setProjectId(project.id);
                setProjectName(project.name);
                setVersions(project.versions || []);
                setDesignStyleState(project.designStyle);
                setStoredCurrentProjectId(project.id);
                setSavedMessages(project.messages || []);
                latestBlocksRef.current = [...project.blocks];
                isViewingOldVersion.current = false;
                logger.action('Loaded project by ID', { id: project.id, name: project.name });
            }
        } else if (projectId === 'new') {
            // Create a new project
            const id = uuidv4();
            setBlocks([]);
            setProjectId(id);
            setProjectName(DEFAULT_PROJECT_NAME);
            setVersions([]);
            setDesignStyleState(undefined);
            setSelectedBlockId(null);
            setSavedMessages([]);
            setUndoStack([]);
            setIsDirty(false);
            setStoredCurrentProjectId(null);
            latestBlocksRef.current = [];
            isViewingOldVersion.current = false;
            logger.action('Created new project via route', { id });
        } else {
            // Fallback: load last project (for backward compat)
            const lastId = getStoredCurrentProjectId();
            if (lastId) {
                const project = loadProject(lastId);
                if (project) {
                    setBlocks(project.blocks);
                    setProjectId(project.id);
                    setProjectName(project.name);
                    setVersions(project.versions || []);
                    setDesignStyleState(project.designStyle);
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

    // Auto-save every 2 seconds when dirty
    useEffect(() => {
        if (!isDirty || !currentProjectId) return;

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
            handleSave();
        }, 2000);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDirty, blocks, currentProjectId]);

    // Keep blocksRef in sync (for undo, etc.)
    useEffect(() => {
        blocksRef.current = blocks;
        // Only update latestBlocksRef when NOT browsing an old version
        if (!isViewingOldVersion.current) {
            latestBlocksRef.current = blocks;
        }
    }, [blocks]);

    const persistProject = useCallback((overrideMessages?: Message[]) => {
        const id = currentProjectId || uuidv4();
        const blocksToSave = isViewingOldVersion.current ? latestBlocksRef.current : blocksRef.current;
        const messagesToSave = overrideMessages ?? savedMessages;

        if (!hasMeaningfulProjectContent({
            blocks: blocksToSave,
            messages: messagesToSave,
            designStyle,
            projectName,
            versions,
        })) {
            setStoredCurrentProjectId(null);
            return null;
        }

        const project: Project = {
            id,
            name: projectName,
            blocks: blocksToSave,
            versions,
            messages: messagesToSave,
            designStyle,
            updatedAt: Date.now(),
        };
        saveProject(project);
        setProjectId(id);
        setStoredCurrentProjectId(id);
        return id;
    }, [currentProjectId, projectName, versions, savedMessages, designStyle]);

    const pushUndo = useCallback((snapshot: Block[]) => {
        setUndoStack((prev) => {
            const next = [...prev, snapshot];
            if (next.length > MAX_UNDO_STACK) next.shift();
            return next;
        });
    }, []);

    const addBlock = useCallback((block: Block) => {
        logger.action('addBlock', { blockId: block.id, label: block.label });
        isViewingOldVersion.current = false; // Real content change
        setBlocks((prev) => {
            pushUndo([...prev]);
            return [...prev, block];
        });
        setCurrentVersionIndex(null);
        setIsDirty(true);
    }, [pushUndo]);

    // Smart block insertion: navbar at top, footer at bottom, others before footer
    const addBlockSmart = useCallback((block: Block) => {
        logger.action('addBlockSmart', { blockId: block.id, label: block.label });
        isViewingOldVersion.current = false; // Real content change
        setBlocks((prev) => {
            pushUndo([...prev]);
            const label = (block.label || '').toLowerCase();
            const html = (block.html || '').toLowerCase();
            const isNav = label.includes('nav') || label.includes('header') || html.includes('data-block-id="nav') || html.includes('data-block-id="header');
            const isFooter = label.includes('footer') || html.includes('data-block-id="footer');

            if (isNav) {
                return [block, ...prev];
            }
            if (isFooter) {
                return [...prev, block];
            }
            // Insert before footer if one exists, else append
            const footerIndex = prev.findIndex(b => {
                const l = (b.label || '').toLowerCase();
                const h = (b.html || '').toLowerCase();
                return l.includes('footer') || h.includes('data-block-id="footer');
            });
            if (footerIndex !== -1) {
                const next = [...prev];
                next.splice(footerIndex, 0, block);
                return next;
            }
            return [...prev, block];
        });
        setCurrentVersionIndex(null);
        setIsDirty(true);
    }, [pushUndo]);

    const updateBlock = useCallback((id: string, html: string) => {
        logger.action('updateBlock', { blockId: id });
        isViewingOldVersion.current = false; // Real content change
        setBlocks((prev) => {
            pushUndo([...prev]);
            return prev.map((b) => (b.id === id ? { ...b, html } : b));
        });
        setCurrentVersionIndex(null);
        setIsDirty(true);
    }, [pushUndo]);

    const duplicateBlock = useCallback((id: string) => {
        let duplicatedId: string | null = null;

        logger.action('duplicateBlock', { blockId: id });
        isViewingOldVersion.current = false;
        setBlocks((prev) => {
            const index = prev.findIndex((block) => block.id === id);
            if (index === -1) return prev;

            pushUndo([...prev]);

            const nextBlock = duplicateBlockData(prev[index], prev.map((block) => block.id));
            duplicatedId = nextBlock.id;

            const next = [...prev];
            next.splice(index + 1, 0, nextBlock);
            return next;
        });

        if (duplicatedId) {
            setSelectedBlockId(duplicatedId);
        }

        setCurrentVersionIndex(null);
        setIsDirty(true);
    }, [pushUndo]);

    const undo = useCallback((): string | null => {
        let undoneLabel: string | null = null;
        isViewingOldVersion.current = false; // Real content change
        setUndoStack((prev) => {
            if (prev.length === 0) return prev;
            const next = [...prev];
            const restored = next.pop()!;
            logger.action('undo', { stackSize: next.length });

            // Figure out what changed for the message
            const currentBlocks = blocksRef.current;
            if (currentBlocks.length > restored.length) {
                const removed = currentBlocks.filter(b => !restored.find(r => r.id === b.id));
                undoneLabel = removed.length > 0 ? `Removed "${removed[0].label}"` : 'Reverted last change';
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

    const removeBlock = useCallback((id: string) => {
        logger.action('removeBlock', { blockId: id });
        isViewingOldVersion.current = false; // Real content change
        setBlocks((prev) => {
            pushUndo([...prev]);
            return prev.filter((b) => b.id !== id);
        });
        setSelectedBlockId((prev) => (prev === id ? null : prev));
        setCurrentVersionIndex(null);
        setIsDirty(true);
    }, [pushUndo]);

    const selectBlock = useCallback((id: string | null) => {
        logger.action('selectBlock', { blockId: id });
        setSelectedBlockId(id);
    }, []);

    const clearSelection = useCallback(() => {
        logger.action('clearSelection');
        setSelectedBlockId(null);
    }, []);

    const reorderBlocks = useCallback((newBlocks: Block[]) => {
        logger.action('reorderBlocks');
        isViewingOldVersion.current = false;
        pushUndo([...blocksRef.current]);
        setBlocks(newBlocks);
        setCurrentVersionIndex(null);
        setIsDirty(true);
    }, [pushUndo]);

    const toggleBlockVisibility = useCallback((id: string) => {
        logger.action('toggleBlockVisibility', { blockId: id });
        isViewingOldVersion.current = false;
        setBlocks((prev) => {
            const index = prev.findIndex((block) => block.id === id);
            if (index === -1) return prev;

            pushUndo([...prev]);

            return prev.map((block) => {
                if (block.id !== id) return block;
                return {
                    ...block,
                    visible: block.visible === false,
                };
            });
        });
        setCurrentVersionIndex(null);
        setIsDirty(true);
    }, [pushUndo]);

    const setDesignStyle = useCallback((style: string) => {
        logger.action('setDesignStyle', { style });
        setDesignStyleState(style);
        setIsDirty(true);
    }, []);

    const createVersionSnapshot = useCallback((prompt?: string) => {
        // Always snapshot from latestBlocksRef (the real working state)
        const currentBlocks = latestBlocksRef.current;
        setVersions((prev) => {
            const versionNumber = prev.length + 1;
            const newVersion: Version = {
                id: uuidv4(),
                label: `Version ${versionNumber}`,
                blocks: currentBlocks.map(b => ({ ...b })), // deep copy
                timestamp: Date.now(),
                prompt,
            };
            logger.action('createVersionSnapshot', { versionNumber, prompt: prompt?.slice(0, 60), blockCount: currentBlocks.length });
            setCurrentVersionIndex(versionNumber - 1);
            return [...prev, newVersion];
        });
        setIsDirty(true);
    }, []);

    const loadVersion = useCallback((version: Version, index?: number) => {
        logger.action('loadVersion', { label: version.label, index });
        isViewingOldVersion.current = true; // Mark as browsing — don't overwrite latestBlocksRef
        if (index !== undefined) {
            setCurrentVersionIndex(index);
        }
        setBlocks(version.blocks.map(b => ({ ...b }))); // deep copy
        setSelectedBlockId(null);
    }, []);

    const restoreCurrentBlocks = useCallback(() => {
        // Restore the actual latest working state (never corrupted by version browsing)
        const latest = latestBlocksRef.current;
        logger.action('restoreCurrentBlocks', { blockCount: latest.length });
        isViewingOldVersion.current = false;
        setBlocks(latest.map(b => ({ ...b }))); // deep copy
        setCurrentVersionIndex(null);
        setSelectedBlockId(null);
    }, []);

    const handleSave = useCallback(() => {
        const id = currentProjectId || uuidv4();
        // When browsing an old version, save the real working state — not the viewed version's blocks
        const blocksToSave = isViewingOldVersion.current ? latestBlocksRef.current : blocks;
        if (!hasMeaningfulProjectContent({
            blocks: blocksToSave,
            messages: savedMessages,
            designStyle,
            projectName,
            versions,
        })) {
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
            designStyle,
            updatedAt: Date.now(),
        };
        saveProject(project);
        setProjectId(id);
        setStoredCurrentProjectId(id);
        setIsDirty(false);
        logger.action('handleSave (auto)', { projectId: id, projectName });
    }, [currentProjectId, projectName, blocks, versions, savedMessages, designStyle]);

    const persistMessages = useCallback((messages: Message[]) => {
        setSavedMessages(messages);
        const id = persistProject(messages);
        logger.action('persistMessages', { projectId: id ?? '(skipped empty)', messageCount: messages.length });
    }, [persistProject]);

    const handleLoad = useCallback((project: Project) => {
        logger.action('handleLoad', { id: project.id, name: project.name });
        isViewingOldVersion.current = false;
        setBlocks(project.blocks);
        latestBlocksRef.current = [...project.blocks];
        setProjectId(project.id);
        setProjectName(project.name);
        setVersions(project.versions || []);
        setCurrentVersionIndex(null);
        setDesignStyleState(project.designStyle);
        setStoredCurrentProjectId(project.id);
        setSelectedBlockId(null);
        setSavedMessages(project.messages || []);
        setUndoStack([]);
        setIsDirty(false);
    }, []);

    const handleNew = useCallback(() => {
        const id = uuidv4();
        logger.action('handleNew', { newProjectId: id });
        isViewingOldVersion.current = false;
        latestBlocksRef.current = [];
        setBlocks([]);
        setProjectId(id);
        setProjectName(DEFAULT_PROJECT_NAME);
        setVersions([]);
        setCurrentVersionIndex(null);
        setDesignStyleState(undefined);
        setSavedMessages([]);
        setSelectedBlockId(null);
        setUndoStack([]);
        setIsDirty(false);
        setStoredCurrentProjectId(null);
    }, []);

    const handleRename = useCallback((name: string) => {
        logger.action('handleRename', { name });
        setProjectName(name);
        setIsDirty(true);
    }, []);

    const clearAll = useCallback(() => {
        logger.action('clearAll');
        pushUndo([...blocksRef.current]);
        setBlocks([]);
        setSelectedBlockId(null);
        setCurrentVersionIndex(null);
        setIsDirty(true);
    }, [pushUndo]);

    const importBlocks = useCallback((newBlocks: Block[]) => {
        logger.action('importBlocks', { count: newBlocks.length });
        setBlocks((prev) => {
            pushUndo([...prev]);
            return [...prev, ...newBlocks.map((block) => ({ ...block, visible: block.visible !== false }))];
        });
        setCurrentVersionIndex(null);
        setIsDirty(true);
    }, [pushUndo]);

    return {
        blocks,
        selectedBlockId,
        currentProjectId,
        currentVersionIndex,
        isDirty,
        isReady,
        projectName,
        versions,
        designStyle,
        canUndo: undoStack.length > 0,
        addBlock,
        addBlockSmart,
        updateBlock,
        duplicateBlock,
        removeBlock,
        selectBlock,
        clearSelection,
        reorderBlocks,
        toggleBlockVisibility,
        setDesignStyle,
        createVersionSnapshot,
        loadVersion,
        restoreCurrentBlocks,
        handleSave,
        handleLoad,
        handleNew,
        handleRename,
        clearAll,
        importBlocks,
        undo,
        savedMessages,
        setSavedMessages: persistMessages,
    };
}
