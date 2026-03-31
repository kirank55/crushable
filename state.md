# State Management

How state flows through the Crushable app — from localStorage to React contexts to UI components.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        BuilderPage                              │
│                   (app/project/[id]/page.tsx)                   │
│                                                                 │
│  ┌──────────────┐     creates      ┌──────────────────────────┐ │
│  │ usePageState  │ ──────────────▶  │   PageStateProvider      │ │
│  │   (hook)      │                  │   (React Context)        │ │
│  └──────┬───────┘                  └──────────┬───────────────┘ │
│         │                                     │                 │
│         │ delegates                           │ consumed by     │
│         │ persistence                         │                 │
│         ▼                          ┌──────────┼──────────┐      │
│  ┌──────────────┐                  │          │          │      │
│  │useProject-   │                  ▼          ▼          ▼      │
│  │  Storage     │              Toolbar   PreviewPanel  ChatCtx  │
│  │   (hook)     │              VersionsPanel    useChatGen      │
│  └──────┬───────┘                                │              │
│         │                                        │              │
│         ▼                               ┌────────▼────────┐    │
│  ┌──────────────┐                       │  ChatProvider    │    │
│  │ localStorage  │                       │  (React Context) │    │
│  │  (lib/storage)│                       └────────┬────────┘    │
│  └──────────────┘                                │              │
│                                     ┌────────────┼──────┐       │
│                                     ▼            ▼      ▼       │
│                                ChatInput  ChatMsgList  GenProg  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Data Types

Defined in [`types/index.ts`](src/types/index.ts):

| Type | Purpose |
|------|---------|
| `Block` | A single HTML section (`id`, `label`, `html`, `visible`) |
| `Version` | A snapshot of all blocks at a point in time |
| `Project` | Top-level entity persisted to localStorage |
| `Message` | A chat message (user or assistant) |

---

## Layer 1: Persistence — `useProjectStorage`

**File:** [`hooks/useProjectStorage.ts`](src/hooks/useProjectStorage.ts)

Handles all localStorage I/O. The rest of the app never touches `localStorage` directly for project data.

### Responsibilities

- **Resolve project on mount** — Given a route ID (`uuid`, `"new"`, or `undefined`), it figures out what to load:
  - `/project/<uuid>` → load that project
  - `/project/new` → create a blank project with a fresh UUID
  - No ID → try loading the last-used project
