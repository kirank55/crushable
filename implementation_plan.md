
## Implementation Plan

---

### 1. Template-First Generation (Skeleton + Fill)

**What exists today:** templates.ts already has 4 hardcoded templates (`saas-launch`, `creator-course`, `agency-studio`, `local-services`) with `buildBlocks()` returning full HTML blocks. These are static — no AI involvement.

**Plan:**

**Phase 1 — Expand the template library to ~30-50 section skeletons**
- Restructure `templates.ts` from "full page templates" to a **section-level template registry** — each entry is one section type (hero variants, pricing tables, feature grids, testimonial layouts, FAQ accordions, CTA strips, etc.)
- Each skeleton is a `SectionTemplate` with: `id`, `category` (hero/features/pricing/cta/footer/etc.), `variant` (e.g., "split-image", "centered", "gradient-bg"), `designStyle` compatibility list, and `skeleton: string` (HTML with `{{placeholder}}` tokens for content slots like `{{headline}}`, `{{subtitle}}`, `{{features_list}}`, `{{cta_text}}`)
- Store in a new file `src/lib/section-templates.ts` — keep existing `templates.ts` for full-page presets that compose from the section registry

**Phase 2 — AI as copywriter, not coder**
- Add a new API mode `"fill-template"` in route.ts
- New prompt builder `buildTemplateFillPrompt(skeleton: string, projectContext: string, sectionRole: string)` in prompt.ts — instructs the model to return ONLY the content values for each `{{placeholder}}` as a JSON map, **not** HTML
- System prompt is minimal: "You are a conversion copywriter. Given a section template with placeholders and a product brief, return a JSON object mapping each placeholder to its value. Do not return HTML."
- Client-side: `fillTemplate(skeleton: string, values: Record<string, string>): string` — simple string replacement, runs deterministically with zero LLM variability in layout

**Phase 3 — Template selection intelligence**
- During the plan phase, after section titles are decided, add a `"select-templates"` mode where the LLM picks the best skeleton variant per section from the registry (pass available template IDs + descriptions as input, get back a JSON map of `{sectionTitle: templateId}`)
- Fallback: if no good template match exists for a section, fall back to current full-generation mode for that section only

**Phase 4 — Integration into ChatPanel flow**
- Modify `executeSectionPlan()` in ChatPanel.tsx — after planning, attempt template-first path. For each section: select template → fill with AI content → `createBlock()`. Fall back to raw generation if template fill fails or no template matches
- Add a user-visible toggle or auto-detect: "Use templates for faster generation" (enabled by default, user can override to full AI generation)

**Key advantage:** Token usage drops ~80% per section. Generation is faster and more structurally consistent. The LLM can't break layout — it only writes copy.

---

### 2. Component Composition from a Library

**What exists today:** Blocks are raw HTML strings. No component abstraction. `createBlock()` just wraps HTML with a `data-block-id`.

**Plan:**

**Phase 1 — Define a component manifest format**
- New file `src/lib/component-registry.ts`
- Each component: `{ id: string, name: string, category: string, variants: string[], props: PropDef[], render: (props) => string }`
- `PropDef`: `{ name: string, type: 'text' | 'richtext' | 'image' | 'list' | 'color' | 'link', required: boolean, default?: string }`
- `render()` is a pure function: takes props, returns `<section data-block-id="...">` HTML string — identical output format to current blocks, so **nothing downstream changes** (preview, export, import all work as-is)
- Start with 20-30 components: 3 hero variants, 3 feature grids, 2 pricing tables, 2 testimonial sections, 2 CTA blocks, 2 navbars, 2 footers, FAQ, stats bar, logo cloud, team grid

**Phase 2 — AI returns a component manifest instead of HTML**
- New API mode `"compose"` in route.ts
- New prompt builder: `buildCompositionPrompt(availableComponents: ComponentSummary[], projectContext: string, sectionPlan: string[])` — tells the model to return a JSON array: `[{componentId: "hero-split", props: {headline: "...", subtitle: "...", ctaText: "...", bgColor: "..."}}]`
- System prompt: "You are a page composer. Given a component library and a project brief, select components and fill their props. Return JSON only."
- Client-side: iterate the manifest, call each component's `render(props)` to produce blocks

