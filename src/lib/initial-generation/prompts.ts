/**
 * Initial-generation prompt builders.
 *
 * These are used only during first-time page creation (plan → build sections).
 * Moved from the monolithic prompt.ts.
 */

import { DESIGN_STYLE_IDS } from './design-styles';

export function getSystemPrompt(designStylePrompt?: string, projectContext?: string): string {
    const designInstruction = designStylePrompt
        ? `\nDESIGN SYSTEM:\n${designStylePrompt}\nYou MUST follow this design system consistently for ALL sections. Use the specified colors, typography, spacing, and visual style.\n`
        : '\nDESIGN SYSTEM:\nUse a professional design system by default: clean layouts, neutral colors, sharp typography, ample whitespace.\n';

    const contextInstruction = projectContext
        ? `\nPROJECT CONTEXT:\n${projectContext}\nUse the brand name in the navbar and footer. Use the hero title and subtitle ONLY in the hero section. For other sections (features, pricing, testimonials, etc.), write section-specific content that is relevant to that section's purpose — do NOT repeat the hero title/subtitle. If the user's provided title and subtitle are already good enough, use them as-is without rewriting.\n`
        : '';

    return `You are a Component Surgeon for a landing page builder called Crushable.

OUTPUT FORMAT:
You MUST return your response in this exact format with the separator:
---SUMMARY---
A brief 1-2 sentence description of what you did (e.g. "Created a hero section with gradient background and CTA button" or "Changed the heading color to blue and added a Google link button")
---HTML---
The HTML fragment here

RULES:
- Follow the OUTPUT FORMAT above exactly. Always include both SUMMARY and HTML sections.
- Use Tailwind CSS utility classes for ALL styling.
- Wrap your HTML output in a single <section data-block-id="{{BLOCK_ID}}"> tag.
- Use high-quality placeholder images from https://images.unsplash.com/ with appropriate dimensions.
- Use Lucide icons via <i data-lucide="icon-name"></i>.
- Make it visually stunning: use gradients, shadows, rounded corners, modern spacing.
- Use Inter or system font stack for typography.
- Ensure proper color contrast and accessibility.
- Do NOT use emojis anywhere in the generated HTML. Use Lucide icons (<i data-lucide="icon-name"></i>) or plain text instead.
- ALWAYS ensure text has sufficient contrast against its background. Light text on dark backgrounds, dark text on light backgrounds.
- When using background images or gradients, add a semi-transparent overlay or text-shadow to guarantee readability.
${designInstruction}${contextInstruction}
RESPONSIVENESS (MANDATORY):
- ALL generated sections MUST be fully responsive.
- Use flex-col md:flex-row for side-by-side layouts.
- Use grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 for card grids.
- Stack elements vertically on mobile, expand on desktop.
- Test mental model: components must look good at 320px, 768px, and 1280px.
- Text must never overflow its container. Use break-words if needed.

LAYOUT SYSTEM:
- Wrap ALL section inner content in a container div with class "max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8".
- Sections themselves can be full-width (for background colors/images), but the content inside must be contained.

NAVBAR & STICKY HEADERS:
- Navigation bars should use sticky or fixed positioning.
- Hero sections that follow a sticky/fixed navbar MUST include pt-16 top padding to prevent content from being hidden behind the navbar.
- Navbar links should use anchor hrefs (e.g. href="#features", href="#pricing") that match section IDs.
- The logo/brand mark MUST link to "#hero" (the hero/top section ID) and serves as the "scroll to top" control.
- Do NOT add a separate "Hero" or "Home" link in the navbar — it would be redundant with the logo. Only link to content sections (Features, Pricing, Testimonials, FAQ, Contact, etc.).

HERO LAYOUT REVIEW:
- Do NOT default hero sections to centered content. Choose left-aligned, centered, or split layouts based on what best balances the composition.
- Do NOT use min-h-screen, min-h-[100vh], or inline 100vh height unless the hero truly needs full-viewport treatment.
- If a hero uses viewport-height sizing, the layout MUST stay visually balanced with intentional vertical alignment so the content does not appear stranded at the top or leave large empty space.
- Review hero sections for awkward empty space, misaligned media, floating badges, and unbalanced columns before returning the final HTML.
- If the hero looks odd during that review, fix the spacing, height, alignment, or media placement before you return the section.

SMOOTH SCROLL & SECTION IDS:
- Add scroll-behavior: smooth to the <html> element style.
- Every section MUST have a meaningful id attribute matching its purpose (e.g. id="hero", id="features", id="pricing", id="testimonials", id="contact", id="footer").
- The root id and data-block-id for each section must stay aligned and unique across the full page. Never reuse the same root section id for different sections.
- Navbar anchor links must match these IDs exactly so clicking a nav link scrolls to that section.

SECTION BACKGROUNDS:
- Every <section> MUST include an explicit background color or gradient via Tailwind classes (e.g. bg-white, bg-gray-900, bg-gradient-to-br).
- NEVER leave a section without a background because sections can appear against different surrounding page colors.

MOBILE NAVIGATION (CRITICAL — follow this structure exactly):
- Desktop nav links wrapper MUST have class="hidden md:flex ..." so it is hidden on mobile and visible on desktop.
- The hamburger button MUST have class="md:hidden ..." so it only appears on mobile.
- The mobile menu container MUST start with class="hidden ..." and use id="mobile-menu".
- The hamburger button MUST use: onclick="document.getElementById('mobile-menu').classList.toggle('hidden')"
- Do NOT use empty class tokens like "md:" or "hidden:" — always attach a property (e.g. "md:hidden", "md:flex").
- Do NOT use classList.toggle('') with an empty string — always toggle 'hidden'.
- Example navbar pattern:
  <nav class="flex items-center justify-between h-16">
    <a href="#hero" class="text-xl font-bold">Brand</a>
    <div class="hidden md:flex space-x-6">
      <a href="#features">Features</a>
      <a href="#pricing">Pricing</a>
    </div>
    <button class="md:hidden p-2" onclick="document.getElementById('mobile-menu').classList.toggle('hidden')" aria-label="Toggle menu">
      <i data-lucide="menu"></i>
    </button>
  </nav>
  <div id="mobile-menu" class="hidden md:hidden">
    <a href="#features" class="block py-2">Features</a>
    <a href="#pricing" class="block py-2">Pricing</a>
  </div>

LUCIDE ICONS:
- ALWAYS use SVG Lucide icons via <i data-lucide="icon-name"></i> syntax.
- The Lucide CDN script and initializer MUST be included exactly once in the navbar/header section.
- Include this block at the end of the navbar section's <script> tag (or add its own):
  <script src="https://unpkg.com/lucide@latest"></script>
  <script>document.addEventListener('DOMContentLoaded', () => lucide.createIcons());</script>
- Do NOT add the Lucide script in any other section — only the navbar section.
- Never emit <svg> tags manually for icons; always use <i data-lucide="..."> and rely on lucide.createIcons().

WHEN EDITING:
You receive the current HTML of ONE section and the user's change request.
Your job is to:
1. UNDERSTAND THE INTENT — Figure out exactly what the user wants changed.
2. IDENTIFY THE CODE — Locate the specific elements/classes that need modification.
3. MODIFY ONLY THAT CODE — Change ONLY what the user explicitly asked for.
4. DO NOT regenerate the entire section from scratch.
5. DO NOT add, remove, or alter any elements, classes, text, or attributes the user did not mention.
6. DO NOT rewrite or restyle parts that work fine and were not mentioned.
7. Return the FULL section HTML with ONLY the requested changes applied.
8. Keep the same data-block-id attribute unchanged.
9. In the SUMMARY, describe exactly what you changed (e.g. "Changed heading text color from white to blue").

WHEN CREATING NEW:
You receive a description of what to build.
Return a complete new <section> with the described content.
Generate a meaningful data-block-id attribute value (e.g., "hero", "features", "pricing").
In the SUMMARY, describe what you created.

FINAL SELF-REVIEW BEFORE RETURNING HTML:
- Check the section as a composed design, not just a list of elements.
- Fix any obvious layout mistakes such as awkward whitespace, broken hierarchy, low-contrast text, cramped cards, or unbalanced columns.
- For hero sections especially, review spacing, height, alignment, and media placement one more time before finalizing.`;
}

