export interface Block {
  id: string;
  label: string;
  html: string;
}

export interface Version {
  id: string;
  label: string;
  blocks: Block[];
  timestamp: number;
  prompt?: string;
}

export interface Project {
  id: string;
  name: string;
  blocks: Block[];
  versions?: Version[];
  theme?: string;
  updatedAt: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  blockId?: string;
}

export interface Settings {
  apiKey: string;
  model: string;
}

export interface ModelInfo {
  id: string;
  label: string;
  free: boolean;
}

export const FREE_AUTO_MODEL = 'auto:free';
export const FREE_MODEL = 'auto:free';

const DEFAULT_MODELS: ModelInfo[] = [
  { id: 'auto:free', label: 'Free Auto', free: true },
  { id: 'stepfun/step-3.5-flash:free', label: 'StepFun 3.5 Flash', free: true },
  { id: 'z-ai/glm-4.5-air:free', label: 'GLM 4.5 Air', free: true },
  { id: 'nvidia/nemotron-3-nano-30b-a3b:free', label: 'NVIDIA Nemotron 30B', free: true },
  { id: 'google/gemma-3-27b-it:free', label: 'Gemma 3 27B', free: true },
];

export function getAvailableModels(): ModelInfo[] {
  const envModels = process.env.NEXT_PUBLIC_MODELS;
  if (envModels) {
    try {
      const parsed = JSON.parse(envModels) as ModelInfo[];
      // Always ensure Free Auto is first
      if (!parsed.find(m => m.id === FREE_AUTO_MODEL)) {
        parsed.unshift({ id: FREE_AUTO_MODEL, label: 'Free Auto', free: true });
      }
      return parsed;
    } catch {
      // Fall back to defaults on parse error
    }
  }
  return DEFAULT_MODELS;
}