**Phase 3 — Editable props UI (optional, future)**
- Since components have typed props, expose a property editor panel alongside the chat — click a section, see its props, edit inline without AI
- This is the path toward a Webflow-like direct manipulation experience
- For now, edits still go through chat (AI returns updated props JSON or falls back to raw HTML edit)

**Phase 4 — Graceful fallback**
- If the model selects a component that doesn't exist or returns malformed JSON, fall back to current raw HTML generation for that section
- Allow mixing: some sections from components, others from raw generation, coexisting in the same project

**Key advantage:** Zero HTML hallucination for component-backed sections. Props are validatable. Re-theming becomes trivial (re-render same props with different design style template). Opens the door to visual property editing.

---

### 3. Diff-Based Editing (Patch Model)

**What exists today:** Edit mode regenerates the entire section HTML. The model receives the full section and returns a completely new section. `buildUnifiedDiff()` is only used for display — the actual update is a full replacement via `onUpdateBlock(id, newHtml)`.

**Plan:**

**Phase 1 — Define a patch format**
- New type in index.ts:
  ```ts
  interface HtmlPatch {
    ops: PatchOp[];
  }
  type PatchOp = 
    | { type: 'replace', selector: string, oldText: string, newText: string }
    | { type: 'setAttribute', selector: string, attr: string, value: string }
    | { type: 'addClass', selector: string, classes: string }
    | { type: 'removeClass', selector: string, classes: string }
    | { type: 'insertAfter', selector: string, html: string }
    | { type: 'insertBefore', selector: string, html: string }
    | { type: 'remove', selector: string }
  ```
- Selectors are CSS selectors scoped to the section (e.g., `h1`, `.pricing-card:nth-child(2)`, `[data-block-id="hero"] p.subtitle`)

**Phase 2 — New API mode and prompt**
- Add mode `"patch-edit"` in route.ts
- New prompt builder: `buildPatchEditPrompt(blockHtml: string, userRequest: string)` — instructs the model to return a JSON `HtmlPatch` instead of full HTML
- System prompt explains the patch format with examples: "Return surgical changes as JSON patch operations. Use CSS selectors to target elements. For text changes, use 'replace' with exact oldText/newText. For style changes, use addClass/removeClass."
- Non-streaming response (patches are small, typically <500 tokens)

**Phase 3 — Patch application engine**
- New file `src/lib/patch.ts`
- `applyPatch(html: string, patch: HtmlPatch): string` — uses DOMParser + querySelector to apply each op, serializes back to string
- Validation: if any selector doesn't match, or if the result has structural issues, **fall back to full edit mode** (current behavior) — this is the critical safety net

**Phase 4 — Integration into ChatPanel**
- For edit requests, try patch mode first. If the patch applies cleanly, use it. If it fails validation, silently retry with full edit mode
- Show the patch operations in chat as a human-readable changelog: "Changed heading from X to Y", "Added class `bg-blue-600` to CTA button"
- Token savings: ~90% for small edits (button color change goes from ~2000 tokens to ~100)

**Key advantage:** Small edits don't risk accidentally breaking unrelated parts of the section. Faster, cheaper, and preserves user's prior customizations.

---

### 4. Parallel Section Generation

**What exists today:** Sections are generated sequentially in a `for` loop with a 300ms delay between each. Each call includes the full section map for cross-referencing, meaning sections are already **contextually independent** — they just need to know the section map, not the actual HTML of other sections.

**Plan:**

**Phase 1 — Refactor `executeSectionPlan()` for concurrency**
- After the plan phase produces `PlannedSection[]`, instead of a sequential loop, launch all `generateSection()` calls in parallel using `Promise.allSettled()`
- Each section already receives the full section map (titles + IDs) for anchor link context — this doesn't depend on other sections being generated first
- Keep existing prompt construction per section (identical to current)

