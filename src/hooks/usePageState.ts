'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Block, Project, Version } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { saveProject, loadProject, getCurrentProjectId, setCurrentProjectId } from '@/lib/storage';
import { logger } from '@/lib/logger';

export function usePageState() {
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [currentProjectId, setProjectId] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [projectName, setProjectName] = useState('Untitled Project');
    const [versions, setVersions] = useState<Version[]>([]);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Load last project on mount
    useEffect(() => {
        const lastId = getCurrentProjectId();
        if (lastId) {
            const project = loadProject(lastId);
            if (project) {
                setBlocks(project.blocks);
                setProjectId(project.id);
                setProjectName(project.name);
                setVersions(project.versions || []);
                logger.action('Loaded last project', { id: project.id, name: project.name });
            }
        }
    }, []);

    // Auto-save debounce (30s)
    useEffect(() => {
        if (!isDirty || !currentProjectId) return;

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = setTimeout(() => {
            handleSave();
        }, 30000);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDirty, blocks, currentProjectId]);

    const addBlock = useCallback((block: Block) => {
        logger.action('addBlock', { blockId: block.id, label: block.label });
        setBlocks((prev) => [...prev, block]);
        setIsDirty(true);
    }, []);

    const updateBlock = useCallback((id: string, html: string) => {
        logger.action('updateBlock', { blockId: id });
        setBlocks((prev) =>
            prev.map((b) => (b.id === id ? { ...b, html } : b))
        );
        setIsDirty(true);
    }, []);

    const removeBlock = useCallback((id: string) => {
        logger.action('removeBlock', { blockId: id });
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
        setBlocks(newBlocks);
        setIsDirty(true);
    }, []);

    const createVersionSnapshot = useCallback((prompt?: string) => {
        setVersions((prev) => {
            const versionNumber = prev.length + 1;
            const newVersion: Version = {
                id: uuidv4(),
                label: `Version ${versionNumber}`,
                blocks: [...blocks],
                timestamp: Date.now(),
                prompt,
            };
            logger.action('createVersionSnapshot', { versionNumber, prompt: prompt?.slice(0, 60) });
            return [...prev, newVersion];
        });
        setIsDirty(true);
    }, [blocks]);

    const loadVersion = useCallback((version: Version) => {
        logger.action('loadVersion', { label: version.label });
        setBlocks([...version.blocks]);
        setSelectedBlockId(null);
        setIsDirty(true);
    }, []);

    const handleSave = useCallback(() => {
        const id = currentProjectId || uuidv4();
        const project: Project = {
            id,
            name: projectName,
            blocks,
            versions,
            updatedAt: Date.now(),
        };
        saveProject(project);
        setProjectId(id);
        setCurrentProjectId(id);
        setIsDirty(false);
        logger.action('handleSave', { projectId: id, projectName });
    }, [currentProjectId, projectName, blocks, versions]);

    const handleLoad = useCallback((project: Project) => {
        logger.action('handleLoad', { id: project.id, name: project.name });
        setBlocks(project.blocks);
        setProjectId(project.id);
        setProjectName(project.name);
        setVersions(project.versions || []);
        setCurrentProjectId(project.id);
        setSelectedBlockId(null);
        setIsDirty(false);
    }, []);

    const handleNew = useCallback(() => {
        const id = uuidv4();
        logger.action('handleNew', { newProjectId: id });
        setBlocks([]);
        setProjectId(id);
        setProjectName('Untitled Project');
        setVersions([]);
        setCurrentProjectId(id);
        setSelectedBlockId(null);
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
        addBlock,
        updateBlock,
        removeBlock,
        selectBlock,
        clearSelection,
        reorderBlocks,
        createVersionSnapshot,
        loadVersion,
        handleSave,
        handleLoad,
        handleNew,
        handleRename,
        clearAll,
        importBlocks,
    };
}
