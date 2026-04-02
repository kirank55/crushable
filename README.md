# Crushable

> AI-powered landing page builder. Describe your product, get production-ready HTML.

Crushable turns a plain-text product brief into a complete, sectioned landing page using language models via [OpenRouter](https://openrouter.ai). Everything runs in the browser — no account required, no server-side storage, no build step to deploy your output.

---

## Features

- **Brief → Page** — Write a product description (50+ characters) and Crushable plans and builds a full landing page, section by section.
- **Concurrent generation** — Sections are generated in parallel (up to 3 at a time) so you see results fast.
- **Smart modification engine** — After the initial page is built, subsequent chat messages are routed to a surgical modification engine that edits only the relevant sections instead of rebuilding from scratch.
- **HTML validation & auto-fix** — Generated HTML is automatically checked and repaired after each generation (duplicate IDs, broken anchor links, missing backgrounds, redundant nav elements).
- **Version history** — Every accepted generation creates a named snapshot. You can browse and restore any previous version.
- **Undo** — Every block-level change is pushed to an in-memory undo stack (up to 20 steps).
- **Export** — Download the entire page as a single, self-contained HTML file or a ZIP archive.
- **Local-first** — All projects, chat history, and settings are persisted to `localStorage`. Nothing leaves your browser unless you choose to export.
- **Bring your own key** — Works out of the box with free OpenRouter models. Add an API key in Settings to unlock premium models.

---

## Tech Stack

| Layer     | Choice                                          |
| --------- | ----------------------------------------------- |
| Framework | [Next.js 16](https://nextjs.org) (App Router)   |
| Language  | TypeScript 5                                    |
| Styling   | Tailwind CSS v4                                 |
| AI        | [OpenRouter](https://openrouter.ai) (streaming) |
| Icons     | [Lucide React](https://lucide.dev)              |
| Exports   | [JSZip](https://stuk.github.io/jszip/)          |
| Storage   | Browser `localStorage`                          |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install & Run

```bash
git clone https://github.com/your-username/crushable.git
cd crushable
npm install
npm run dev
```

Open [http://localhost:5500](http://localhost:5500).

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Optional — defaults to free OpenRouter models
OPENROUTER_API_KEY=your_key_here
```

You can also set the API key at runtime via the **Settings** panel inside the app.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Homepage — brief input & recent projects
│   ├── project/[id]/page.tsx       # Builder page — wires state → context
│   └── api/
│       ├── generate/route.ts       # Initial full-page generation endpoint
│       └── modify/route.ts         # Surgical modification engine endpoint
├── components/
│   ├── Toolbar.tsx                 # Project name, save state, view toggles
│   ├── PreviewPanel.tsx            # Live iframe renderer for generated sections
│   ├── VersionsPanel.tsx           # Version history drawer
│   ├── ChatPanel.tsx               # Chat shell — mounts ChatProvider
│   └── chat/
│       ├── ChatInputArea.tsx
│       ├── ChatMessageList.tsx
│       └── GenerationProgress.tsx
├── context/
│   ├── PageStateContext.tsx        # Shared editing state (blocks, versions, name)
│   └── ChatContext.tsx             # Chat + generation wiring
├── hooks/
│   ├── useProjectStorage.ts        # localStorage I/O layer
│   ├── usePageState.ts             # All editing state & block operations
│   ├── useChatGeneration.ts        # AI generation orchestrator
│   └── useAutoStartGeneration.ts   # Auto-fires generation on first project load
├── lib/
│   ├── openrouter.ts               # Streaming OpenRouter client
│   ├── prompt.ts                   # System prompts & response parsers
│   ├── generation.ts               # Section-by-section generation runner
│   ├── validate.ts                 # HTML auto-fix & validation rules
│   ├── storage.ts                  # Raw localStorage helpers
│   ├── export.ts                   # HTML/ZIP export helpers
│   └── date.ts                     # Relative date formatter
└── types/index.ts                  # Block, Version, Project, Message
```

---

## How It Works

### Generation Flow

1. User submits a product brief on the homepage.
2. A new project is created in `localStorage` and the user is redirected to `/project/<uuid>`.
3. `useAutoStartGeneration` detects the empty project and fires the generation pipeline automatically.
4. **Plan phase** — `POST /api/generate { mode: 'plan' }` returns an ordered list of section names.
5. **Build phase** — Each section is built with `POST /api/generate { mode: 'new' }`, up to 3 running concurrently.
6. Completed blocks are committed to state via `replaceAllBlocks`, a version snapshot is saved, and the project auto-saves to `localStorage`.

### Modification Flow

After the first page exists, all chat input is routed to the modification engine:

1. Intent is detected — does the message refer to a specific section or request a full rebuild?
2. **Single section** — `POST /api/modify` targets only the relevant block, returning a patched replacement.
3. **Full rebuild** — Routes back through the standard generation pipeline.
4. The preview updates immediately; a new version snapshot is created.

### State Architecture

```
BuilderPage
└── usePageState ──► useProjectStorage ──► localStorage
    └── PageStateProvider (React Context)
        ├── Toolbar
        ├── PreviewPanel
        ├── VersionsPanel
        └── ChatPanel
            └── ChatProvider (React Context)
                ├── useChatGeneration
                └── useAutoStartGeneration
```

See [`state.md`](state.md) for a complete breakdown of every state owner and its persistence strategy.

---

## Key Concepts

| Concept           | Description                                                                     |
| ----------------- | ------------------------------------------------------------------------------- |
| **Block**         | A single HTML section (`id`, `label`, `html`, `visible`)                        |
| **Version**       | An immutable snapshot of all blocks at a point in time                          |
| **Project**       | Top-level entity — name, blocks, versions, chat history                         |
| **addBlockSmart** | Inserts navbars at the top, footers at the bottom, all others before the footer |
| **Semaphore**     | Limits concurrent section generation to 3 to stay within API rate limits        |
| **Dirty flag**    | Set on any block mutation; triggers a debounced 2-second auto-save              |

---

## Scripts

```bash
npm run dev      # Start dev server at localhost:5500
npm run build    # Production build
npm run start    # Serve the production build
npm run lint     # Run ESLint
```

---

## License

MIT
