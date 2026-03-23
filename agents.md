# Crushable Agent Guide

## Purpose

Crushable is an AI-assisted landing page builder. The app lets a user describe a product, generate a plan, build a multi-section page, edit individual sections conversationally, edit specific elements from the live preview, inspect/export the generated HTML, and restore earlier versions.

This guide is for coding agents working inside the repo. It is intentionally practical: where state lives, which files matter, what invariants must be preserved, and which parts of the codebase have drifted from the older architecture.

## What The App Actually Does Today

The current product is no longer just "chat returns one section at a time".

Important current behaviors:

- The builder starts with a setup flow in `ChatPanel` that collects project details and auto-selects a design style.
- The generation pipeline supports multiple strategies, not just raw HTML generation:
  - `hybrid`
  - `template-first`
  - `component-first`
  - `html-only`
- The app can ask the model for:
  - full section HTML,
  - section plans,
  - detailed landing page plans,
  - template fills,
  - template selection,
  - component composition,
  - JSON patch edits,
  - critique scores,
  - validation feedback,
  - style selection,
  - element-only HTML edits.
- The preview supports block selection and element selection through iframe `postMessage`.
- The code view lets users directly edit assembled section HTML and then reparse it back into block data.

If you are changing the builder, assume the product is "block-oriented HTML generation with multiple refinement paths", not a simple single-prompt chat toy.

## Core Product Model

### Block

A `Block` is the unit of generation, preview, saving, import, export, versioning, and editing.

Fields:

- `id`
- `label`
- `html`
- `visible`

Non-negotiable block invariant:

- each block is expected to be rooted in a single `<section ...>` element
- the root should carry `data-block-id`
- the root `id` and `data-block-id` should stay aligned whenever possible

Breaking those assumptions will cause selection, anchor repair, import/export, validation, and update flows to degrade.

### Project

Projects are browser-local and stored in `localStorage`. There is no database.

Persisted fields currently used:

- `id`
- `name`
- `blocks`
- `versions`
- `messages`
- `designStyle`
- `updatedAt`

There are also type-level fields like `theme` and `status`, but the active builder flow is centered on the fields above.

### Message

Messages are not just display text. They are part of builder state and may contain:

- `summary`
- `plan`
- `blockId`
- `blocksSnapshot`
- `timestamp`

Those snapshots power restore/checkpoint behavior inside chat.

## Main Runtime Flow

### 1. Builder page

`src/app/project/[id]/page.tsx` is the orchestration layer.

It wires together:

- `usePageState`
- `Toolbar`
- `ChatPanel`
- `PreviewPanel`
- `VersionsPanel`
- `SettingsModal`
- `HelpModal`

It also owns:

- `/project/new` redirect behavior
- template application from `?template=...`
- project detail -> prompt context assembly
- auto project naming
- keyboard shortcuts
- before-unload protection
- preview element-edit requests
- code-view save -> `parseImportedHtml` -> block reconstruction

Start here when you need the real top-level behavior.

### 2. State layer

`src/hooks/usePageState.ts` is the source of truth for the builder.

It owns:

- blocks
- selected block
- current project id
- dirty state
- project name
- versions
- current version index
- design style
- undo stack
- persisted chat messages
- ready/loading state

Important behaviors:

- new projects are created in memory first and only saved once they have meaningful content
- autosave runs after dirty changes
- version browsing is isolated from the latest working state via `latestBlocksRef`
- undo is in-memory only
- version snapshots are durable
- `addBlockSmart` applies layout-aware insertion rules

If something feels like "global page state", it probably belongs here.

### 3. Chat and generation

`src/components/ChatPanel.tsx` is the most complex file in the app.

It currently handles:

- setup/details capture
- design-style selection
- intent detection
- multi-section planning
- section-by-section generation
- edit flows
- explanation flows
- validation and auto-fix flows
- patch generation/application
- template-first generation
- component-first generation
- message persistence
- cancellation via `AbortController`
- progress/status display for concurrent generation

Do not assume older docs about `ChatPanel` are complete. Read the file before making changes there.

### 4. Preview and editing bridge

`src/components/PreviewPanel.tsx` is both a renderer and an editor bridge.

Responsibilities:

- render visible blocks inside an iframe
- inject Tailwind CDN and Lucide
- intercept console output from generated code
- support preview/code/console modes
- highlight selected blocks
- support block selection from preview
- support element selection via Ctrl/Cmd+Click in edit mode
- provide direct code editing for assembled HTML

Important implication:

- preview interactions depend on stable block ids and `<section data-block-id="...">` roots

### 5. AI route

`src/app/api/generate/route.ts` is the single server route.

It selects prompts and forwards requests to OpenRouter for modes including:

- `new`
- `edit`
- `element-edit`
- `plan`
- `detailed-plan`
- `style-select`
- `fill-template`
- `select-templates`
- `compose`
- `patch-edit`
- `critique`
- `validate`

When adding a new generation mode, the natural place is:

1. prompt builder in `src/lib/prompt.ts`
2. route branch in `src/app/api/generate/route.ts`
3. client call site in `ChatPanel` or `BuilderPage`

## Key Supporting Libraries

### Prompt construction

`src/lib/prompt.ts`

Contains:

- system prompt builders
- edit/new prompt builders
- detailed planning prompt builders
- element-edit prompt builders
- validation/style-select/template/patchedit prompts
- response parsers

Critical contract:

- normal section generation expects:

```text
---SUMMARY---
...
---HTML---
<section ...>...</section>
```

