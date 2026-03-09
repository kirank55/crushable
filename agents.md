# Crushable Project Guide

## What This Project Is

an AI-assisted multi-page project builder **Crushable**.

The product lets a user:

- create a new multi-page project from scratch,
- describe the product or business in chat,
- generate a section plan,
- stream new sections into the page,
- edit individual sections conversationally,
- preview the result live,
- inspect and directly edit the generated HTML,
- save project history locally in the browser,
- export a self-contained HTML file.

The app is mostly client-side. It stores project data in `localStorage` and uses a single server route to proxy requests to OpenRouter for LLM generation.

## High-Level Product Flow

The intended user workflow is:

1. Open the home page and start a blank project.
2. Enter optional project details such as brand, hero title, subtitle, and CTA. atleast 50 characters required details is product description.
3. Generate a detailed multi-page project plan.
4. Accept the plan and build sections one by one through the chat workflow.
5. Select a section from the preview or section list and ask for targeted edits.
6. Save versions, inspect code, import/export HTML, or restore earlier output.

There are two important modes inside the builder:

- **Full-page generation mode**: the chat flow plans and creates multiple sections for the project.
- **Section edit mode**: the chat targets one selected section and asks the model to change only that block.

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **UI**: React 19 + TypeScript
- **Styling**: Tailwind CSS v4 for the app shell, Tailwind CDN for exported/generated pages
- **Icons**: Lucide React in the app, Lucide CDN in generated pages
- **Persistence**: browser `localStorage`
- **AI provider**: OpenRouter
- **Packaging utility**: `jszip` is installed, though the core export path currently writes a single HTML file

## Top-Level Structure

### App entry points

- `src/app/page.tsx`: home screen with recent projects and settings access.
- `src/app/project/[id]/page.tsx`: main builder experience for both existing projects and `/project/new`.
- `src/app/api/generate/route.ts`: server route that prepares prompts and streams model output back to the client.
- `src/app/layout.tsx`: root app layout.
- `src/app/globals.css`: global styling for the application shell.

### Main UI components

- `src/components/ChatPanel.tsx`: chat workflow, plan generation, section generation, section editing, message history, and streamed model responses.
- `src/components/PreviewPanel.tsx`: iframe-based live preview, code view, console capture, and preview-to-editor block selection.
- `src/components/SectionPanel.tsx`: section list, ordering, duplicate/delete actions, and preview visibility toggling.
- `src/components/Toolbar.tsx`: global builder actions such as save, import, export, view mode switching, project rename, and settings access.
- `src/components/VersionsPanel.tsx`: version browsing and restore UI.
- `src/components/SettingsModal.tsx`: API key and model selection.
- `src/components/HelpModal.tsx`: user help/instructions.

### State and utilities

- `src/hooks/usePageState.ts`: central client-side project state manager.
- `src/lib/storage.ts`: persistence helpers for settings and projects.
- `src/lib/openrouter.ts`: OpenRouter request logic and streaming parser.
- `src/lib/prompt.ts`: system prompt construction and mode-specific prompt builders.
- `src/lib/blocks.ts`: block creation, label derivation, and duplication helpers.
- `src/lib/import.ts`: import parsing for Crushable-generated HTML.
- `src/lib/export.ts`: export generation for standalone HTML files.
- `src/lib/logger.ts`: structured console logging.
- `src/types/index.ts`: shared app types, design styles, and model metadata.

## Core Data Model

The entire builder is organized around a small set of core types.

### Block

A `Block` is a single section within the project.

Fields:

- `id`: logical block identifier, usually tied to the section's `data-block-id`
- `label`: human-friendly name shown in the UI
- `html`: full HTML string for that section
- `visible`: optional flag used to hide sections from the preview/export path without deleting them

Important implementation detail:

- The generated HTML for every section is expected to be wrapped in a single `<section data-block-id="...">` root element.

### Project

A `Project` is the saved unit stored in browser storage.

Fields currently used by the app:

- `id`
- `name`
- `blocks`
- `versions`
- `messages`
- `designStyle`
- `updatedAt`

### Version

A `Version` stores a full snapshot of the current blocks and optional prompt metadata. Versions let the user inspect or restore earlier generated output without losing the latest working set.

### Message

The chat history stores both user and assistant messages. Messages may also include:

- a short summary,
- a detailed plan string,
- an associated `blockId`,
- a block snapshot for restore operations.

## Builder Architecture

### Builder page composition

The builder page at `src/app/project/[id]/page.tsx` composes the experience from four main pieces:

- `Toolbar`
- `ChatPanel`
- `SectionPanel`
- `PreviewPanel`

`usePageState` acts as the coordinating state layer beneath them.

The builder also manages a few cross-cutting concerns:

- redirecting `/project/new` to the actual generated project ID,
- mapping selected design style IDs to prompt text,
- converting project details into shared LLM context,
- keyboard shortcuts for save, undo, and escape-to-clear-selection,
- unsaved-change protection on browser unload.

