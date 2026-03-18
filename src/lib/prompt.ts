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

MOBILE NAVIGATION:
- Mobile hamburger menus MUST use inline onclick handlers with plain JavaScript.
- The toggle script must work without external dependencies.
- Example pattern: <button onclick="document.getElementById('mobile-menu').classList.toggle('hidden')">
- Include the menu toggle script inline within the section, wrapped in a <script> tag at the end.

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

export function buildEditPrompt(blockHtml: string, userRequest: string, blockId: string): string {
    return `CURRENT SECTION HTML (block ID: "${blockId}"):
${blockHtml}

USER REQUEST:
${userRequest}

IMPORTANT: Analyze the user's request carefully. Identify the SPECIFIC elements that need to change. Modify ONLY those elements. Do NOT touch, rewrite, or regenerate any other part of this section. Return using the exact format with ---SUMMARY--- and ---HTML--- sections. Keep the same data-block-id.`;
}

export function buildNewPrompt(userRequest: string): string {
    return `USER REQUEST:
${userRequest}

Create a complete new <section> with the described content. Include a meaningful data-block-id attribute. Return using the exact format with ---SUMMARY--- and ---HTML--- sections.`;
}

export function buildTemplateFillPrompt(
    skeleton: string,
    projectContext: string,
    sectionRole: string,
): string {
    return `You are filling a landing page section template with conversion-focused content.

SECTION ROLE:
${sectionRole}

PROJECT CONTEXT:
${projectContext}

TEMPLATE SKELETON:
${skeleton}

Return ONLY a JSON object where each key matches a {{placeholder}} token from the template and each value contains the replacement HTML-safe content.

Rules:
- Return JSON only.
- Do not return the template itself.
- For list-like placeholders, return fully rendered HTML snippets that can be inserted directly.
- Keep copy specific to the product context and section role.`;
}

export function buildTemplateSelectionPrompt(
    sections: string[],
    templateCatalog: string,
    designStyle?: string,
): string {
    return `Select the best template ID for each planned landing page section.

PLANNED SECTIONS:
${sections.map((section, index) => `${index + 1}. ${section}`).join('\n')}

DESIGN STYLE:
${designStyle || 'professional'}

AVAILABLE TEMPLATES:
${templateCatalog}

Return ONLY a JSON object where each key is the section title and each value is the best template ID.
If no template is a strong match, omit that section.`;
}

export function buildCompositionPrompt(
    componentCatalog: string,
    projectContext: string,
    sectionPlan: string[],
): string {
    return `You are composing a landing page from a component library.

PROJECT CONTEXT:
${projectContext}

SECTION PLAN:
${sectionPlan.map((section, index) => `${index + 1}. ${section}`).join('\n')}

COMPONENT LIBRARY:
${componentCatalog}

Return ONLY a JSON array. Each item must have:
- componentId
- props (an object of strings or string arrays)

The array order must match the section plan.`;
}

export function buildPatchEditPrompt(blockHtml: string, userRequest: string): string {
    return `You are generating a surgical JSON patch for an existing landing page section.

CURRENT SECTION HTML:
${blockHtml}

USER REQUEST:
${userRequest}

Return ONLY JSON in this shape:
{
  "ops": [
    { "type": "replace", "selector": "h2", "oldText": "Old", "newText": "New" },
    { "type": "addClass", "selector": "a", "classes": "bg-blue-600" }
  ]
}

Allowed op types: replace, setAttribute, addClass, removeClass, insertAfter, insertBefore, remove.
Use CSS selectors scoped to the provided section only. Do not return HTML.`;
}

export function buildCritiquePrompt(sectionHtml: string, sectionRole: string, designStyle: string): string {
    return `You are critiquing a landing page section before launch.

SECTION ROLE:
${sectionRole}

DESIGN STYLE:
${designStyle}

SECTION HTML:
${sectionHtml}

Return ONLY JSON with these keys:
- visualAppeal (1-10)
- copyQuality (1-10)
- conversionPotential (1-10)
- mobileReadiness (1-10)
- issues (array of short strings)
- suggestedPrompt (one concise edit prompt that would improve the section)`;
}