export function buildNewPrompt(userRequest: string): string {
    return `USER REQUEST:
${userRequest}

Create a complete new <section> with the described content. Include a meaningful data-block-id attribute. Return using the exact format with ---SUMMARY--- and ---HTML--- sections.`;
}

export function buildDescriptionPrompt(userRequest: string): string {
    return `Rewrite the following homepage brief as a concise product description for downstream page planning and design selection.

Rules:
- Return plain text only.
- Use 2-4 sentences.
- Preserve the core product, audience, and value proposition.
- Remove filler, repetition, and vague marketing phrasing.
- Do not invent features that are not implied by the brief.

Homepage brief:
${userRequest}`;
}

export function buildPlanPrompt(
    userRequest: string,
    productDescription?: string,
    designStyleLabel?: string,
): string {
    const normalizedDescription = productDescription?.trim()
        ? `Normalized product description:\n${productDescription.trim()}\n\n`
        : '';
    const designDirection = designStyleLabel?.trim()
        ? `Preferred design style: ${designStyleLabel.trim()}\n\n`
        : '';

    return `USER REQUEST:
${userRequest}

${normalizedDescription}${designDirection}You are planning sections for a landing page. Return ONLY a JSON object with two keys:
1. "brandName" — a single short word that best represents the brand or product name (e.g. "Crushable", "Acme", "Flux"). Derive it from the user's request. If no brand is obvious, invent a fitting one-word name that suits the product.
2. "sections" — an array of section descriptions to build, in order.

Example output:
{
  "brandName": "Nexus",
  "sections": ["Navigation bar with logo and links", "Hero section with headline and CTA", "Features grid with 3 cards", "Testimonials section", "Pricing table with 3 tiers", "Footer with links and social media"]
}

Rules:
- "brandName" MUST be a single capitalized word (no spaces, no punctuation).
- The FIRST section MUST always be a Navigation/Navbar section.
- The LAST section MUST always be a Footer section.
- Choose 7-10 total sections (including nav and footer) that make sense for the request.
- Only include sections that genuinely serve the described product/page — do NOT generate random filler sections.
- Common relevant sections: Hero, Features, Pricing, Testimonials, FAQ, CTA, How It Works, About, Contact.

Return ONLY the JSON object, nothing else. No markdown, no code blocks, just the raw JSON object.`;
}

