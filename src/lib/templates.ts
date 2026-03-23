import { Block } from '@/types';
import { createBlock } from '@/lib/blocks';

export interface TemplateDefinition {
    id: string;
    name: string;
    category: string;
    description: string;
    designStyle: string;
    preview: {
        eyebrow: string;
        title: string;
        accent: string;
    };
    buildBlocks: () => Block[];
}

function buildTemplateBlocks(sections: Array<{ label: string; html: string }>): Block[] {
    return sections.map((section) => createBlock(section.html.trim(), section.label));
}

export const TEMPLATE_LIBRARY: TemplateDefinition[] = [
    {
        id: 'saas-launch',
        name: 'SaaS Launch',
        category: 'Startup',
        description: 'A conversion-focused software landing page with proof, feature framing, and a strong waitlist CTA.',
        designStyle: 'professional',
        preview: {
            eyebrow: 'B2B SaaS',
            title: 'Clean launch page with proof-driven structure',
            accent: 'linear-gradient(135deg, #2563eb 0%, #0f172a 100%)',
        },
        buildBlocks: () => buildTemplateBlocks([
            {
                label: 'Navigation',
                html: `
<section data-block-id="navigation" id="home" class="border-b border-slate-200 bg-white/90 backdrop-blur">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between py-4">
      <a href="#hero" class="text-lg font-semibold text-slate-900">SignalStack</a>
      <nav class="hidden md:flex items-center gap-8 text-sm text-slate-600">
        <a href="#features" class="hover:text-slate-900">Features</a>
        <a href="#proof" class="hover:text-slate-900">Proof</a>
        <a href="#pricing" class="hover:text-slate-900">Pricing</a>
      </nav>
      <a href="#cta" class="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Join the waitlist</a>
    </div>
  </div>
</section>`,
            },
            {
                label: 'Hero',
                html: `
<section data-block-id="hero" id="hero" class="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white pt-16">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
    <div class="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
      <div>
        <div class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-blue-200">AI revenue intelligence</div>
        <h1 class="mt-6 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">Know which product signals turn interest into pipeline before your team misses the moment.</h1>
        <p class="mt-6 max-w-xl text-lg text-slate-300">SignalStack combines product activity, CRM updates, and account-level buying intent into a single operating view for revenue teams.</p>
        <div class="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="#cta" class="rounded-full bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25">Get early access</a>
          <a href="#proof" class="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white">See how teams use it</a>
        </div>
        <div class="mt-8 flex flex-wrap items-center gap-4 text-sm text-slate-400">
          <span>Trusted by beta teams at Loomline, Northstar, and PulseOps</span>
        </div>
      </div>
      <div class="rounded-[28px] border border-white/10 bg-white/10 p-5 shadow-2xl shadow-slate-950/30 backdrop-blur">
        <div class="rounded-[22px] bg-slate-950 p-5 text-sm text-slate-200">
          <div class="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Live account pulse</p>
              <p class="mt-1 text-lg font-semibold text-white">Mid-market expansion signals</p>
            </div>
            <span class="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">+18 high-intent accounts</span>
          </div>
          <div class="mt-4 space-y-3">
            <div class="rounded-2xl border border-white/5 bg-white/5 p-4">
              <p class="text-xs uppercase tracking-[0.16em] text-slate-400">Top trigger</p>
              <p class="mt-2 text-base font-medium text-white">Usage crossed expansion threshold on 6 accounts this week</p>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="rounded-2xl border border-white/5 bg-white/5 p-4">
                <p class="text-xs uppercase tracking-[0.16em] text-slate-400">Pipeline influenced</p>
                <p class="mt-2 text-2xl font-semibold text-white">$420k</p>
              </div>
              <div class="rounded-2xl border border-white/5 bg-white/5 p-4">
                <p class="text-xs uppercase tracking-[0.16em] text-slate-400">Rep response time</p>
                <p class="mt-2 text-2xl font-semibold text-white">11 min</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`,
            },
            {
                label: 'Features',
                html: `
<section data-block-id="features" id="features" class="bg-slate-50 py-20">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="max-w-2xl">
      <p class="text-sm font-semibold uppercase tracking-[0.22em] text-blue-600">Why teams switch</p>
      <h2 class="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">A single operating layer for GTM signals, not another dashboard.</h2>
      <p class="mt-4 text-lg text-slate-600">SignalStack gives revenue teams a fast answer to what changed, why it matters, and what to do next.</p>
    </div>
    <div class="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <div class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 class="text-lg font-semibold text-slate-900">Unified account pulse</h3>
        <p class="mt-3 text-sm leading-6 text-slate-600">Merge product usage, CRM state, and enrichment events into one clean signal feed.</p>
      </div>
      <div class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 class="text-lg font-semibold text-slate-900">Playbook suggestions</h3>
        <p class="mt-3 text-sm leading-6 text-slate-600">Recommend outreach, expansion plays, and timing based on recent account behavior.</p>
      </div>
      <div class="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 class="text-lg font-semibold text-slate-900">Executive visibility</h3>
        <p class="mt-3 text-sm leading-6 text-slate-600">Show leadership where pipeline is heating up before it becomes obvious in lagging reports.</p>
      </div>
    </div>
  </div>
</section>`,
            },
            {
                label: 'Social Proof',
                html: `
<section data-block-id="proof" id="proof" class="bg-white py-20">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Early proof</p>
        <h2 class="mt-4 text-3xl font-semibold text-slate-900">The beta program already changed how revenue leaders triage pipeline.</h2>
      </div>
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-[24px] bg-slate-900 p-6 text-white">
          <p class="text-3xl font-semibold">34%</p>
          <p class="mt-2 text-sm text-slate-300">Faster follow-up on high-intent accounts</p>
        </div>
        <div class="rounded-[24px] bg-blue-600 p-6 text-white">
          <p class="text-3xl font-semibold">2.4x</p>
          <p class="mt-2 text-sm text-blue-100">More expansion opportunities surfaced</p>
        </div>
        <div class="rounded-[24px] bg-slate-100 p-6 text-slate-900">
          <p class="text-3xl font-semibold">11m</p>
          <p class="mt-2 text-sm text-slate-600">Median time from signal to rep action</p>
        </div>
      </div>
    </div>
  </div>
</section>`,
            },
            {
                label: 'Pricing CTA',
                html: `
<section data-block-id="pricing" id="pricing" class="bg-slate-950 py-20 text-white">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="rounded-[32px] border border-white/10 bg-white/5 p-8 lg:p-10">
      <div class="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">Early access</p>
          <h2 class="mt-4 text-3xl font-semibold sm:text-4xl">Join the beta and shape the revenue signal workflow with us.</h2>
          <p class="mt-4 max-w-2xl text-slate-300">Founding customers get guided onboarding, direct product access, and preferred pricing after launch.</p>
        </div>
        <div class="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <a href="#cta" class="rounded-full bg-blue-500 px-6 py-3 text-center text-sm font-semibold text-white">Request access</a>
          <a href="#home" class="rounded-full border border-white/20 px-6 py-3 text-center text-sm font-semibold text-white">Back to top</a>
        </div>
      </div>
    </div>
  </div>
</section>`,
            },
            {
                label: 'Footer CTA',
                html: `
<section data-block-id="cta" id="cta" class="bg-white py-16">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex flex-col gap-5 border-t border-slate-200 pt-8 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-lg font-semibold text-slate-900">SignalStack</p>
        <p class="mt-2 text-sm text-slate-600">Revenue signal orchestration for modern GTM teams.</p>
      </div>
      <div class="flex flex-wrap gap-3 text-sm text-slate-500">
        <a href="#features" class="hover:text-slate-900">Features</a>
        <a href="#proof" class="hover:text-slate-900">Proof</a>
        <a href="#pricing" class="hover:text-slate-900">Pricing</a>
      </div>
    </div>
  </div>
</section>`,
            },
        ]),
    },
    {
        id: 'creator-course',
        name: 'Creator Course',
        category: 'Creator',
        description: 'A warm, conversion-focused page for selling a course, cohort, or digital workshop.',
        designStyle: 'playful',
        preview: {
            eyebrow: 'Education',
            title: 'Creator-led course page with story and offer framing',
            accent: 'linear-gradient(135deg, #ec4899 0%, #f97316 100%)',
        },
        buildBlocks: () => buildTemplateBlocks([
            {
                label: 'Navigation',
                html: `
<section data-block-id="navigation" id="home" class="bg-white/80 backdrop-blur border-b border-rose-100">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex items-center justify-between py-4">
      <a href="#hero" class="text-lg font-semibold text-rose-950">Creator Sprint</a>
      <nav class="hidden md:flex items-center gap-8 text-sm text-rose-700">
        <a href="#outcomes" class="hover:text-rose-950">Outcomes</a>
        <a href="#curriculum" class="hover:text-rose-950">Curriculum</a>
        <a href="#cta" class="hover:text-rose-950">Enroll</a>
      </nav>
      <a href="#cta" class="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white">Enroll now</a>
    </div>
  </div>
</section>`,
            },
            {
                label: 'Hero',
                html: `
<section data-block-id="hero" id="hero" class="bg-[radial-gradient(circle_at_top_left,_rgba(251,113,133,0.22),_transparent_34%),linear-gradient(180deg,#fff7ed_0%,#ffffff_100%)] pt-16">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
    <div class="grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
      <div>
        <div class="inline-flex items-center rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-rose-600">Cohort-based program</div>
        <h1 class="mt-6 text-4xl font-semibold leading-tight text-rose-950 sm:text-5xl">Turn your expertise into a paid, repeatable digital product in 30 days.</h1>
        <p class="mt-6 max-w-xl text-lg text-rose-900/75">Creator Sprint helps solo creators package an offer, build a conversion page, and launch with confidence using proven prompts, templates, and feedback loops.</p>
        <div class="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="#cta" class="rounded-full bg-rose-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/20">Save your seat</a>
          <a href="#curriculum" class="rounded-full border border-rose-200 px-6 py-3 text-sm font-semibold text-rose-700">See the curriculum</a>
        </div>
      </div>
      <div class="rounded-[32px] border border-rose-100 bg-white p-6 shadow-[0_24px_80px_rgba(244,63,94,0.12)]">
        <div class="rounded-[24px] bg-rose-50 p-6">
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-rose-500">Inside the cohort</p>
          <ul class="mt-5 space-y-4 text-sm text-rose-950/80">
            <li class="rounded-2xl bg-white px-4 py-4">Week 1: choose your offer and craft a page concept</li>
            <li class="rounded-2xl bg-white px-4 py-4">Week 2: shape messaging, pricing, and proof</li>
            <li class="rounded-2xl bg-white px-4 py-4">Week 3: build the page and launch your waitlist</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</section>`,
            },
            {
                label: 'Outcomes',
                html: `
<section data-block-id="outcomes" id="outcomes" class="bg-white py-20">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="max-w-2xl">
      <p class="text-sm font-semibold uppercase tracking-[0.2em] text-rose-500">What you leave with</p>
      <h2 class="mt-4 text-3xl font-semibold text-rose-950 sm:text-4xl">A launch-ready offer, a clear landing page, and a repeatable promotion system.</h2>
    </div>
    <div class="mt-12 grid gap-6 md:grid-cols-3">
      <div class="rounded-[24px] border border-rose-100 bg-rose-50 p-6">
        <h3 class="text-lg font-semibold text-rose-950">Sharper positioning</h3>
        <p class="mt-3 text-sm leading-6 text-rose-900/75">Translate your expertise into outcomes buyers actually pay for.</p>
      </div>
      <div class="rounded-[24px] border border-orange-100 bg-orange-50 p-6">
        <h3 class="text-lg font-semibold text-orange-950">Launch assets</h3>
        <p class="mt-3 text-sm leading-6 text-orange-900/75">Build the page, CTA path, and launch sequence without getting stuck in tools.</p>
      </div>
      <div class="rounded-[24px] border border-amber-100 bg-amber-50 p-6">
        <h3 class="text-lg font-semibold text-amber-950">Momentum</h3>
        <p class="mt-3 text-sm leading-6 text-amber-900/75">Ship with a small group of peers, weekly deadlines, and clear next actions.</p>
      </div>
    </div>
  </div>
</section>`,
            },
            {
                label: 'Curriculum',
                html: `
<section data-block-id="curriculum" id="curriculum" class="bg-rose-950 py-20 text-white">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid gap-6 lg:grid-cols-3">
      <div class="rounded-[28px] border border-white/10 bg-white/5 p-6">
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-rose-200">Module 1</p>
        <h3 class="mt-4 text-xl font-semibold">Offer architecture</h3>
        <p class="mt-3 text-sm leading-6 text-rose-100/80">Positioning, audience narrowing, pricing, and promise design.</p>
      </div>
      <div class="rounded-[28px] border border-white/10 bg-white/5 p-6">
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-rose-200">Module 2</p>
        <h3 class="mt-4 text-xl font-semibold">Landing page build</h3>
        <p class="mt-3 text-sm leading-6 text-rose-100/80">Structure, proof, CTA flow, FAQs, and launch copy.</p>
      </div>
      <div class="rounded-[28px] border border-white/10 bg-white/5 p-6">
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-rose-200">Module 3</p>
        <h3 class="mt-4 text-xl font-semibold">Launch operations</h3>
        <p class="mt-3 text-sm leading-6 text-rose-100/80">Email sequencing, urgency, social promotion, and post-launch iteration.</p>
      </div>
    </div>
  </div>
</section>`,
            },
            {
                label: 'CTA Footer',
                html: `
<section data-block-id="cta" id="cta" class="bg-white py-20">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="rounded-[30px] bg-gradient-to-r from-rose-500 via-pink-500 to-orange-400 p-8 text-white lg:p-10">
      <p class="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">Next cohort opens this month</p>
      <h2 class="mt-4 text-3xl font-semibold sm:text-4xl">Join Creator Sprint and launch with momentum.</h2>
      <div class="mt-8 flex flex-col gap-3 sm:flex-row">
        <a href="#home" class="rounded-full bg-white px-6 py-3 text-sm font-semibold text-rose-700">Reserve your seat</a>
        <a href="#curriculum" class="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white">Review curriculum</a>
      </div>
    </div>
  </div>
</section>`,
            },
        ]),
    },
    {
        id: 'agency-studio',
        name: 'Agency Studio',
        category: 'Agency',
        description: 'A premium service-business page with positioning, process, and case-study framing.',
        designStyle: 'elegant',
        preview: {
            eyebrow: 'Agency',
            title: 'Premium lead-gen page for service firms and studios',
            accent: 'linear-gradient(135deg, #1e293b 0%, #d4a574 100%)',
        },
        buildBlocks: () => buildTemplateBlocks([
            {
                label: 'Hero',
                html: `
<section data-block-id="hero" id="hero" class="bg-slate-950 text-white">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-28">
    <p class="text-sm font-semibold uppercase tracking-[0.22em] text-amber-200">Northline Studio</p>
    <div class="mt-6 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
      <div>
        <h1 class="text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">Brand systems and high-conviction landing pages for ambitious software companies.</h1>
        <p class="mt-6 max-w-xl text-lg text-slate-300">We help early and growth-stage teams sharpen positioning, refine visual systems, and ship pages that actually convert.</p>
        <div class="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="#cta" class="rounded-full bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950">Book a discovery call</a>
          <a href="#work" class="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white">See recent work</a>
        </div>
      </div>
      <div class="rounded-[30px] border border-white/10 bg-white/5 p-6 backdrop-blur">
        <p class="text-sm uppercase tracking-[0.16em] text-slate-400">Selected outcomes</p>
        <div class="mt-6 grid gap-4 sm:grid-cols-2">
          <div class="rounded-2xl bg-white/5 p-5">
            <p class="text-3xl font-semibold text-amber-200">+42%</p>
            <p class="mt-2 text-sm text-slate-300">Higher demo conversion after homepage repositioning</p>
          </div>
          <div class="rounded-2xl bg-white/5 p-5">
            <p class="text-3xl font-semibold text-amber-200">5 weeks</p>
            <p class="mt-2 text-sm text-slate-300">From strategy sprint to launch-ready page system</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`,
            },
            {
                label: 'Process',
                html: `
<section data-block-id="process" id="process" class="bg-[#faf5ef] py-20 text-slate-900">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="max-w-2xl">
      <p class="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">How we work</p>
      <h2 class="mt-4 text-3xl font-semibold sm:text-4xl">A clear delivery process that gets alignment fast and reduces churn.</h2>
    </div>
    <div class="mt-12 grid gap-6 lg:grid-cols-3">
      <div class="rounded-[24px] border border-amber-200 bg-white p-6">
        <p class="text-sm font-semibold text-amber-700">01 Strategy sprint</p>
        <p class="mt-4 text-sm leading-6 text-slate-600">Clarify audience, positioning, proof, and narrative structure before design starts.</p>
      </div>
      <div class="rounded-[24px] border border-amber-200 bg-white p-6">
        <p class="text-sm font-semibold text-amber-700">02 Visual system</p>
        <p class="mt-4 text-sm leading-6 text-slate-600">Build the design language, component rules, and layout rhythm for the page set.</p>
      </div>
      <div class="rounded-[24px] border border-amber-200 bg-white p-6">
        <p class="text-sm font-semibold text-amber-700">03 Launch handoff</p>
        <p class="mt-4 text-sm leading-6 text-slate-600">Deliver a polished static marketing site that is ready to deploy anywhere.</p>
      </div>
    </div>
  </div>
</section>`,
            },
            {
                label: 'Work',
                html: `
<section data-block-id="work" id="work" class="bg-white py-20">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid gap-6 lg:grid-cols-2">
      <div class="rounded-[28px] border border-slate-200 p-8">
        <p class="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Case study</p>
        <h3 class="mt-4 text-2xl font-semibold text-slate-900">Reframed a crowded analytics product into a category-defining sales story.</h3>
        <p class="mt-4 text-sm leading-6 text-slate-600">Messaging refresh, proof hierarchy, and a static launch page rebuilt for enterprise buyers.</p>
      </div>
      <div class="rounded-[28px] border border-slate-200 p-8">
        <p class="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Case study</p>
        <h3 class="mt-4 text-2xl font-semibold text-slate-900">Turned an underperforming website into a focused conversion path for demos.</h3>
        <p class="mt-4 text-sm leading-6 text-slate-600">Offer simplification, proof design, and clearer CTA sequencing across the funnel.</p>
      </div>
    </div>
  </div>
</section>`,
            },
            {
                label: 'CTA',
                html: `
<section data-block-id="cta" id="cta" class="bg-slate-900 py-20 text-white">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex flex-col gap-6 rounded-[30px] border border-white/10 bg-white/5 p-8 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.2em] text-amber-200">Availability</p>
        <h2 class="mt-4 text-3xl font-semibold">Now booking two new strategy-and-page engagements for next month.</h2>
      </div>
      <a href="#hero" class="rounded-full bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950">Start the conversation</a>
    </div>
  </div>
</section>`,
            },
        ]),
    },
    {
        id: 'local-services',
        name: 'Local Services',
        category: 'Local Business',
        description: 'A service landing page with trust, service highlights, and a direct booking CTA.',
        designStyle: 'minimal',
        preview: {
            eyebrow: 'Local Business',
            title: 'Simple lead-gen page for service providers',
            accent: 'linear-gradient(135deg, #0f172a 0%, #6b7280 100%)',
        },
        buildBlocks: () => buildTemplateBlocks([
            {
                label: 'Hero',
                html: `
<section data-block-id="hero" id="hero" class="bg-white py-20">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
      <div>
        <p class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Harbor Home Services</p>
        <h1 class="mt-4 text-4xl font-semibold leading-tight text-slate-950 sm:text-5xl">Fast, dependable home repair and maintenance without the scheduling headache.</h1>
        <p class="mt-6 max-w-xl text-lg text-slate-600">Book plumbing, electrical, fixture, and general home maintenance with a local team known for clear estimates and on-time arrivals.</p>
        <div class="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="#cta" class="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white">Request a callback</a>
          <a href="#services" class="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700">View services</a>
        </div>
        <div class="mt-8 flex flex-wrap gap-5 text-sm text-slate-500">
          <span>Licensed and insured</span>
          <span>Same-week availability</span>
          <span>4.9 rating across 300+ jobs</span>
        </div>
      </div>
      <div class="rounded-[28px] border border-slate-200 bg-slate-50 p-6">
        <div class="rounded-[22px] bg-white p-6 shadow-sm">
          <p class="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Popular request</p>
          <h2 class="mt-3 text-2xl font-semibold text-slate-900">Book a 15-minute estimate call</h2>
          <p class="mt-3 text-sm leading-6 text-slate-600">Tell us the issue, your address, and your preferred timing. We will follow up within one business hour.</p>
        </div>
      </div>
    </div>
  </div>
</section>`,
            },
            {
                label: 'Services',
                html: `
<section data-block-id="services" id="services" class="bg-slate-50 py-20">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-[24px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h3 class="text-lg font-semibold text-slate-900">Plumbing repairs</h3>
        <p class="mt-3 text-sm leading-6 text-slate-600">Leaks, fixture installs, drain issues, and water pressure fixes.</p>
      </div>
      <div class="rounded-[24px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h3 class="text-lg font-semibold text-slate-900">Electrical work</h3>
        <p class="mt-3 text-sm leading-6 text-slate-600">Lighting installs, switches, outlets, and minor troubleshooting.</p>
      </div>
      <div class="rounded-[24px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h3 class="text-lg font-semibold text-slate-900">Home maintenance</h3>
        <p class="mt-3 text-sm leading-6 text-slate-600">Seasonal maintenance, patching, hardware updates, and tune-ups.</p>
      </div>
      <div class="rounded-[24px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h3 class="text-lg font-semibold text-slate-900">Emergency visits</h3>
        <p class="mt-3 text-sm leading-6 text-slate-600">Priority support for urgent issues across the service area.</p>
      </div>
    </div>
  </div>
</section>`,
            },
            {
                label: 'Trust',
                html: `
<section data-block-id="trust" id="trust" class="bg-white py-20">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid gap-6 lg:grid-cols-3">
      <div class="rounded-[24px] border border-slate-200 p-6">
        <p class="text-3xl font-semibold text-slate-900">4.9/5</p>
        <p class="mt-2 text-sm text-slate-600">Average customer rating across repeat homeowners.</p>
      </div>
      <div class="rounded-[24px] border border-slate-200 p-6">
        <p class="text-3xl font-semibold text-slate-900">1 hour</p>
        <p class="mt-2 text-sm text-slate-600">Response target for call-back requests during business hours.</p>
      </div>
      <div class="rounded-[24px] border border-slate-200 p-6">
        <p class="text-3xl font-semibold text-slate-900">300+</p>
        <p class="mt-2 text-sm text-slate-600">Completed service jobs across the metro area in the last year.</p>
      </div>
    </div>
  </div>
</section>`,
            },
            {
                label: 'CTA',
                html: `
<section data-block-id="cta" id="cta" class="bg-slate-950 py-20 text-white">
  <div class="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
    <div class="rounded-[28px] bg-white/5 p-8 ring-1 ring-white/10 lg:p-10">
      <h2 class="text-3xl font-semibold">Need help this week?</h2>
      <p class="mt-4 max-w-2xl text-slate-300">Send a request with your service type and preferred time window. We will confirm the next available slot.</p>
      <div class="mt-8 flex flex-col gap-3 sm:flex-row">
        <a href="#hero" class="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950">Book a callback</a>
        <a href="#services" class="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white">Review services</a>
      </div>
    </div>
  </div>
</section>`,
            },
        ]),
    },
];

export function getTemplateById(templateId: string | null | undefined): TemplateDefinition | undefined {
    if (!templateId) return undefined;
    return TEMPLATE_LIBRARY.find((template) => template.id === templateId);
}