- **Save** — Writes the full `ProjectSnapshot` (name, blocks, versions, messages) to localStorage. Skips empty projects.
- **Persist messages** — Dedicated fast path to save messages immediately after AI generation (doesn't wait for debounced auto-save).
- **Load external** — Switch to an entirely different project (e.g. from a project list).

### Public API

```ts
{
  projectId: string | null;     // current project UUID
  isReady: boolean;             // true once hydration completes
  loadedData: LoadedProjectData | null;
  save(snapshot): boolean;
  persistMessages(messages, snapshot): void;
  loadExternal(project): LoadedProjectData;
}
```

---

## Layer 2: Editing State — `usePageState`

**File:** [`hooks/usePageState.ts`](src/hooks/usePageState.ts)

The main state hook. Owns all `useState` calls for the editing session. Consumes `useProjectStorage` internally.

### State it manages

| State | Type | Purpose |
|-------|------|---------|
| `blocks` | `Block[]` | The current list of HTML sections |
| `selectedBlockId` | `string \| null` | Which block the user selected |
| `isDirty` | `boolean` | Unsaved changes flag |
| `projectName` | `string` | Editable project name |
| `versions` | `Version[]` | All saved version snapshots |
| `currentVersionIndex` | `number \| null` | Which version is being viewed |
| `undoStack` | `Block[][]` | Up to 20 undo snapshots |
| `savedMessages` | `Message[]` | Chat history persisted with the project |

### Key behaviors

- **Hydration** — When `storage.isReady` flips to `true`, loads state from `storage.loadedData`.
- **Auto-save** — Debounced (2s). Any time `isDirty` becomes `true`, a timer starts. If no new changes within 2s, it calls `storage.save()`.
- **Undo** — Every mutating action (`addBlock`, `updateBlock`, `removeBlock`, etc.) pushes a snapshot to the undo stack before making the change.
- **Version snapshots** — `createVersionSnapshot()` copies the current blocks into a new `Version` entry. `loadVersion()` swaps blocks to an older version while keeping `latestBlocksRef` pointing to the real latest.
- **Ref workaround** — Uses `blocksRef` and `latestBlocksRef` to access current block state inside callbacks without stale closures.

### Block operations

All follow the same pattern: `pushUndo → mutate → markEdited`

| Action | What it does |
|--------|-------------|
| `addBlock` | Append a block |
| `addBlockSmart` | Insert navs at top, footers at bottom, others before footer |
| `updateBlock` | Replace HTML of a specific block |
| `insertBlockAfter` | Insert after a specific block ID |
| `duplicateBlock` | Clone a block with a new ID |
| `removeBlock` | Remove by ID |
| `replaceAllBlocks` | Replace the entire blocks array (used after full-page generation) |
| `reorderBlocks` | Accept a reordered array (drag-and-drop) |
| `toggleBlockVisibility` | Show/hide a block |

---

## Layer 3: React Contexts

### PageStateContext

**File:** [`context/PageStateContext.tsx`](src/context/PageStateContext.tsx)

A thin context wrapper — it only defines the `PageStateContextValue` interface and exports the raw `Provider`. It does **not** contain any logic.

**Provided at:** `BuilderPage` (the `page.tsx` route component)

**What it exposes:** A subset of `usePageState` return values — only the state and actions that child components need. Notably, lower-level operations like `updateBlock`, `removeBlock`, `selectBlock`, `undo`, etc. are **not** exposed via context (they're only used internally or will be added when needed).

**Consumed by:**
| Consumer | What it reads |
|----------|--------------|
| `Toolbar` | `projectName`, `isDirty`, `handleSave`, `handleRename`, `toggleVersions` |
| `PreviewPanel` | `blocks` |
| `VersionsPanel` | `versions`, `currentVersionIndex`, `loadVersion`, `restoreCurrentBlocks`, `closeVersions`, `versionsOpen` |
| `ChatContext` | `blocks`, `savedMessages`, `setSavedMessages` |
| `useChatGeneration` | `savedMessages`, `setSavedMessages`, `replaceAllBlocks`, `createVersionSnapshot`, `addBlockSmart` |

### ChatContext

**File:** [`context/ChatContext.tsx`](src/context/ChatContext.tsx)

A **provider + logic** context. Unlike `PageStateContext`, the `ChatProvider` component contains business logic:
- Reads from `PageStateContext` (blocks, messages)
- Wires up `useChatGeneration` (the generation hook)
- Wires up `useAutoStartGeneration` (auto-trigger on first load)
- Implements `handleSend` with intent detection (full page vs single section)

**Provided at:** `ChatPanel` component

**What it exposes:**

```ts
{
  messages: Message[];          // chat history
  input: string;                // current input field value
  setInput: (v: string) => void;
  isLoading: boolean;           // generation in progress
  phase: GenerationPhase;       // 'idle' | 'planning' | 'building' | 'done' | 'error'
  sectionProgress: SectionProgress[];  // per-section build status
  statusText: string;           // human-readable status
  handleSend: () => void;       // send the current input
  handleStop: () => void;       // abort generation
  hasBlocks: boolean;           // shortcut for blocks.length > 0
}
```

**Consumed by:**
| Consumer | What it reads |
|----------|--------------|
| `ChatInputArea` | `input`, `setInput`, `isLoading`, `handleSend`, `handleStop`, `hasBlocks` |
| `ChatMessageList` | `messages`, `isLoading`, `sectionProgress` |
| `GenerationProgress` | `sectionProgress`, `phase`, `isLoading`, `statusText` |

---

## Layer 4: Generation Hooks

### `useChatGeneration`

**File:** [`hooks/useChatGeneration.ts`](src/hooks/useChatGeneration.ts)

The AI generation orchestrator. Manages the async lifecycle of calling `/api/generate`.

**Two generation modes:**

1. **`generateFullPage(prompt)`** — Plan → build all sections concurrently (max 3 at a time via semaphore) → commit
2. **`generateSingleSection(prompt)`** — Build one section → add it via `addBlockSmart`

**State it owns:** `isLoading`, `phase`, `sectionProgress`, `statusText`, `abortRef`

**Reads from PageStateContext:** `savedMessages`, `setSavedMessages`, `replaceAllBlocks`, `createVersionSnapshot`, `addBlockSmart`

### `useAutoStartGeneration`

**File:** [`hooks/useAutoStartGeneration.ts`](src/hooks/useAutoStartGeneration.ts)

A one-shot effect hook. When a project loads with exactly 1 user message and 0 blocks (meaning the user typed a prompt on the homepage and was redirected), it automatically fires `generateFullPage`. Uses a ref guard to fire only once.

---

## Data Flow: Full Page Generation

```
User types prompt → handleSend() in ChatContext
  │
  ├── Detects full-page intent (regex) or no blocks exist
  │
  ▼
generateFullPage(prompt) in useChatGeneration
  │
  ├── 1. Append user Message → onMessagesChange (persists via PageState)
  ├── 2. POST /api/generate {mode: 'plan'} → receive section list
  ├── 3. For each section (max 3 concurrent):
  │      POST /api/generate {mode: 'new'} → receive HTML
  │      Update sectionProgress state
  ├── 4. onReplaceAllBlocks(validBlocks) → PageState sets blocks
  ├── 5. onVersionCreated(prompt) → PageState snapshots version
  └── 6. Append assistant Message → onMessagesChange
         │
         ▼
       isDirty = true → auto-save timer (2s) → localStorage
```

---

## Data Flow: Project Load

```
Route /project/[id] mounts
  │
  ▼
useProjectStorage(id) resolves project from localStorage
  │
  ▼
usePageState hydrates: blocks, name, versions, messages
  │
  ▼
PageStateProvider wraps children with context value
  │
  ├──▶ Toolbar renders project name, save state
  ├──▶ PreviewPanel renders blocks
  ├──▶ ChatPanel mounts ChatProvider
  │      └── useAutoStartGeneration checks if auto-start needed
  └──▶ VersionsPanel renders version history
```

---

## State Ownership Summary

| State | Owned by | Persisted? | Storage |
|-------|----------|------------|---------|
| Blocks | `usePageState` | ✅ | localStorage |
| Project name | `usePageState` | ✅ | localStorage |
| Versions | `usePageState` | ✅ | localStorage |
| Chat messages | `usePageState` | ✅ | localStorage |
| Undo stack | `usePageState` | ❌ | Memory only |
| Selected block | `usePageState` | ❌ | Memory only |
| Dirty flag | `usePageState` | ❌ | Memory only |
| Versions panel open | `BuilderPage` | ❌ | Memory only |
| Chat input text | `ChatContext` | ❌ | Memory only |
| Generation phase | `useChatGeneration` | ❌ | Memory only |
| Section progress | `useChatGeneration` | ❌ | Memory only |
| Loading flag | `useChatGeneration` | ❌ | Memory only |

---

## File Map

```
src/
├── types/index.ts                  # Block, Version, Project, Message
├── context/
│   ├── PageStateContext.tsx         # Context definition + Provider export (no logic)
│   └── ChatContext.tsx              # Context + ChatProvider with generation wiring
├── hooks/
│   ├── useProjectStorage.ts        # localStorage I/O layer
│   ├── usePageState.ts             # All editing state + block operations
│   ├── useChatGeneration.ts        # AI generation orchestration
│   └── useAutoStartGeneration.ts   # One-shot auto-start on project load
├── lib/
│   └── storage.ts                  # Raw localStorage helpers (saveProject, loadProject, etc.)
├── components/
│   ├── Toolbar.tsx                  # ← reads PageStateContext
│   ├── PreviewPanel.tsx             # ← reads PageStateContext
│   ├── VersionsPanel.tsx            # ← reads PageStateContext
│   ├── ChatPanel.tsx                # ← mounts ChatProvider
│   └── chat/
│       ├── ChatInputArea.tsx        # ← reads ChatContext
│       ├── ChatMessageList.tsx      # ← reads ChatContext
│       └── GenerationProgress.tsx   # ← reads ChatContext
└── app/project/[id]/page.tsx        # Entry point: wires usePageState → PageStateProvider
```