Element edit mode is different:

- it should return only the updated element HTML, not a wrapped summary/html pair

### Generation helpers

`src/lib/generation.ts`

Contains helper utilities for:

- template catalogs
- component catalogs
- section maps
- section generation prompts
- concurrency-limited execution
- progress formatting

### Validation

`src/lib/validate.ts`

The app validates assembled HTML for:

- duplicate navigation
- duplicate ids
- duplicate block ids
- broken anchors
- placeholder/missing images
- missing section backgrounds
- awkward hero full-height balance
- cramped social-proof grids
- missing smooth scrolling

It also includes auto-fix helpers, so not every issue requires a full regeneration.

### Patch edits

`src/lib/patch.ts`

Supports surgical DOM-like patch operations such as:

- `replace`
- `setAttribute`
- `addClass`
- `removeClass`
- `insertAfter`
- `insertBefore`
- `remove`

If you change patch behavior, preserve the invariant that patch application operates on a root section fragment.

### Storage

`src/lib/storage.ts`

Local storage keys currently include:

- `crushable:apiKey`
- `crushable:model`
- `crushable:generationStrategy`
- `crushable:refinementLevel`
- `crushable:projects`
- `crushable:currentProjectId`

This is important because older docs may mention only API key/model/project keys.

## Current UI Pieces

### `Toolbar`

`src/components/Toolbar.tsx`

Current toolbar behavior includes:

- project rename
- save state display
- settings/help
- version drawer
- chat hide/show
- preview/code/console tabs
- desktop/mobile preview toggle
- preview refresh
- element edit mode toggle
- import/export
- open preview in new tab

### `SectionPanel`

`src/components/SectionPanel.tsx`

Supports:

- section selection
- drag reorder
- duplicate
- delete
- visibility toggle

It also derives a tiny structural thumbnail from heading/paragraph/action counts.

### `VersionsPanel`

Shows durable saved snapshots. Keep the distinction clear:

- undo = temporary session history
- versions = named durable project history

## Important Invariants

Keep these true unless you are intentionally redesigning the whole system.

- Every generated section should be a single `<section>` root.
- Root `data-block-id` must remain stable across edits.
- Root `id` should remain unique across the full page.
- Anchor links should resolve to actual section ids.
- Hidden blocks should stay excluded from preview/export.
- Import/export flows assume HTML-first sections, not React component serialization.
- Version browsing must not overwrite the true latest working block state.
- Message history should remain persistable and restorable.

## Known Sharp Edges

These are the places agents are most likely to break something accidentally.

- `ChatPanel.tsx` is large and stateful. Read nearby helpers before changing a branch.
- `usePageState.ts` mixes autosave, undo, version browsing, and project lifecycle logic.
- `PreviewPanel.tsx` has iframe scripts embedded as strings. Small changes can break selection or console capture.
- The builder page currently imports `SectionPanel`, but the rendered layout is centered around `ChatPanel` and `PreviewPanel`. Verify the actual UI path before assuming a component is active.
- Some files contain mojibake in strings/comments from prior edits. Avoid "cleaning up" unrelated text unless needed for your task.

## Best Places To Make Common Changes

### Add a new generation mode

- `src/lib/prompt.ts`
- `src/app/api/generate/route.ts`
- caller in `src/components/ChatPanel.tsx` or `src/app/project/[id]/page.tsx`

### Change project persistence

- `src/lib/storage.ts`
- `src/hooks/usePageState.ts`

### Change section import/export behavior

- `src/lib/import.ts`
- `src/lib/export.ts`
- `src/components/PreviewPanel.tsx`
- `src/app/project/[id]/page.tsx`

### Change section identity/duplication rules

- `src/lib/blocks.ts`
- `src/hooks/usePageState.ts`
- `src/lib/validate.ts`

### Change preview click/edit behavior

- `src/components/PreviewPanel.tsx`
- `src/app/project/[id]/page.tsx`
- possibly `src/app/globals.css`

## Read Order For New Agents

If you need to get productive quickly, read files in this order:

1. `src/app/project/[id]/page.tsx`
2. `src/hooks/usePageState.ts`
3. `src/components/ChatPanel.tsx`
4. `src/components/PreviewPanel.tsx`
5. `src/app/api/generate/route.ts`
6. `src/lib/prompt.ts`
7. `src/lib/generation.ts`
8. `src/lib/validate.ts`
9. `src/lib/patch.ts`
10. `src/lib/storage.ts`
11. `src/types/index.ts`

## Guidance For Future Agents

- Prefer preserving existing block ids over regenerating them.
- When editing HTML-producing prompts, think about import, preview, validation, and export together.
- When changing the builder flow, check both chat persistence and version snapshot behavior.
- When changing preview behavior, test both block selection and element edit selection.
- When changing generation strategy logic, verify that settings storage and defaults still line up with the UI.
- If you are unsure whether the source of truth is the page component or `usePageState`, it is almost always `usePageState`.

## Summary

Crushable is a browser-local, block-based landing page builder with a surprisingly rich generation stack: strategy-driven section generation, prompt shaping, validation, patching, element-level editing, iframe preview interaction, and durable version history.

The safest mental model is:

- builder page orchestrates
- `usePageState` owns data
- `ChatPanel` owns AI workflow
- `PreviewPanel` owns rendering plus interactive editing
- `/api/generate` is the only AI server boundary

If your change preserves block-rooted section HTML and stable block identities, you are probably working with the grain of the app.
