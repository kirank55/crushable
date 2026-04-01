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
  /** Section plan text (persisted after planning phase). */
  plan?: string[];
  /** Per-section progress (persisted after generation). */
  sectionProgress?: Array<{ id: string; label: string; status: 'pending' | 'generating' | 'done' | 'error' }>;
}

export interface Settings {
  apiKey: string;
  model: string;
}

export interface ValidationIssue {
  type: 'error' | 'warning';
  code: string;
  message: string;
  /** Anchor href that failed to resolve. */
  href?: string;
  /** The id value that a broken anchor was targeting. */
  targetId?: string;
  /** The data-block-id of the affected block. */
  blockId?: string;
}

/** Generation always runs section-by-section. Strategy variants deferred to a later phase. */
export const GENERATION_STRATEGY = 'section-by-section' as const;

/** Refinement is always 'full' for now. Configurable levels deferred to a later phase. */
export const REFINEMENT_LEVEL = 'full' as const;

export const FREE_MODEL = 'auto:free';
