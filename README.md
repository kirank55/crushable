<p align="center">
  <h1 align="center">Crushable</h1>
  <p align="center">
    <strong>Free, open-source AI landing page builder — a Lovable alternative for static sites</strong>
  </p>
  <p align="center">
    Describe your product → get a professional landing page → export clean HTML.
    <br />
    Powered by free LLMs on <a href="https://openrouter.ai">OpenRouter</a>. Zero cost. Zero lock-in.
  </p>
  <p align="center">
    <a href="https://crushable.dev"><strong>Live Demo →</strong></a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="#quick-start">Quick Start</a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="#features">Features</a>
    &nbsp;&nbsp;·&nbsp;&nbsp;
    <a href="#roadmap">Roadmap</a>
  </p>
</p>

---

## Why Crushable?

Most AI page builders (Lovable, Bolt, v0) charge **$20+/month**. But when you're validating an idea — running a fake door test, gauging interest, or spinning up a quick MVP page — you shouldn't need a subscription.

**Crushable is a free, open-source alternative** that generates responsive landing pages through a simple chat interface, using free AI models. Describe what you want, review a plan, hit build, and export. That's it.

---

## Features

### Chat-Based Page Builder
Describe your product in plain English. Crushable's AI generates a section-by-section plan and builds each section with streaming output — hero, features, pricing, testimonials, footer, and more.

### 100% Free to Use
Uses free open-source models on OpenRouter (StepFun, GLM, Nemotron, Gemma) with automatic fallback. No API key required to get started.

### 5 Design Styles
Choose the aesthetic that fits your brand:

| Style | Description |
|---|---|
| **Professional** | Clean, corporate, trustworthy — slate/blue palette |
| **Playful** | Colorful, fun, energetic — purple/pink/orange gradients |
| **Minimal** | Simple, clean, lots of whitespace — monochrome |
| **Bold & Dark** | Dark theme, neon accents, dramatic — futuristic tech |
| **Elegant** | Luxury, refined, sophisticated — navy/gold/cream |

### Conversational Editing
Click any section and refine it through chat: *"make the background darker"*, *"change to 3 pricing tiers"*, *"add a testimonial section"*. Crushable edits only what you ask — no regenerating the whole page.

### Live Preview
Real-time iframe preview with a mobile/desktop toggle. See exactly what your visitors will see as you build.

### Code View & Editor
View the generated HTML with Prism.js syntax highlighting. Edit the code directly in the built-in editor, or copy it to your clipboard.

### Version History
Automatic version snapshots after every generation. Browse, compare, and restore any previous version with one click.

### Undo Support
Made a change you don't like? Undo takes you back to the previous state instantly.

### One-Click Export
Download your page as a single, self-contained HTML file. Deploy it anywhere — Netlify, Vercel, GitHub Pages, Cloudflare Pages, or any static host.

### Import HTML
Import previously exported Crushable pages to continue editing where you left off.

### Smart Planning
Before generating, Crushable creates a detailed, product-specific execution plan (8–10 sections). Review it, edit it, then let the AI build it section by section.

### Bring Your Own Key
Want better output? Add your OpenRouter API key in Settings to unlock premium models like Claude Sonnet 4, GPT-4o, Gemini 2.5 Flash, and more.

---

## Quick Start

### Prerequisites

