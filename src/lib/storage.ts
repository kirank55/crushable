import { Project, Settings, FREE_MODEL } from '@/types';
import { logger } from '@/lib/logger';

const KEYS = {
    apiKey: 'crushable:apiKey',
    model: 'crushable:model',
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

export function getSettings(): Settings {
    return {
        apiKey: getApiKey(),
        model: getModel(),
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
