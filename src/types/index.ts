export interface Block {
  id: string;
  label: string;
  html: string;
}

export interface Project {
  id: string;
  name: string;
  blocks: Block[];
  theme?: string;
  updatedAt: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  blockId?: string; // which block this message relates to
}

export interface Settings {
  apiKey: string;
  model: string;
}

export const FREE_MODEL = 'arcee-ai/trinity-large-preview:free';
export const DEFAULT_PAID_MODEL = 'anthropic/claude-sonnet-4';

export const AVAILABLE_MODELS = [
  { id: 'arcee-ai/trinity-large-preview:free', label: 'Arcee Trinity (Free)', free: true },
  { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4', free: false },
  { id: 'openai/gpt-4o', label: 'GPT-4o', free: false },
  { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash', free: false },
];
