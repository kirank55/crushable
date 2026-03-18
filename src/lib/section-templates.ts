import { SectionTemplate, TemplateSelection } from "@/types";

const NAV_TEMPLATE = `<section id="home" data-block-id="home" class="bg-slate-950 text-white sticky top-0 z-50 border-b border-white/10">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between py-4">
      <a href="#hero" class="text-sm font-semibold tracking-[0.22em] uppercase">{{brand}}</a>
      <nav class="hidden md:flex items-center gap-6 text-sm text-slate-300">
        {{nav_links}}
      </nav>
      <a href="{{cta_href}}" class="inline-flex items-center rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">{{cta_text}}</a>
    </div>
  </div>
</section>`;

const HERO_SPLIT_TEMPLATE = `<section id="hero" data-block-id="hero" class="bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 text-white pt-24 pb-20">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
      <div>
        <span class="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">{{eyebrow}}</span>
        <h1 class="mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">{{headline}}</h1>
        <p class="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">{{subtitle}}</p>
        <div class="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="#pricing" class="inline-flex items-center justify-center rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">{{primary_cta}}</a>
          <a href="#features" class="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/40">{{secondary_cta}}</a>
        </div>
        <div class="mt-8 flex flex-wrap gap-3 text-sm text-slate-300">
          {{proof_points}}
        </div>
      </div>
      <div class="rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/30 backdrop-blur">
        <div class="rounded-[22px] bg-slate-900/70 p-6">
          <p class="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">{{card_eyebrow}}</p>
          <p class="mt-4 text-2xl font-semibold text-white">{{card_title}}</p>
          <p class="mt-4 text-sm leading-7 text-slate-300">{{card_body}}</p>
        </div>
      </div>
    </div>
  </div>
</section>`;

const FEATURES_TEMPLATE = `<section id="features" data-block-id="features" class="bg-white py-20 text-slate-900">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="max-w-2xl">
      <p class="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700">{{eyebrow}}</p>
      <h2 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{{headline}}</h2>
      <p class="mt-4 text-base leading-7 text-slate-600">{{intro}}</p>
    </div>
    <div class="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {{feature_cards}}
    </div>
  </div>
</section>`;

const SOCIAL_PROOF_TEMPLATE = `<section id="social-proof" data-block-id="social-proof" class="bg-slate-100 py-16 text-slate-900">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
      <div class="max-w-xl">
        <p class="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">{{eyebrow}}</p>
        <h2 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{{headline}}</h2>
        <p class="mt-4 text-base leading-7 text-slate-600">{{intro}}</p>
      </div>
      <div class="grid gap-4 sm:grid-cols-2 lg:max-w-xl">
        {{metric_cards}}
      </div>
    </div>
  </div>
</section>`;

const PRICING_TEMPLATE = `<section id="pricing" data-block-id="pricing" class="bg-slate-950 py-20 text-white">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="max-w-2xl">
      <p class="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">{{eyebrow}}</p>
      <h2 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{{headline}}</h2>
      <p class="mt-4 text-base leading-7 text-slate-300">{{intro}}</p>
    </div>
    <div class="mt-12 grid gap-5 lg:grid-cols-3">
      {{pricing_cards}}
    </div>
  </div>
</section>`;

const FAQ_TEMPLATE = `<section id="faq" data-block-id="faq" class="bg-white py-20 text-slate-900">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="max-w-2xl">
      <p class="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700">{{eyebrow}}</p>
      <h2 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{{headline}}</h2>
      <p class="mt-4 text-base leading-7 text-slate-600">{{intro}}</p>
    </div>
    <div class="mt-10 space-y-4">
      {{faq_items}}
    </div>
  </div>
</section>`;

const CTA_TEMPLATE = `<section id="cta" data-block-id="cta" class="bg-cyan-400 py-16 text-slate-950">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="rounded-[32px] bg-slate-950 px-6 py-10 text-white shadow-2xl shadow-cyan-500/20 sm:px-10">
      <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div class="max-w-2xl">
          <p class="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-300">{{eyebrow}}</p>
          <h2 class="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{{headline}}</h2>
          <p class="mt-4 text-base leading-7 text-slate-300">{{body}}</p>
        </div>
        <a href="#home" class="inline-flex items-center justify-center rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">{{cta_text}}</a>
      </div>
    </div>
  </div>
</section>`;

const FOOTER_TEMPLATE = `<section id="footer" data-block-id="footer" class="bg-slate-900 py-12 text-slate-300">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex flex-col gap-8 border-t border-white/10 pt-8 md:flex-row md:items-end md:justify-between">
      <div class="max-w-md">
        <p class="text-sm font-semibold uppercase tracking-[0.22em] text-white">{{brand}}</p>
        <p class="mt-3 text-sm leading-6 text-slate-400">{{summary}}</p>
      </div>
      <nav class="flex flex-wrap gap-4 text-sm text-slate-400">
        {{footer_links}}
      </nav>
    </div>
  </div>
</section>`;

