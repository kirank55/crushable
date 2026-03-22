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

export type GenerationStrategy =
  | 'hybrid'
  | 'template-first'
  | 'component-first'
  | 'html-only';

export type RefinementLevel = 'off' | 'light' | 'full';

export interface Settings {
  apiKey: string;
  model: string;
  generationStrategy: GenerationStrategy;
  refinementLevel: RefinementLevel;
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

export interface ValidationIssue {
  type: 'error' | 'warning';
  code:
    | 'duplicate-navigation'
    | 'duplicate-id'
    | 'duplicate-block-id'
    | 'broken-anchor'
    | 'missing-image-source'
    | 'missing-background'
    | 'hero-balance'
    | 'social-proof-layout'
    | 'missing-smooth-scroll';
  message: string;
  blockId?: string;
  targetId?: string;
  href?: string;
}

export interface SectionTemplate {
  id: string;
  name: string;
  category: string;
  variant: string;
  description: string;
  designStyles: string[];
  placeholders: string[];
  skeleton: string;
  componentId?: string;
}

export interface TemplateSelection {
  sectionTitle: string;
  templateId: string;
}

export interface PlannedSectionLike {
  title: string;
  id: string;
  details?: string;
}

export interface ExampleReference {
  id: string;
  industry: string;
  sectionType: string;
  designStyle: string;
  tags: string[];
  description: string;
  html: string;
}

export interface RAGQuery {
  industry?: string;
  sectionType: string;
  designStyle: string;
  keywords?: string[];
}

export type ComponentPropType =
  | 'text'
  | 'richtext'
  | 'image'
  | 'list'
  | 'color'
  | 'link';

export interface ComponentPropDefinition {
  name: string;
  type: ComponentPropType;
  required: boolean;
  default?: string;
}

export type ComponentProps = Record<string, string | string[]>;

export interface ComponentDefinition {
  id: string;
  name: string;
  category: string;
  variants: string[];
  description: string;
  props: ComponentPropDefinition[];
  render: (props: ComponentProps) => string;
}

export interface ComponentSummary {
  id: string;
  name: string;
  category: string;
  description: string;
  variants: string[];
}

export interface ComponentManifestItem {
  componentId: string;
  props: ComponentProps;
}

export type PatchOp =
  | { type: 'replace'; selector: string; oldText?: string; newText: string }
  | { type: 'setAttribute'; selector: string; attr: string; value: string }
  | { type: 'addClass'; selector: string; classes: string }
  | { type: 'removeClass'; selector: string; classes: string }
  | { type: 'insertAfter'; selector: string; html: string }
  | { type: 'insertBefore'; selector: string; html: string }
  | { type: 'remove'; selector: string };

export interface HtmlPatch {
  ops: PatchOp[];
}

export interface SectionCritique {
  visualAppeal: number;
  copyQuality: number;
  conversionPotential: number;
  mobileReadiness: number;
  issues: string[];
  suggestedPrompt: string;
}

export type ModificationRequestKind =
  | 'section-edit'
  | 'element-edit'
  | 'multi-section-edit'
  | 'add-section'
  | 'remove-section'
  | 'global-style-edit';

export type ModificationExecutorMode =
  | 'patch'
  | 'full-html'
  | 'element-html'
  | 'remove';

export type ModificationEngineOperation =
  | { type: 'update-block'; blockId: string; html: string }
  | { type: 'insert-block'; afterBlockId?: string | null; block: Block }
  | { type: 'remove-block'; blockId: string }
  | { type: 'select-block'; blockId: string | null }
  | { type: 'set-design-style'; designStyle: string };

export interface ModificationEngineRequest {
  prompt: string;
  requestKind: ModificationRequestKind;
  selectedBlockId?: string | null;
  selectedElementSelector?: string | null;
  targetBlockIds?: string[];
  blocks: Block[];
  designStyle?: string;
  designStylePrompt?: string;
  projectContext?: string;
  apiKey?: string;
  model?: string;
}

export interface ModificationEngineResponse {
  summary: string;
  executorMode: ModificationExecutorMode;
  operations: ModificationEngineOperation[];
}

export const FREE_AUTO_MODEL = 'auto:free';
export const FREE_MODEL = 'auto:free';
export const DEFAULT_GENERATION_STRATEGY: GenerationStrategy = 'hybrid';
export const DEFAULT_REFINEMENT_LEVEL: RefinementLevel = 'light';

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
