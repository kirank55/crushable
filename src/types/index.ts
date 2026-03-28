export interface Block {
  id: string;
  label: string;
  html: string;
  visible?: boolean;
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
  messages?: Message[];
  designStyle?: string;
  status?: 'in-progress' | 'completed';
  updatedAt: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  summary?: string;
  blockId?: string;
  timestamp?: number;
}

export interface Settings {
  apiKey: string;
  model: string;
}

/** Generation always runs section-by-section. Strategy variants deferred to a later phase. */
export const GENERATION_STRATEGY = 'section-by-section' as const;

/** Refinement is always 'full' for now. Configurable levels deferred to a later phase. */
export const REFINEMENT_LEVEL = 'full' as const;

export const FREE_MODEL = 'auto:free';
