'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Block, Project, Version, Message } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { saveProject, loadProject, getCurrentProjectId, setCurrentProjectId } from '@/lib/storage';
import { logger } from '@/lib/logger';

const MAX_UNDO_STACK = 20;

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
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const blocksRef = useRef<Block[]>([]);
    // Separate ref for the "latest working state" — NOT overwritten by version browsing
    const latestBlocksRef = useRef<Block[]>([]);
    const isViewingOldVersion = useRef(false);

    // Load project on mount based on projectId prop
    useEffect(() => {
        if (projectId && projectId !== 'new') {
            // Load a specific project by ID
            const project = loadProject(projectId);
            if (project) {
                setBlocks(project.blocks);
                setProjectId(project.id);
                setProjectName(project.name);
                setVersions(project.versions || []);
                setDesignStyleState(project.designStyle);
                setCurrentProjectId(project.id);
                setSavedMessages(project.messages || []);
                latestBlocksRef.current = [...project.blocks];
                isViewingOldVersion.current = false;
                logger.action('Loaded project by ID', { id: project.id, name: project.name });
            }
        } else if (projectId === 'new') {
            // Create a new project
            const id = uuidv4();
            setProjectId(id);
            setProjectName('Untitled Project');
            setCurrentProjectId(id);
            latestBlocksRef.current = [];
            isViewingOldVersion.current = false;
            logger.action('Created new project via route', { id });
        } else {
            // Fallback: load last project (for backward compat)
            const lastId = getCurrentProjectId();
            if (lastId) {
                const project = loadProject(lastId);
                if (project) {
                    setBlocks(project.blocks);
                    setProjectId(project.id);
                    setProjectName(project.name);
                    setVersions(project.versions || []);
                    setDesignStyleState(project.designStyle);
                    setSavedMessages(project.messages || []);
                    latestBlocksRef.current = [...project.blocks];
                    isViewingOldVersion.current = false;
                    logger.action('Loaded last project', { id: project.id, name: project.name });
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setBlocks((prev) => prev.filter((b) => b.id !== id));
        setSelectedBlockId((prev) => (prev === id ? null : prev));
        setIsDirty(true);
    }, []);

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
        setBlocks(newBlocks);
        setIsDirty(true);
    }, []);

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
        setCurrentProjectId(id);
        setIsDirty(false);
        logger.action('handleSave (auto)', { projectId: id, projectName });
    }, [currentProjectId, projectName, blocks, versions, savedMessages, designStyle]);

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
        setCurrentProjectId(project.id);
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
        setProjectName('Untitled Project');
        setVersions([]);
        setCurrentVersionIndex(null);
        setDesignStyleState(undefined);
        setCurrentProjectId(id);
        setSelectedBlockId(null);
        setUndoStack([]);
        setIsDirty(false);
    }, []);

    const handleRename = useCallback((name: string) => {
        logger.action('handleRename', { name });
        setProjectName(name);
        setIsDirty(true);
    }, []);

    const clearAll = useCallback(() => {
        logger.action('clearAll');
        setBlocks([]);
        setSelectedBlockId(null);
        setIsDirty(true);
    }, []);

    const importBlocks = useCallback((newBlocks: Block[]) => {
        logger.action('importBlocks', { count: newBlocks.length });
        setBlocks((prev) => [...prev, ...newBlocks]);
        setIsDirty(true);
    }, []);

    return {
        blocks,
        selectedBlockId,
        currentProjectId,
        isDirty,
        projectName,
        versions,
        designStyle,
        canUndo: undoStack.length > 0,
        addBlock,
        addBlockSmart,
        updateBlock,
        removeBlock,
        selectBlock,
        clearSelection,
        reorderBlocks,
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
        setSavedMessages,
    };
}