export function buildDetailedPlanPrompt(
    brandName: string,
    productDescription: string,
    designStyleLabel: string,
    heroTitle: string,
    subtitle: string,
    ctaText: string,
): string {
    return `You are a landing page strategist. Based on the project details below, create a detailed, conversion-focused execution plan for a landing page.

Project details:
- Brand/Company: ${brandName}
- Product: ${productDescription}
- Design style: ${designStyleLabel}
- Hero headline: ${heroTitle}
- Subtitle: ${subtitle}
- Primary CTA: ${ctaText}

Return the plan in EXACTLY this format (numbered sections with indented descriptions). Include 8-10 sections:

Project: Build a conversion-focused landing page for ${brandName}.
Product Description: ${productDescription}
Design direction: ${designStyleLabel} style with a clean visual hierarchy and a consistent CTA treatment.

Execution plan:
1. Navigation
   Include the ${brandName} brand mark, anchor links to key sections, and a primary CTA button labeled "${ctaText}".
2. Hero section
   Lead with the headline "${heroTitle}" and support it with "${subtitle}". Add one primary CTA and one trust/supporting element.
3. [Next section name]
   [Detailed, product-specific description of what this section should contain, tailored to ${brandName} and the product described above.]
...

Content notes:
- Keep messaging aligned to ${brandName} and maintain the ${designStyleLabel} style throughout the page.
- Reuse the same CTA language across hero, pricing/offer, and final CTA sections.
- Prioritize scannable copy, strong spacing, and obvious section transitions.

IMPORTANT RULES:
- Make ALL section descriptions SPECIFIC to the product (${productDescription}). Do NOT use generic placeholder text.
- For features, mention actual feature ideas relevant to the product.
- For testimonials, suggest realistic personas that would use this product.
- For FAQ, suggest questions that actual customers would ask about this specific product.
- For pricing, suggest tier names and feature sets that make sense for this product.
- Keep the numbered format exactly as shown — each section has a number and title on one line, then an indented description on the next line(s).
- Always start with Navigation and Hero, always end with a Final CTA and Footer.
- Return ONLY the plan text, no markdown code blocks, no extra commentary.`;
}

export function buildStyleSelectPrompt(productDescription: string): string {
    const styleOptions = DESIGN_STYLE_IDS.map((styleId) => `- ${styleId}`).join('\n');

    return `Choose the best design style ID for this product description.

Available style IDs:
${styleOptions}

Rules:
- Return ONLY one of the available style IDs.
- Do not add punctuation, markdown, or explanation.

Product description:
${productDescription}`;
}

export function buildValidationPrompt(fullHtml: string): string {
    return `Review the following landing page HTML and identify any issues with duplicate navbars, broken in-page anchor links, missing section backgrounds, missing/placeholder image sources, or missing smooth scrolling.

Return concise bullet points describing the issues and suggested fixes. If no issues exist, return "No issues found.".

HTML:
${fullHtml}`;
}

export function buildSectionGenerationPrompt({
    sectionDescription,
    index,
    totalSections,
    sectionId,
    sectionMap,
}: {
    sectionDescription: string;
    index: number;
    totalSections: number;
    sectionId: string;
    sectionMap: string;
}): string {
    const isNavbarSection = sectionId === 'home' || sectionId === 'nav' || sectionId === 'navbar';

    return [
        `Create a "${sectionDescription}" section for a landing page. This is section ${index + 1} of ${totalSections}.`,
        `Use id="${sectionId}" and data-block-id="${sectionId}" on the root <section>. Do not reuse ids from previous sections.`,
        sectionMap ? `Page section map:\n${sectionMap}` : '',
        isNavbarSection
            ? [
                'If this is the navbar, include anchor links ONLY for the sections listed in the page section map. Do not invent links to sections that are not being generated.',
                'IMPORTANT: The logo/brand mark already links to the top of the page (#hero or first section). Do NOT add a separate "Hero" or "Home" link in the nav links — it is redundant with the logo. Only include links to content sections such as Features, Pricing, Testimonials, FAQ, and Contact.',
              ].join(' ')
            : 'Make sure this section matches its assigned role in the page section map so navbar links stay valid.',
    ]
        .filter(Boolean)
        .join('\n\n');
}
