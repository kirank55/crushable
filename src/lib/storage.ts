import { Project, Settings, FREE_MODEL, DEFAULT_PAID_MODEL } from '@/types';

const KEYS = {
    apiKey: 'crushable:apiKey',
    model: 'crushable:model',
    projects: 'crushable:projects',
    currentProjectId: 'crushable:currentProjectId',
};

// --- Settings ---

export function getApiKey(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(KEYS.apiKey) || '';
}

export function setApiKey(key: string): void {
    localStorage.setItem(KEYS.apiKey, key);
}

export function getModel(): string {
    if (typeof window === 'undefined') return FREE_MODEL;
    const key = getApiKey();
    const saved = localStorage.getItem(KEYS.model);
    if (saved) return saved;
    return key ? DEFAULT_PAID_MODEL : FREE_MODEL;
}

export function setModel(model: string): void {
    localStorage.setItem(KEYS.model, model);
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
    const projects = getProjects().filter((p) => p.id !== id);
    setProjects(projects);
}

export function loadProject(id: string): Project | null {
    return getProjects().find((p) => p.id === id) || null;
}

export function getCurrentProjectId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(KEYS.currentProjectId);
}

export function setCurrentProjectId(id: string | null): void {
    if (id) {
        localStorage.setItem(KEYS.currentProjectId, id);
    } else {
        localStorage.removeItem(KEYS.currentProjectId);
    }
}