**Phase 2 — Ordered block insertion despite out-of-order completion**
- Pre-allocate block slots: before generation starts, create placeholder entries in the blocks array with `{id: plannedId, label: title, html: '', visible: false}` for each planned section
- As each parallel request completes, update the corresponding slot's HTML and set `visible: true`
- This preserves correct ordering (nav → hero → features → ... → footer) regardless of which section finishes first

**Phase 3 — Streaming progress UI**
- Update `ChatPanel` progress messages to show a parallel tracker: "Building 6 sections... ✓ Nav ✓ Hero ⟳ Features ⟳ Pricing ✓ Testimonials ⟳ Footer"
- Each completion updates the tracker message and triggers a preview refresh
- User sees sections "pop in" to the preview as they complete

**Phase 4 — Concurrency controls**
- Add a configurable concurrency limit (default: 3-4 parallel requests) to avoid rate limiting from OpenRouter — use a simple semaphore pattern
- If any section fails, retry it once individually. If it fails again, show error and let user regenerate that section manually
- Keep the sequential fallback path for free-tier models that aggressively rate-limit

**Phase 5 — API route adjustment**
- No changes needed to the API route — each section is already an independent request
- If using `auto:free` with fallback chain, each parallel request independently falls through the chain (this already works)

**Key advantage:** A 6-section page currently takes ~6× single-section time. With 3-way parallelism, it drops to ~2×. With full parallelism, it's ~1× (bottlenecked by the slowest section). Massive UX improvement.

---

### 5. Retrieval-Augmented Generation (RAG over Examples)

**What exists today:** The model relies entirely on its parametric knowledge + the design style prompt fragment. No reference examples are provided.

**Plan:**

**Phase 1 — Build a curated example library**
- New file `src/lib/examples.ts` (or a `src/data/examples/` directory with JSON files)
- Each example: `{ id: string, industry: string, sectionType: string, designStyle: string, tags: string[], html: string, description: string }`
- Curate 50-100 high-quality section examples manually: hand-pick the best outputs from Crushable usage, clean up, tag by industry (SaaS, ecommerce, agency, health, education, etc.) and section type (hero, features, pricing, etc.)
- These are stored statically in the bundle (no external DB needed)

**Phase 2 — Retrieval at generation time**
- New utility `src/lib/rag.ts`: `retrieveExamples(query: { industry?: string, sectionType: string, designStyle: string, keywords?: string[] }, limit: number): Example[]`
- Simple scoring: exact match on sectionType (+5), designStyle match (+3), industry match (+3), keyword overlap (+1 each)
- No vector DB needed at this scale — brute-force scoring over 50-100 examples is instant
- Returns top 2-3 most relevant examples

**Phase 3 — Inject examples into prompts**
- Modify `buildNewPrompt()` and section generation prompt construction to accept optional `referenceExamples: Example[]`
- Add to prompt: "Here are reference examples of high-quality sections similar to what you're building. Use them as inspiration for layout patterns and design quality, but create unique content for this project:\n\n---EXAMPLE 1---\n{html}\n---END---"
- Cap injected example HTML at ~2000 tokens total (truncate large examples) to avoid context bloat

**Phase 4 — Example feedback loop (future)**
- When a user exports or saves a project, offer "Save sections to example library" — approved sections get added to the local example store
- This creates a virtuous cycle: better examples → better generation → more saved examples
- Store custom examples in localStorage under `crushable:examples`

**Phase 5 — Smart retrieval from project context**
- During the plan phase, extract industry/vertical from the product description (e.g., "We're a fitness app" → industry: "health/fitness")
- Use this to bias example retrieval toward relevant industries throughout the entire generation session

**Key advantage:** Grounds the model in proven, tested designs. Fixes the "every generation looks generically the same" problem. Especially impactful for free/weaker models that benefit more from few-shot examples.

---

