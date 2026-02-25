'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Block, Project } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { saveProject, loadProject, getCurrentProjectId, setCurrentProjectId } from '@/lib/storage';

export function usePageState() {
    const [blocks, setBlocks] = useState<Block[]>([]);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [currentProjectId, setProjectId] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [projectName, setProjectName] = useState('Untitled Project');
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
        setBlocks((prev) => [...prev, block]);
        setIsDirty(true);
    }, []);

    const updateBlock = useCallback((id: string, html: string) => {
        setBlocks((prev) =>
            prev.map((b) => (b.id === id ? { ...b, html } : b))
        );
        setIsDirty(true);
    }, []);

    const removeBlock = useCallback((id: string) => {
        setBlocks((prev) => prev.filter((b) => b.id !== id));
        setSelectedBlockId((prev) => (prev === id ? null : prev));
        setIsDirty(true);
    }, []);

    const selectBlock = useCallback((id: string | null) => {
        setSelectedBlockId(id);
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedBlockId(null);
    }, []);

    const reorderBlocks = useCallback((newBlocks: Block[]) => {
        setBlocks(newBlocks);
        setIsDirty(true);
    }, []);

    const handleSave = useCallback(() => {
        const id = currentProjectId || uuidv4();
        const project: Project = {
            id,
            name: projectName,
            blocks,
            updatedAt: Date.now(),
        };
        saveProject(project);
        setProjectId(id);
        setCurrentProjectId(id);
        setIsDirty(false);
    }, [currentProjectId, projectName, blocks]);

    const handleLoad = useCallback((project: Project) => {
        setBlocks(project.blocks);
        setProjectId(project.id);
        setProjectName(project.name);
        setCurrentProjectId(project.id);
        setSelectedBlockId(null);
        setIsDirty(false);
    }, []);

    const handleNew = useCallback(() => {
        const id = uuidv4();
        setBlocks([]);
        setProjectId(id);
        setProjectName('Untitled Project');
        setCurrentProjectId(id);
        setSelectedBlockId(null);
        setIsDirty(false);
    }, []);

    const handleRename = useCallback((name: string) => {
        setProjectName(name);
        setIsDirty(true);
    }, []);

    const clearAll = useCallback(() => {
        setBlocks([]);
        setSelectedBlockId(null);
        setIsDirty(true);
    }, []);

    return {
        blocks,
        selectedBlockId,
        currentProjectId,
        isDirty,
        projectName,
        addBlock,
        updateBlock,
        removeBlock,
        selectBlock,
        clearSelection,
        reorderBlocks,
        handleSave,
        handleLoad,
        handleNew,
        handleRename,
        clearAll,
    };
}
