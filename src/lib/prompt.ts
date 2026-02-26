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
- Be responsive: use sm:, md:, lg: breakpoints.
- Use Inter or system font stack for typography.
- Ensure proper color contrast and accessibility.
${designInstruction}${contextInstruction}
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
In the SUMMARY, describe what you created.`;
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