export const SECTION_TEMPLATES: SectionTemplate[] = [
  {
    id: "nav-inline",
    name: "Inline Navbar",
    category: "navigation",
    variant: "inline",
    description: "Sticky navbar with anchor links and CTA.",
    designStyles: ["professional", "minimal", "bold", "elegant"],
    placeholders: ["brand", "nav_links", "cta_href", "cta_text"],
    skeleton: NAV_TEMPLATE,
    componentId: "nav-inline",
  },
  {
    id: "hero-split",
    name: "Split Hero",
    category: "hero",
    variant: "split",
    description: "Two-column hero with eyebrow, headline, proof points, and CTA pair.",
    designStyles: ["professional", "bold", "elegant", "playful"],
    placeholders: ["eyebrow", "headline", "subtitle", "primary_cta", "secondary_cta", "proof_points", "card_eyebrow", "card_title", "card_body"],
    skeleton: HERO_SPLIT_TEMPLATE,
    componentId: "hero-split",
  },
  {
    id: "features-grid",
    name: "Feature Grid",
    category: "features",
    variant: "grid",
    description: "Three-card feature grid with supporting intro copy.",
    designStyles: ["professional", "minimal", "playful", "bold"],
    placeholders: ["eyebrow", "headline", "intro", "feature_cards"],
    skeleton: FEATURES_TEMPLATE,
    componentId: "features-grid",
  },
  {
    id: "social-proof-metrics",
    name: "Metrics Social Proof",
    category: "social-proof",
    variant: "metrics",
    description: "Trust section with brand credibility and proof metrics.",
    designStyles: ["professional", "minimal", "elegant", "bold"],
    placeholders: ["eyebrow", "headline", "intro", "metric_cards"],
    skeleton: SOCIAL_PROOF_TEMPLATE,
  },
  {
    id: "pricing-cards",
    name: "Pricing Cards",
    category: "pricing",
    variant: "cards",
    description: "Three-tier pricing cards with highlighted middle offer.",
    designStyles: ["professional", "bold", "playful"],
    placeholders: ["eyebrow", "headline", "intro", "pricing_cards"],
    skeleton: PRICING_TEMPLATE,
    componentId: "pricing-cards",
  },
  {
    id: "faq-stack",
    name: "FAQ Stack",
    category: "faq",
    variant: "stack",
    description: "Simple FAQ accordion-style stack using static cards.",
    designStyles: ["professional", "minimal", "elegant"],
    placeholders: ["eyebrow", "headline", "intro", "faq_items"],
    skeleton: FAQ_TEMPLATE,
  },
  {
    id: "cta-band",
    name: "CTA Band",
    category: "cta",
    variant: "band",
    description: "Closing CTA with a concise support message.",
    designStyles: ["professional", "bold", "playful", "elegant"],
    placeholders: ["eyebrow", "headline", "body", "cta_text"],
    skeleton: CTA_TEMPLATE,
    componentId: "cta-band",
  },
  {
    id: "footer-simple",
    name: "Simple Footer",
    category: "footer",
    variant: "simple",
    description: "Compact footer with brand summary and utility links.",
    designStyles: ["professional", "minimal", "elegant", "bold"],
    placeholders: ["brand", "summary", "footer_links"],
    skeleton: FOOTER_TEMPLATE,
    componentId: "footer-simple",
  },
];

const CATEGORY_KEYWORDS: Array<{ category: string; pattern: RegExp }> = [
  { category: "navigation", pattern: /\b(nav|navbar|navigation|header)\b/i },
  { category: "hero", pattern: /\bhero\b/i },
  { category: "features", pattern: /\bfeature|benefit|capabilit/i },
  { category: "social-proof", pattern: /\btestimonial|proof|logo|metric|trust/i },
  { category: "pricing", pattern: /\bpricing|plan|offer|tier/i },
  { category: "faq", pattern: /\bfaq|question/i },
  { category: "cta", pattern: /\bcta|call to action|final/i },
  { category: "footer", pattern: /\bfooter\b/i },
];

export function inferTemplateCategory(sectionTitle: string): string {
  const match = CATEGORY_KEYWORDS.find(({ pattern }) => pattern.test(sectionTitle));
  return match?.category || "features";
}

export function getSectionTemplateById(templateId: string): SectionTemplate | undefined {
  return SECTION_TEMPLATES.find((template) => template.id === templateId);
}

export function getSectionTemplatesForCategory(category: string, designStyle?: string): SectionTemplate[] {
  return SECTION_TEMPLATES.filter((template) => {
    if (template.category !== category) return false;
    if (!designStyle) return true;
    return template.designStyles.includes(designStyle);
  });
}

export function pickTemplateForSection(sectionTitle: string, designStyle?: string): SectionTemplate | undefined {
  const category = inferTemplateCategory(sectionTitle);
  const matches = getSectionTemplatesForCategory(category, designStyle);
  return matches[0] || SECTION_TEMPLATES.find((template) => template.category === category);
}

export function listTemplateSummaries(designStyle?: string): TemplateSelection[] {
  return SECTION_TEMPLATES.filter((template) => !designStyle || template.designStyles.includes(designStyle)).map((template) => ({
    sectionTitle: template.name,
    templateId: template.id,
  }));
}

export function fillTemplateSkeleton(
  skeleton: string,
  values: Record<string, string>,
): string {
  return skeleton.replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_, token: string) => values[token] ?? "");
}
