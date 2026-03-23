import {
  ComponentDefinition,
  ComponentManifestItem,
  ComponentProps,
  ComponentSummary,
} from "@/types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeList(values: string[] | undefined, fallback: string[]): string[] {
  return values && values.length > 0 ? values : fallback;
}

function getString(props: ComponentProps, key: string, fallback: string): string {
  const value = props[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getList(props: ComponentProps, key: string, fallback: string[]): string[] {
  const value = props[key];
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : fallback;
}

function renderList(items: string[], mapper: (item: string, index: number) => string): string {
  return items.map(mapper).join("\n");
}

export const COMPONENT_REGISTRY: ComponentDefinition[] = [
  {
    id: "nav-inline",
    name: "Inline Navbar",
    category: "navigation",
    variants: ["professional", "minimal", "bold", "elegant"],
    description: "Sticky top navigation with anchor links and a CTA.",
    props: [
      { name: "brand", type: "text", required: true },
      { name: "links", type: "list", required: true },
      { name: "ctaText", type: "text", required: true },
      { name: "ctaHref", type: "link", required: true, default: "#cta" },
    ],
    render: (props) => {
      const brand = escapeHtml(getString(props, "brand", "Crushable"));
      const ctaText = escapeHtml(getString(props, "ctaText", "Get Started"));
      const ctaHref = escapeHtml(getString(props, "ctaHref", "#cta"));
      const links = normalizeList(getList(props, "links", ["Features", "Pricing", "FAQ"]), ["Features", "Pricing", "FAQ"]);

        return `<section id="home" data-block-id="home" class="bg-slate-950 text-white sticky top-0 z-50 border-b border-white/10">
      <div class="max-w-275 mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between py-4">
      <a href="#hero" class="text-sm font-semibold tracking-[0.22em] uppercase">${brand}</a>
      <nav class="hidden md:flex items-center gap-6 text-sm text-slate-300">
        ${renderList(links, (item) => {
          const href = `#${item.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
          return `<a href="${href}" class="transition hover:text-white">${escapeHtml(item)}</a>`;
        })}
      </nav>
      <a href="${ctaHref}" class="inline-flex items-center rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">${ctaText}</a>
    </div>
  </div>
</section>`;
    },
  },
  {
    id: "hero-split",
    name: "Split Hero",
    category: "hero",
    variants: ["professional", "bold", "elegant", "playful"],
    description: "Two-column hero with eyebrow, headline, proof points, and CTA pair.",
    props: [
      { name: "eyebrow", type: "text", required: true },
      { name: "headline", type: "text", required: true },
      { name: "subtitle", type: "richtext", required: true },
      { name: "primaryCta", type: "text", required: true },
      { name: "secondaryCta", type: "text", required: false },
      { name: "proofPoints", type: "list", required: false },
      { name: "cardTitle", type: "text", required: false },
      { name: "cardBody", type: "richtext", required: false },
    ],
    render: (props) => {
      const eyebrow = escapeHtml(getString(props, "eyebrow", "Launch smarter"));
      const headline = escapeHtml(getString(props, "headline", "Turn your landing page brief into a stronger first draft."));
      const subtitle = escapeHtml(getString(props, "subtitle", "Use AI-assisted generation, editing, and refinement to ship a polished page faster."));
      const primaryCta = escapeHtml(getString(props, "primaryCta", "Start Free"));
      const secondaryCta = escapeHtml(getString(props, "secondaryCta", "See Demo"));
      const cardTitle = escapeHtml(getString(props, "cardTitle", "What you launch with"));
      const cardBody = escapeHtml(getString(props, "cardBody", "A page that already has hierarchy, sections, proof, and a clear call to action."));
      const proofPoints = normalizeList(getList(props, "proofPoints", ["Fast setup", "Anchored navigation", "Refinable sections"]), ["Fast setup", "Anchored navigation", "Refinable sections"]);

        return `<section id="hero" data-block-id="hero" class="bg-linear-to-br from-slate-950 via-slate-900 to-cyan-950 text-white pt-24 pb-20">
      <div class="max-w-275 mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
      <div>
        <span class="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">${eyebrow}</span>
        <h1 class="mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">${headline}</h1>
        <p class="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">${subtitle}</p>
        <div class="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="#pricing" class="inline-flex items-center justify-center rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">${primaryCta}</a>
          <a href="#features" class="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/40">${secondaryCta}</a>
        </div>
        <div class="mt-8 flex flex-wrap gap-3 text-sm text-slate-300">
          ${renderList(proofPoints, (item) => `<span class="rounded-full border border-white/10 px-3 py-1">${escapeHtml(item)}</span>`)}
        </div>
      </div>
      <div class="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/30 backdrop-blur">
        <div class="rounded-[22px] bg-slate-900/70 p-6">
          <p class="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">${cardTitle}</p>
          <p class="mt-4 text-2xl font-semibold text-white">${cardBody}</p>
          <div class="mt-6 grid gap-4 sm:grid-cols-2">
            <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Conversion system</p>
              <p class="mt-2 text-sm text-slate-200">Clear CTA hierarchy, section transitions, and proof blocks built in.</p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p class="text-xs uppercase tracking-[0.18em] text-slate-400">Editable after launch</p>
              <p class="mt-2 text-sm text-slate-200">Refine one section at a time without regenerating the whole page.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`;
    },
  },
  {
    id: "features-grid",
    name: "Feature Grid",
    category: "features",
    variants: ["professional", "playful", "minimal", "bold"],
    description: "Three-column grid for product capabilities or service pillars.",
    props: [
      { name: "headline", type: "text", required: true },
      { name: "intro", type: "richtext", required: true },
      { name: "items", type: "list", required: true },
    ],
    render: (props) => {
      const headline = escapeHtml(getString(props, "headline", "Everything the page needs to convert."));
      const intro = escapeHtml(getString(props, "intro", "Keep the offer legible, persuasive, and easy to scan on every screen size."));
      const items = normalizeList(getList(props, "items", ["Clear hierarchy", "Trust-building proof", "Flexible editing"]), ["Clear hierarchy", "Trust-building proof", "Flexible editing"]);

        return `<section id="features" data-block-id="features" class="bg-white py-20 text-slate-900">
      <div class="max-w-275 mx-auto px-4 sm:px-6 lg:px-8">
    <div class="max-w-2xl">
      <p class="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700">Core capabilities</p>
      <h2 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">${headline}</h2>
      <p class="mt-4 text-base leading-7 text-slate-600">${intro}</p>
    </div>
    <div class="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      ${renderList(items, (item, index) => `<article class="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
        <div class="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-sm font-semibold text-white">0${index + 1}</div>
        <h3 class="mt-5 text-xl font-semibold text-slate-900">${escapeHtml(item)}</h3>
        <p class="mt-3 text-sm leading-6 text-slate-600">Designed to support stronger copy, cleaner structure, and easier iteration without reworking the entire page.</p>
      </article>`)}
    </div>
  </div>
</section>`;
    },
  },
  {
    id: "pricing-cards",
    name: "Pricing Cards",
    category: "pricing",
    variants: ["professional", "bold", "playful"],
    description: "Three-tier pricing section with a highlighted middle plan.",
    props: [
      { name: "headline", type: "text", required: true },
      { name: "intro", type: "richtext", required: true },
      { name: "plans", type: "list", required: true },
    ],
    render: (props) => {
      const headline = escapeHtml(getString(props, "headline", "Pricing that scales with the work."));
      const intro = escapeHtml(getString(props, "intro", "Choose the speed and control you need for your next launch."));
      const plans = normalizeList(getList(props, "plans", ["Starter|$29|Plan faster and launch a solid first draft.", "Growth|$79|Add richer sections, refinements, and faster iteration.", "Scale|$199|For teams shipping polished pages on a regular cadence."]), ["Starter|$29|Plan faster and launch a solid first draft.", "Growth|$79|Add richer sections, refinements, and faster iteration.", "Scale|$199|For teams shipping polished pages on a regular cadence."]);

        return `<section id="pricing" data-block-id="pricing" class="bg-slate-950 py-20 text-white">
      <div class="max-w-275 mx-auto px-4 sm:px-6 lg:px-8">
    <div class="max-w-2xl">
      <p class="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">Pricing</p>
      <h2 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">${headline}</h2>
      <p class="mt-4 text-base leading-7 text-slate-300">${intro}</p>
    </div>
    <div class="mt-12 grid gap-5 lg:grid-cols-3">
      ${renderList(plans, (plan, index) => {
        const [name, price, description] = plan.split("|");
        const featured = index === 1;
        return `<article class="rounded-3xl border ${featured ? "border-cyan-400 bg-cyan-400/10" : "border-white/10 bg-white/5"} p-6 shadow-xl shadow-slate-950/30">
          <p class="text-sm font-semibold uppercase tracking-[0.18em] ${featured ? "text-cyan-200" : "text-slate-300"}">${escapeHtml(name || `Plan ${index + 1}`)}</p>
          <p class="mt-4 text-4xl font-semibold text-white">${escapeHtml(price || "$49")}</p>
          <p class="mt-4 text-sm leading-6 ${featured ? "text-cyan-50" : "text-slate-300"}">${escapeHtml(description || "Built for teams that need stronger launch velocity.")}</p>
          <ul class="mt-6 space-y-3 text-sm text-slate-200">
            <li>Conversion-focused layout</li>
            <li>Refinement-ready section structure</li>
            <li>Fast editing after first draft</li>
          </ul>
          <a href="#cta" class="mt-8 inline-flex w-full items-center justify-center rounded-full ${featured ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300" : "bg-white text-slate-950 hover:bg-slate-100"} px-4 py-3 text-sm font-semibold transition">Choose ${escapeHtml(name || `Plan ${index + 1}`)}</a>
        </article>`;
      })}
    </div>
  </div>
</section>`;
    },
  },
  {
    id: "cta-band",
    name: "CTA Band",
    category: "cta",
    variants: ["professional", "playful", "bold", "elegant"],
    description: "Conversion-focused closing CTA with urgency and concise support copy.",
    props: [
      { name: "headline", type: "text", required: true },
      { name: "body", type: "richtext", required: true },
      { name: "ctaText", type: "text", required: true },
    ],
    render: (props) => {
      const headline = escapeHtml(getString(props, "headline", "Ready to launch a stronger first draft?"));
      const body = escapeHtml(getString(props, "body", "Plan the page, generate the sections, and refine what matters without starting over."));
      const ctaText = escapeHtml(getString(props, "ctaText", "Start Building"));

      return `<section id="cta" data-block-id="cta" class="bg-cyan-400 py-16 text-slate-950">
  <div class="max-w-275 mx-auto px-4 sm:px-6 lg:px-8">
    <div class="rounded-4xl bg-slate-950 px-6 py-10 text-white shadow-2xl shadow-cyan-500/20 sm:px-10">
      <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div class="max-w-2xl">
          <p class="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">Final CTA</p>
          <h2 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">${headline}</h2>
          <p class="mt-4 text-base leading-7 text-slate-300">${body}</p>
        </div>
        <a href="#home" class="inline-flex items-center justify-center rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">${ctaText}</a>
      </div>
    </div>
  </div>
</section>`;
    },
  },
  {
    id: "footer-simple",
    name: "Simple Footer",
    category: "footer",
    variants: ["professional", "minimal", "elegant", "bold"],
    description: "Compact footer with brand, short summary, and utility links.",
    props: [
      { name: "brand", type: "text", required: true },
      { name: "summary", type: "richtext", required: true },
      { name: "links", type: "list", required: false },
    ],
    render: (props) => {
      const brand = escapeHtml(getString(props, "brand", "Crushable"));
      const summary = escapeHtml(getString(props, "summary", "Build, refine, and export landing pages from one workspace."));
      const links = normalizeList(getList(props, "links", ["Features", "Pricing", "FAQ"]), ["Features", "Pricing", "FAQ"]);

        return `<section id="footer" data-block-id="footer" class="bg-slate-900 py-12 text-slate-300">
      <div class="max-w-275 mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex flex-col gap-8 border-t border-white/10 pt-8 md:flex-row md:items-end md:justify-between">
      <div class="max-w-md">
        <p class="text-sm font-semibold uppercase tracking-[0.22em] text-white">${brand}</p>
        <p class="mt-3 text-sm leading-6 text-slate-400">${summary}</p>
      </div>
      <nav class="flex flex-wrap gap-4 text-sm text-slate-400">
        ${renderList(links, (item) => {
          const href = `#${item.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
          return `<a href="${href}" class="transition hover:text-white">${escapeHtml(item)}</a>`;
        })}
      </nav>
    </div>
  </div>
</section>`;
    },
  },
];

export function getComponentSummaries(): ComponentSummary[] {
  return COMPONENT_REGISTRY.map((component) => ({
    id: component.id,
    name: component.name,
    category: component.category,
    description: component.description,
    variants: component.variants,
  }));
}

export function getComponentById(componentId: string): ComponentDefinition | undefined {
  return COMPONENT_REGISTRY.find((component) => component.id === componentId);
}

export function renderComponentManifestItem(item: ComponentManifestItem): string {
  const component = getComponentById(item.componentId);
  if (!component) {
    throw new Error(`Unknown component: ${item.componentId}`);
  }

  return component.render(item.props);
}