- **Node.js** 18+
- **npm** (or yarn/pnpm)
- An [OpenRouter](https://openrouter.ai) API key (free to create — free models don't consume credits)

### 1. Clone the repository

```bash
git clone https://github.com/kirank55/crushable.git
cd crushable
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the project root:

```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

> **Note:** The API key is used server-side to call OpenRouter. Free models don't cost anything, but you still need a key. Get one at [openrouter.ai/keys](https://openrouter.ai/keys).

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start building!

---

## How It Works

```
┌─────────────────────────────────────────────────────┐
│                   Crushable Flow                     │
│                                                     │
│  1. Choose Design Style (Professional, Bold, etc.)  │
│                    ↓                                │
│  2. Enter Product Details                           │
│     (brand, description, hero text, CTA)            │
│                    ↓                                │
│  3. AI Generates Detailed Plan                      │
│     (8-10 sections with descriptions)               │
│                    ↓                                │
│  4. Review & Edit Plan                              │
│                    ↓                                │
│  5. Build — Sections Stream In One-by-One           │
│                    ↓                                │
│  6. Refine Any Section via Chat                     │
│                    ↓                                │
│  7. Export Clean HTML → Deploy Anywhere              │
└─────────────────────────────────────────────────────┘
```

### Architecture Overview

```
src/
├── app/
│   ├── api/generate/        # Next.js API route → OpenRouter proxy
│   │   └── route.ts         # Handles plan, generate, and edit modes
│   ├── project/[id]/        # Builder page (chat + preview)
│   │   └── page.tsx
│   ├── layout.tsx           # Root layout (edge runtime)
│   ├── globals.css          # Full design system
│   └── page.tsx             # Home / project list
├── components/
│   ├── ChatPanel.tsx        # Chat interface, plan review, section generation
│   ├── PreviewPanel.tsx     # Live preview iframe, code view, console
│   ├── Toolbar.tsx          # Top bar — save, export, import, view modes
│   ├── SettingsModal.tsx    # API key & model configuration
│   └── VersionsPanel.tsx   # Version history sidebar
├── hooks/
│   └── usePageState.ts     # Core state management (blocks, versions, undo)
├── lib/
│   ├── openrouter.ts       # OpenRouter API client with free model fallback
│   ├── prompt.ts           # System prompts, edit/new/plan prompt builders
│   ├── storage.ts          # localStorage persistence (projects, settings)
│   ├── export.ts           # HTML document generation & download
│   ├── import.ts           # HTML import & section parsing
│   ├── blocks.ts           # Block factory
│   └── logger.ts           # Structured logging utility
└── types/
    └── index.ts            # TypeScript types, models, design styles
```

### Key Concepts

- **Blocks** — Each section (hero, features, pricing, etc.) is a block with an `id`, `label`, and `html` string.
- **Versions** — Automatic snapshots saved after each AI generation. Stores blocks + the prompt that created them.
- **Design Styles** — System prompt modifiers that enforce a consistent visual language across all generated sections.
- **Free Auto Mode** — Tries free models in sequence (StepFun → GLM → Nemotron → Gemma), falling back on error.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router, Edge Runtime) |
| **UI** | [React 19](https://react.dev/) + TypeScript |
| **Styling (App)** | [Tailwind CSS v4](https://tailwindcss.com/) |
| **Styling (Output)** | Tailwind CSS CDN (generated pages are self-contained) |
| **Icons** | [Lucide React](https://lucide.dev/) (app) + Lucide CDN (output) |
| **Typography** | [Inter](https://fonts.google.com/specimen/Inter) via Google Fonts |
| **AI Models** | [OpenRouter](https://openrouter.ai/) (free + premium models) |
| **Code Highlighting** | [Prism.js](https://prismjs.com/) |
| **Persistence** | `localStorage` (zero backend for project data) |
| **Deployment** | [Cloudflare Pages](https://pages.cloudflare.com/) |
| **Package Management** | npm + [JSZip](https://stuk.github.io/jszip/) |

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | Your OpenRouter API key (server-side) |
| `NEXT_PUBLIC_APP_URL` | No | App URL for OpenRouter headers (default: `https://crushable.dev`) |
| `NEXT_PUBLIC_APP_NAME` | No | App name for OpenRouter headers (default: `Crushable`) |
| `NEXT_PUBLIC_MODELS` | No | JSON array of custom `ModelInfo[]` to override default model list |

### User Settings (in-app)

Users can configure their own OpenRouter API key and model selection via the Settings modal. Client-provided keys take priority over the server environment key.

---

## Roadmap

- [ ] **React App Sandbox** — Build full React apps in a sandboxed environment, not just static pages
- [ ] **Template Library** — Pre-built landing page templates to start from
- [ ] **One-Click Deploy** — Deploy directly to Netlify, Vercel, or Cloudflare Pages
- [ ] **Custom CSS Themes** — Upload or configure custom color palettes and typography
- [ ] **Multi-Page Sites** — Generate linked multi-page websites
- [ ] **Collaboration** — Share projects via URL
- [ ] **Backend Integration** — Optional database support for persistent storage

---

## Contributing

Contributions are welcome! Whether it's a bug fix, new feature, or documentation improvement — feel free to open an issue or submit a pull request.

```bash
# Fork the repo, then:
git clone https://github.com/your-username/crushable.git
cd crushable
npm install
npm run dev
```

### Development Notes

- The app runs on **Edge Runtime** (Cloudflare Workers compatible)
- Generated pages use the **Tailwind CDN** — they're fully self-contained HTML files
- All project data is stored in **localStorage** — no database needed for the core flow
- The API route at `/api/generate` proxies requests to OpenRouter with streaming

---

## License

This project is open source. See the repository for license details.

---

## Acknowledgments

- [OpenRouter](https://openrouter.ai) — for making free AI models accessible
- [Tailwind CSS](https://tailwindcss.com) — for making generated pages look great
- [Lucide](https://lucide.dev) — for beautiful, consistent icons
- [Next.js](https://nextjs.org) — for the framework that makes this possible

---

<p align="center">
  Built by <a href="https://github.com/kirank55">kirank55</a>
  <br />
</p>