### State ownership

`usePageState` is the main source of truth for:

- page blocks,
- selected block,
- dirty state,
- current project ID,
- project name,
- saved messages,
- design style,
- version history,
- undo stack,
- readiness/loading state.

This hook is effectively the builder's local store.

## Project Lifecycle and Persistence

### New project behavior

When the route is `/project/new`, the app creates a UUID-based project identity in memory, but it does **not** persist the project immediately.

A new project is only saved once it has meaningful content, defined by:

- at least one block,
- or saved messages,
- or saved versions,
- or a selected design style,
- or a renamed project title.

This avoids cluttering storage with empty drafts.

### Autosave model

The builder autosaves approximately 2 seconds after a dirty change if a project ID exists. Manual save is also available from the toolbar and via `Ctrl/Cmd + S`.

### Storage keys

Local persistence uses these browser keys:

- `crushable:apiKey`
- `crushable:model`
- `crushable:projects`
- `crushable:currentProjectId`

### No database

There is no application database in the current architecture. Projects live entirely in the browser. The only server-side responsibility is AI request proxying.

Implications:

- projects are browser-local,
- clearing browser storage removes saved projects,
- there is no built-in sharing or collaboration,
- deployment is operationally simple because there is no persistent backend.

## Chat and Generation Flow

`src/components/ChatPanel.tsx` contains most of the product's AI workflow logic.

### Main responsibilities of ChatPanel

- maintain the interactive chat UI,
- infer whether a user message is asking for a new section, an edit, or a full-page generation flow,
- request a plan before multi-section generation,
- stream model output into the UI,
- convert model responses into blocks and summaries,
- persist chat history back to the builder state.

### Intent handling

The chat code distinguishes among several request types:

- **edit intent**: modifies the selected section when blocks already exist,
- **multi-section intent**: triggers page planning/build flow,
- **explanation intent**: explains previous changes instead of regenerating content,
- **new section intent**: creates a new block.

### Planning flow

The codebase supports two planning modes in practice:

- a simple JSON-array section planner,
- a more detailed product-specific plan generator.

The API route includes explicit support for `plan` and `detailed-plan` modes. The detailed planner is tailored around brand, product description, style, hero copy, and CTA.

### Response contract

For normal generation and edit requests, the system prompt requires the model to return output in this format:

```text
---SUMMARY---
<brief explanation>
---HTML---
<section HTML>
```

`parseResponse` in `src/lib/prompt.ts` extracts those two parts. The HTML becomes the block content. The summary is used in chat history and version/change explanation flows.

## AI Integration

### API route

`src/app/api/generate/route.ts` is the single server endpoint for generation.

It:

- accepts request payloads from the client,
- resolves the API key source,
- selects the correct prompt mode,
- calls OpenRouter,
- converts the SSE stream into plain text chunks,
- returns a streamed text response to the client.

### API key resolution

The route prefers:

1. a client-provided key from settings if it looks valid,
2. otherwise `OPENROUTER_API_KEY` from the environment.

If neither is available, the route returns a `401` with setup guidance.

### Prompt shaping

`src/lib/prompt.ts` builds prompts with two important context layers:

- **design system instruction** from the selected style,
- **project context** assembled from brand/product/hero/CTA details.

That means the model is not just told to build HTML. It is also told:

- what kind of visual system to follow,
- what brand/product it is building for,
- how to reuse hero text correctly,
- how to keep other sections section-specific.

### Free model fallback strategy

`src/lib/openrouter.ts` defines a free-model fallback chain for `auto:free`:

1. `stepfun/step-3.5-flash:free`
2. `z-ai/glm-4.5-air:free`
3. `nvidia/nemotron-3-nano-30b-a3b:free`
4. `google/gemma-3-27b-it:free`

If a specific premium model is selected, the system tries that model directly. If auto mode is used, it iterates through the free list until one succeeds.

### Streaming model output

OpenRouter returns an SSE stream. `parseSSEStream` reads the stream, extracts `delta.content`, and emits plain text chunks. The API route then forwards those chunks to the client as a regular text stream.

## Preview and Editing Model

`src/components/PreviewPanel.tsx` is more than a static preview. It is a two-way bridge between generated HTML and the builder UI.

### Preview responsibilities

- render visible blocks inside an iframe,
- inject Tailwind and Lucide runtime support,
- capture iframe console output and errors,
- support preview/code/console modes,
- let users click a section in the iframe to select it in the builder,
- focus and highlight selected blocks inside the preview.

### Iframe communication

The preview uses `postMessage` in both directions:

- preview to parent: section selection events and console messages,
- parent to preview: focus/highlight/clear-selection commands.

This is the mechanism that makes click-to-edit work from the live rendered page.

### Code editing mode

In code view, the user can edit the assembled HTML directly. On save, the builder attempts to parse the edited markup back into sections using `parseImportedHtml`.

If parsing finds no valid Crushable sections, the system falls back to treating the whole result as a single block.