export function getElementEditSystemPrompt(designStylePrompt?: string, projectContext?: string): string {
    const designInstruction = designStylePrompt
        ? `\nDESIGN SYSTEM:\n${designStylePrompt}\nKeep the updated element consistent with this design system.\n`
        : '';

    const contextInstruction = projectContext
        ? `\nPROJECT CONTEXT:\n${projectContext}\nUse it only when it directly helps the targeted element edit.\n`
        : '';

    return `You are editing a single HTML element inside a landing page section.

OUTPUT RULES:
- Return ONLY the updated HTML for the selected element.
- Do NOT return markdown, explanations, code fences, or surrounding section HTML.
- Preserve any attributes, classes, and nested structure that are not required to satisfy the request.
- Keep the element compatible with Tailwind CSS utility classes.
- Do not invent unrelated content or alter nearby elements.
${designInstruction}${contextInstruction}`;
}

export function buildElementEditPrompt(elementHtml: string, userRequest: string, blockId: string): string {
    return `CURRENT ELEMENT HTML (inside block "${blockId}"):
${elementHtml}

USER REQUEST:
${userRequest}

Return only the updated HTML for this exact element.`;
}

/**
 * Build a prompt to plan which sections a landing page needs.
 */
export function buildPlanPrompt(userRequest: string): string {
    return `USER REQUEST:
${userRequest}

You are planning sections for a landing page. Return ONLY a JSON array of section names to build, in order. Each item should be a short description of that section.

Example output:
["Navigation bar with logo and links", "Hero section with headline and CTA", "Features grid with 3 cards", "Testimonials section", "Pricing table with 3 tiers", "Footer with links and social media"]

Return ONLY the JSON array, nothing else. No markdown, no code blocks, just the raw JSON array. Choose 4-6 sections that make sense for the request.`;
}

/**
 * Build a prompt to generate a detailed, product-specific landing page plan.
 */
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

export function buildValidationPrompt(fullHtml: string): string {
    return `Review the following landing page HTML and identify any issues with duplicate navbars, broken in-page anchor links, missing section backgrounds, missing/placeholder image sources, or missing smooth scrolling.

Return concise bullet points describing the issues and suggested fixes. If no issues exist, return "No issues found.".

HTML:
${fullHtml}`;
}

export function buildStyleSelectPrompt(productDescription: string): string {
    return `Choose the best design style ID for this product description.

Available style IDs:
- professional
- playful
- minimal
- bold
- elegant

Rules:
- Return ONLY one of the five style IDs.
- Do not add punctuation, markdown, or explanation.

Product description:
${productDescription}`;
}

export function parseJsonObjectResponse<T>(response: string): T | null {
    try {
        const match = response.match(/\{[\s\S]*\}/);
        if (!match) return null;
        return JSON.parse(match[0]) as T;
    } catch {
        return null;
    }
}

export function parseJsonArrayResponse<T>(response: string): T[] | null {
    try {
        const match = response.match(/\[[\s\S]*\]/);
        if (!match) return null;
        return JSON.parse(match[0]) as T[];
    } catch {
        return null;
    }
}

/**
 * Parse the LLM response to extract summary and HTML.
 * Handles both the new format (with separators) and legacy format (raw HTML).
 */
export function parseResponse(response: string): { summary: string; html: string } {
    const summaryMatch = response.match(/---SUMMARY---\s*([\s\S]*?)\s*---HTML---/);
    const htmlMatch = response.match(/---HTML---\s*([\s\S]*)/);

    if (summaryMatch && htmlMatch) {
        return {
            summary: summaryMatch[1].trim(),
            html: htmlMatch[1].trim(),
        };
    }

    // Fallback: treat entire response as HTML (legacy format)
    return {
        summary: 'Generated section',
        html: response.trim(),
    };
}

/**
 * Parse a plan response (JSON array of section descriptions).
 */
export function parsePlanResponse(response: string): string[] {
    try {
        // Try to extract JSON array from response
        const match = response.match(/\[[\s\S]*\]/);
        if (match) {
            return JSON.parse(match[0]);
        }
    } catch {
        // Fall back to splitting by newlines
    }
    return ['Hero section', 'Features section', 'Footer'];
}
