'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Block, Message, Project, Version } from '@/types';
import {
  saveProject as saveProjectToStorage,
  loadProject as loadProjectFromStorage,
  getCurrentProjectId as getStoredCurrentProjectId,
  setCurrentProjectId as setStoredCurrentProjectId,
} from '@/lib/storage';
import { logger } from '@/lib/logger';

// ─── Constants ──────────────────────────────────────────────────

const DEFAULT_PROJECT_NAME = 'Untitled Project';

// ─── Types ──────────────────────────────────────────────────────

/** Everything the storage layer needs to build and persist a Project. */
export interface ProjectSnapshot {
  name: string;
  blocks: Block[];
  versions: Version[];
  messages: Message[];
}

/** The data returned after loading a project from localStorage. */
export interface LoadedProjectData {
  id: string;
  name: string;
  blocks: Block[];
  versions: Version[];
  messages: Message[];
}

// ─── Helpers ────────────────────────────────────────────────────

function hasMeaningfulContent({ blocks, messages, name, versions }: ProjectSnapshot): boolean {
  return (
    blocks.length > 0 ||
    messages.length > 0 ||
    versions.length > 0 ||
    name.trim() !== DEFAULT_PROJECT_NAME
  );
}

/** Resolves the route ID into loaded project data. */
function resolveProject(routeId?: string): LoadedProjectData | null {
  // /project/<uuid> — load a specific project
  if (routeId && routeId !== 'new') {
    const project = loadProjectFromStorage(routeId);
    if (project) {
      logger.action('Loaded project by ID', { id: project.id, name: project.name });
      return {
        id: project.id,
        name: project.name,
        blocks: project.blocks,
        versions: project.versions || [],
        messages: project.messages || [],
      };
    }
    return null;
  }

  // /project/new — blank slate
  if (routeId === 'new') {
    const id = uuidv4();
    logger.action('Created new project via route', { id });
    setStoredCurrentProjectId(null);
    return {
      id,
      name: DEFAULT_PROJECT_NAME,
      blocks: [],
      versions: [],
      messages: [],
    };
  }

  // No route ID — try to load the last project
  const lastId = getStoredCurrentProjectId();
  if (lastId) {
    const project = loadProjectFromStorage(lastId);
    if (project) {
      logger.action('Loaded last project', { id: project.id, name: project.name });
      return {
        id: project.id,
        name: project.name,
        blocks: project.blocks,
        versions: project.versions || [],
        messages: project.messages || [],
      };
    }
  }

  return null;
}

// ─── Hook ───────────────────────────────────────────────────────

export function useProjectStorage(routeId?: string) {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const loadedDataRef = useRef<LoadedProjectData | null>(null);
  const isInitialLoadRef = useRef(true);

  // Load project data on mount (or when routeId changes)
  useEffect(() => {
    setIsReady(false);

    const data = resolveProject(routeId);
    loadedDataRef.current = data;

    if (data) {
      setProjectId(data.id);
      setStoredCurrentProjectId(data.id);
    } else {
      setProjectId(null);
    }

    isInitialLoadRef.current = false;
    setIsReady(true);
  }, [routeId]);

  /**
   * Save the current editing state to localStorage.
   * Returns `true` if saved, `false` if skipped (empty project).
   */
  const save = useCallback(
    (snapshot: ProjectSnapshot): boolean => {
      const id = projectId || uuidv4();

      if (!hasMeaningfulContent(snapshot)) {
        setStoredCurrentProjectId(null);
        logger.action('save skipped — empty project');
        return false;
      }

      const project: Project = {
        id,
        name: snapshot.name,
        blocks: snapshot.blocks,
        versions: snapshot.versions,
        messages: snapshot.messages,
        updatedAt: Date.now(),
      };

      saveProjectToStorage(project);
      setProjectId(id);
      setStoredCurrentProjectId(id);
      logger.action('save', { projectId: id, projectName: snapshot.name });
      return true;
    },
    [projectId],
  );

  /**
   * Immediately persist messages (called after each AI generation).
   * Unlike `save`, this doesn't check isDirty — it always writes.
   */
  const persistMessages = useCallback(
    (messages: Message[], snapshot: Omit<ProjectSnapshot, 'messages'>): void => {
      const id = projectId || uuidv4();

      const project: Project = {
        id,
        name: snapshot.name,
        blocks: snapshot.blocks,
        versions: snapshot.versions,
        messages,
        updatedAt: Date.now(),
      };

      saveProjectToStorage(project);
      setProjectId(id);
      setStoredCurrentProjectId(id);
      logger.action('persistMessages', { projectId: id, messageCount: messages.length });
    },
    [projectId],
  );

  /**
   * Load an entirely different project (e.g. from a project list).
   * Returns the loaded data so the caller can hydrate its state.
   */
  const loadExternal = useCallback((project: Project): LoadedProjectData => {
    logger.action('loadExternal', { id: project.id, name: project.name });
    setProjectId(project.id);
    setStoredCurrentProjectId(project.id);
    return {
      id: project.id,
      name: project.name,
      blocks: project.blocks,
      versions: project.versions || [],
      messages: project.messages || [],
    };
  }, []);

  return {
    projectId,
    isReady,
    loadedData: loadedDataRef.current,
    save,
    persistMessages,
    loadExternal,
  };
}