### 6. Iterative Refinement Loop (Self-Critique)

**What exists today:** `runGenerationValidation()` in ChatPanel runs after all sections are built. It calls `validateGeneratedHtml()` (structural checks: duplicate navs, broken anchors, missing backgrounds, placeholder images) and the API `"validate"` mode (LLM reviews full HTML for issues). Results are shown as a chat message. **But no fixes are applied automatically.**

**Plan:**

**Phase 1 — Automated fix loop after validation**
- After `runGenerationValidation()` returns issues, instead of just displaying them, categorize issues into auto-fixable vs. manual:
  - **Auto-fixable:** broken anchor links (fix href), missing background classes (add `bg-white`), placeholder images (replace with proper placeholder service URL), missing smooth scroll, duplicate navbar removal
  - **Manual/AI-fixable:** "hero section has too much whitespace", "CTA text is generic", "color scheme inconsistent"
- For auto-fixable: apply deterministic fixes directly in validate.ts → new function `autoFixIssues(blocks: Block[], issues: ValidationIssue[]): Block[]`
- For AI-fixable: batch them into a single edit prompt per affected section

**Phase 2 — LLM critique pass**
- Add a new API mode `"critique"` — different from `"validate"` 
- `buildCritiquePrompt(sectionHtml: string, sectionRole: string, designStyle: string)` — asks the model to score the section on: visual appeal (1-10), copy quality (1-10), conversion potential (1-10), mobile readiness (1-10), and return specific improvement suggestions as JSON
- Run this per-section (parallelizable) rather than on the full page — more actionable feedback
- Only trigger for sections scoring below a threshold (e.g., any dimension < 6)

**Phase 3 — Auto-refinement cycle**
- For sections that score below threshold, automatically send an edit request with the critique feedback as the prompt
- Cap at 1 refinement pass to avoid infinite loops and excessive API usage
- Show in chat: "Refining hero section (visual appeal: 5/10 → improving layout spacing)..."
- After refinement, re-validate to confirm improvement (but don't loop again)

**Phase 4 — Configurable refinement aggressiveness**
- Add a setting in `SettingsModal`: "Auto-refinement" with options: Off / Light (structural fixes only) / Full (structural + AI critique + auto-fix)
- Default: Light (fast, no extra API calls, just deterministic fixes)
- Store in `crushable:refinementLevel` in localStorage

**Phase 5 — Accessibility and SEO critique (future)**
- Extend critique prompt to check: alt text on images, heading hierarchy (h1 → h2 → h3), color contrast warnings, semantic HTML usage, meta description suggestions
- These are high-value checks that the current validation doesn't cover

**Key advantage:** First-draft quality significantly improves without user effort. Structural issues (broken links, missing backgrounds) get fixed silently. The model's own output gets a "second pair of eyes" review, catching issues that slip through single-pass generation.

---

## Recommended Implementation Order

| Priority | Feature | Why this order |
|----------|---------|---------------|
| **1st** | **Parallel Section Generation** | Biggest UX win, smallest code change. Refactor one loop in ChatPanel + add placeholder slots. No new API modes, no new prompts. |
| **2nd** | **Iterative Refinement Loop** | Builds on existing validation infrastructure. Phase 1 (auto-fix) needs zero API calls. Immediately improves output quality. |
| **3rd** | **Diff-Based Editing** | Reduces edit cost dramatically. Independent of other features. New API mode + patch engine. |
| **4th** | **Template-First Generation** | Requires building the section template library (content work). Once templates exist, the AI integration is straightforward. |
| **5th** | **RAG over Examples** | Requires curating the example library first. Retrieval logic is simple but the data curation is ongoing work. |
| **6th** | **Component Composition** | Most ambitious. Requires the component registry, render functions, and a new composition flow. Benefits compound with templates (components can back templates). |

Features 1-3 are **independent** and can be developed in parallel by different contributors. Features 4-6 have light dependencies (templates → components share structure; RAG examples can come from template/component outputs).