## Sections and Block Management

`src/components/SectionPanel.tsx` gives the user structural control over the landing page.

Supported actions:

- select a section,
- drag and reorder sections,
- duplicate a section,
- delete a section,
- toggle whether a section is visible in preview/export.

### Smart insertion rules

`addBlockSmart` in `usePageState` applies layout-aware rules when adding new blocks:

- nav/header-like blocks go to the top,
- footer-like blocks go to the bottom,
- other sections are inserted before an existing footer if one exists,
- otherwise they are appended.

This keeps common page structure mostly sane without requiring every generation step to fully manage ordering.

### Duplication model

Duplicated blocks get a unique derived ID such as `hero-copy` or `hero-copy-2`. The duplicated HTML is rewritten so the embedded `data-block-id` matches the new block identity.

## Versioning and Undo

The builder has two different recovery mechanisms.

### Undo stack

`usePageState` maintains an in-memory undo stack capped at 20 snapshots. This is for short-term interaction recovery during the current session.

### Version snapshots

Version history is a durable project-level record saved with the project. A version snapshot stores:

- a label,
- timestamp,
- copied block array,
- optional prompt metadata.

### Important implementation detail

The hook keeps a separate `latestBlocksRef` so browsing older versions does not overwrite the true current working state. That prevents accidental corruption when a user previews an old version and then returns to the latest content.

## Import and Export

### Export

`src/lib/export.ts` produces a single standalone HTML document containing:

- a document wrapper,
- Google Fonts for Inter,
- Tailwind CDN,
- Lucide CDN,
- all visible section HTML.

Hidden sections are not exported.

### Import

`src/lib/import.ts` only supports HTML that contains sections in the Crushable block format:

```html
<section data-block-id="...">...</section>
```

The toolbar explicitly warns users that importing arbitrary HTML from other tools may not work correctly.

## Design Style System

The app ships with a fixed set of design styles in `src/types/index.ts`:

- Professional
- Playful
- Minimal
- Bold & Dark
- Elegant

Each style includes:

- a stable ID,
- a label,
- a short description,
- an emoji for UI display,
- a prompt fragment that instructs the LLM how to design the page.

This style selection is a prompt-time system rather than a post-generation theming engine. In other words, the selected style influences what the model generates, not just how the app previews it.

## Logging and Debugging

`src/lib/logger.ts` wraps `console.log` and `console.error` with a consistent `[Crushable]` prefix and ISO timestamps.

The logger is used across:

- UI actions,
- storage operations,
- API requests,
- prompt emission,
- stream lifecycle events,
- errors.

This is useful because the app relies heavily on client-side state transitions and streamed AI interactions, both of which are easier to debug with structured logs.

## Constraints and Assumptions in the Current Codebase

These are the practical assumptions the current implementation makes:

- generated/imported sections are rooted in `<section data-block-id="...">`,
- the project builder is organized around reusable HTML sections rather than route-level React pages,
- saved projects are per-browser rather than shared across devices,
- the generated output is HTML-first rather than React component-first,
- the AI contract is strict about response shape and section wrapping,
- preview interaction depends on iframe scripting and block IDs remaining stable.

## Good Extension Points

If someone wants to extend the project, the cleanest places are:

### Add new design styles

Update `DESIGN_STYLES` in `src/types/index.ts` and expose the new option in the UI.

### Improve import support

Expand `parseImportedHtml` to recognize more structures or provide an import normalization step.

### Add backend persistence

Replace or supplement `src/lib/storage.ts` with server-backed project storage while keeping `usePageState` as the consumer API.

### Add collaboration or sharing

This would require introducing project persistence beyond `localStorage` plus a shareable project identifier model.

### Add richer generation modes

The current `/api/generate` route already supports multiple modes. New workflows can fit naturally by adding another mode, prompt builder, and client-side chat branch.

## File-by-File Starting Points for a New Contributor

If you are new to the codebase, the fastest way to understand it is to read files in this order:

1. `src/app/project/[id]/page.tsx`
2. `src/hooks/usePageState.ts`
3. `src/components/ChatPanel.tsx`
4. `src/components/PreviewPanel.tsx`
5. `src/app/api/generate/route.ts`
6. `src/lib/prompt.ts`
7. `src/lib/openrouter.ts`
8. `src/lib/storage.ts`
9. `src/types/index.ts`

That sequence moves from product shell to local state, then into generation behavior, then into the server/LLM boundary, and finally into the shared utilities.

## Summary

Crushable is an AI multi-page project builder centered on a simple idea: each project is composed from HTML section blocks, and the app uses a chat-driven workflow to plan, generate, edit, preview, version, and export those blocks.

Its architecture is intentionally lightweight:

- browser-local project storage,
- one server generation endpoint,
- a prompt-driven style system,
- iframe-based preview interaction,
- block-oriented editing and versioning.

That makes the project reasonably easy to extend, as long as new work respects the core contract that the project is composed of stable section blocks with `data-block-id` markers.