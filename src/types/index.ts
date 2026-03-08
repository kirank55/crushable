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
  theme?: string;
  status?: 'in-progress' | 'completed';
  updatedAt: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  summary?: string;
  plan?: string;
  blockId?: string;
  blocksSnapshot?: Block[];
  timestamp?: number;
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

export interface DesignStyle {
  id: string;
  label: string;
  emoji: string;
  description: string;
  prompt: string;
}

export const FREE_AUTO_MODEL = 'auto:free';
export const FREE_MODEL = 'auto:free';

const DEFAULT_MODELS: ModelInfo[] = [
  { id: 'auto:free', label: 'Free Model', free: true },
];

export const PREMIUM_MODELS: ModelInfo[] = [
  { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4', free: false },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash', free: false },
  { id: 'openai/gpt-4o', label: 'GPT-4o', free: false },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', free: false },
  { id: 'anthropic/claude-3.5-haiku', label: 'Claude 3.5 Haiku', free: false },
];

export function getAvailableModels(hasApiKey: boolean = false): ModelInfo[] {
  const envModels = process.env.NEXT_PUBLIC_MODELS;
  let models: ModelInfo[];
  if (envModels) {
    try {
      const parsed = JSON.parse(envModels) as ModelInfo[];
      if (!parsed.find(m => m.id === FREE_AUTO_MODEL)) {
        parsed.unshift({ id: FREE_AUTO_MODEL, label: 'Free Model', free: true });
      }
      models = parsed;
    } catch {
      models = [...DEFAULT_MODELS];
    }
  } else {
    models = [...DEFAULT_MODELS];
  }

  if (hasApiKey) {
    models = [...models, ...PREMIUM_MODELS];
  }

  return models;
}

export const DESIGN_STYLES: DesignStyle[] = [
  {
    id: 'professional',
    label: 'Professional',
    emoji: '💼',
    description: 'Clean, corporate, trustworthy',
    prompt: 'Use a professional design system: clean layouts, neutral colors (slate, gray, blue), sharp typography, ample whitespace, subtle shadows, and a corporate-trustworthy aesthetic. Use Inter or system fonts. Color palette: primary blue (#2563eb), dark text (#0f172a), light backgrounds (#f8fafc).',
  },
  {
    id: 'playful',
    label: 'Playful',
    emoji: '🎨',
    description: 'Colorful, fun, energetic',
    prompt: 'Use a playful design system: vibrant colors (purple, pink, orange gradients), rounded corners (xl/2xl), bouncy typography, emoji accents, fun hover animations, and an energetic youthful aesthetic. Color palette: purple (#8b5cf6), pink (#ec4899), orange (#f97316), with gradient backgrounds.',
  },
  {
    id: 'minimal',
    label: 'Minimal',
    emoji: '⬜',
    description: 'Simple, clean, lots of whitespace',
    prompt: 'Use a minimal design system: extreme simplicity, monochrome or near-monochrome palette, generous whitespace, thin borders, understated typography, no gradients, and a zen-like aesthetic. Color palette: black (#000), white (#fff), gray (#6b7280). Use thin 1px borders and subtle separators.',
  },
  {
    id: 'bold',
    label: 'Bold & Dark',
    emoji: '🖤',
    description: 'Dark theme, neon accents, dramatic',
    prompt: 'Use a bold dark design system: dark backgrounds (#0a0a0a, #111), neon accent colors (cyan #06b6d4, green #22c55e, purple #a855f7), large bold typography, dramatic gradients, glow effects, and a futuristic tech aesthetic. Use glassmorphism where appropriate.',
  },
  {
    id: 'elegant',
    label: 'Elegant',
    emoji: '✨',
    description: 'Luxury, refined, sophisticated',
    prompt: 'Use an elegant design system: rich colors (deep navy #1e293b, gold #d4a574, cream #faf5ef), serif headings, refined spacing, subtle gradients, luxury-feel shadows, and a sophisticated premium aesthetic. Use serif fonts for headings and sans-serif for body.',
  },
];
