import {
    DEFAULT_GENERATION_STRATEGY,
    DEFAULT_REFINEMENT_LEVEL,
    FREE_MODEL,
    GenerationStrategy,
    Project,
    RefinementLevel,
    Settings,
} from '@/types';
import { logger } from '@/lib/logger';

const KEYS = {
    apiKey: 'crushable:apiKey',
    model: 'crushable:model',
    generationStrategy: 'crushable:generationStrategy',
    refinementLevel: 'crushable:refinementLevel',
    projects: 'crushable:projects',
    currentProjectId: 'crushable:currentProjectId',
};

function emitSettingsChange(): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('crushable:settings-changed'));
}

// --- Settings ---

export function getApiKey(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(KEYS.apiKey) || '';
}

export function setApiKey(key: string): void {
    logger.storage('setApiKey', { keyPrefix: key ? key.slice(0, 10) + '...' : '(empty)' });
    localStorage.setItem(KEYS.apiKey, key);
    emitSettingsChange();
}

export function getModel(): string {
    if (typeof window === 'undefined') return FREE_MODEL;
    const saved = localStorage.getItem(KEYS.model);
    if (saved) return saved;
    return FREE_MODEL;
}

export function setModel(model: string): void {
    logger.storage('setModel', { model });
    localStorage.setItem(KEYS.model, model);
    emitSettingsChange();
}

export function getGenerationStrategy(): GenerationStrategy {
    if (typeof window === 'undefined') return DEFAULT_GENERATION_STRATEGY;
    const saved = localStorage.getItem(KEYS.generationStrategy) as GenerationStrategy | null;
    if (saved === 'hybrid' || saved === 'template-first' || saved === 'component-first' || saved === 'html-only') {
        return saved;
    }
    return DEFAULT_GENERATION_STRATEGY;
}

export function setGenerationStrategy(strategy: GenerationStrategy): void {
    logger.storage('setGenerationStrategy', { strategy });
    localStorage.setItem(KEYS.generationStrategy, strategy);
    emitSettingsChange();
}

export function getRefinementLevel(): RefinementLevel {
    if (typeof window === 'undefined') return DEFAULT_REFINEMENT_LEVEL;
    const saved = localStorage.getItem(KEYS.refinementLevel) as RefinementLevel | null;
    if (saved === 'off' || saved === 'light' || saved === 'full') {
        return saved;
    }
    return DEFAULT_REFINEMENT_LEVEL;
}

export function setRefinementLevel(level: RefinementLevel): void {
    logger.storage('setRefinementLevel', { level });
    localStorage.setItem(KEYS.refinementLevel, level);
    emitSettingsChange();
}

export function getSettings(): Settings {
    return {
        apiKey: getApiKey(),
        model: getModel(),
        generationStrategy: getGenerationStrategy(),
        refinementLevel: getRefinementLevel(),
    };
}

// --- Projects ---

export function getProjects(): Project[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(KEYS.projects);
    if (!raw) return [];
    try {
        return JSON.parse(raw) as Project[];
    } catch {
        return [];
    }
}

function setProjects(projects: Project[]): void {
    localStorage.setItem(KEYS.projects, JSON.stringify(projects));
}

export function saveProject(project: Project): void {
    logger.storage('saveProject', { id: project.id, name: project.name, blockCount: project.blocks.length });
    const projects = getProjects();
    const index = projects.findIndex((p) => p.id === project.id);
    const updated = { ...project, updatedAt: Date.now() };
    if (index >= 0) {
        projects[index] = updated;
    } else {
        projects.unshift(updated);
    }
    setProjects(projects);
}

export function deleteProject(id: string): void {
    logger.storage('deleteProject', { id });
    const projects = getProjects().filter((p) => p.id !== id);
    setProjects(projects);
}

export function loadProject(id: string): Project | null {
    const project = getProjects().find((p) => p.id === id) || null;
    logger.storage('loadProject', { id, found: !!project });
    return project;
}

export function getCurrentProjectId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(KEYS.currentProjectId);
}

export function setCurrentProjectId(id: string | null): void {
    logger.storage('setCurrentProjectId', { id });
    if (id) {
        localStorage.setItem(KEYS.currentProjectId, id);
    } else {
        localStorage.removeItem(KEYS.currentProjectId);
    }
}
