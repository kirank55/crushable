/**
 * Modification-engine prompt builders.
 *
 * These are used only for post-generation modifications (edit, add-section, etc.).
 * Extracted from the monolithic prompt.ts.
 */

import { getSystemPrompt } from '@/lib/initial-generation/prompts';

export { getSystemPrompt };

export function buildEditPrompt(blockHtml: string, userRequest: string, blockId: string): string {
    return `CURRENT SECTION HTML (block ID: "${blockId}"):
${blockHtml}

USER REQUEST:
${userRequest}

IMPORTANT: Analyze the user's request carefully. Identify the SPECIFIC elements that need to change. Modify ONLY those elements. Do NOT touch, rewrite, or regenerate any other part of this section. Return using the exact format with ---SUMMARY--- and ---HTML--- sections. Keep the same data-block-id.`;
}

export function buildAddSectionPrompt(
    userRequest: string,
    existingSectionsSummary?: string,
): string {
    return `USER REQUEST:
${userRequest}

${existingSectionsSummary ? `EXISTING PAGE SECTIONS:\n${existingSectionsSummary}\n\n` : ''}You are adding ONE new section to an existing landing page.

Rules:
- Return exactly one new <section>.
- Do not recreate the entire page.
- Do not include duplicate navigation or footer sections unless the user explicitly asked for that.
- Choose a meaningful root id and data-block-id for the new section.
- Return using the exact format with ---SUMMARY--- and ---HTML--- sections.`;
}

export function buildGlobalStyleEditPrompt(
    blockHtml: string,
    userRequest: string,
    blockId: string,
): string {
    return `CURRENT SECTION HTML (block ID: "${blockId}"):
${blockHtml}

GLOBAL STYLE REQUEST:
${userRequest}

You are updating this section as part of a page-wide style change.

Rules:
- Preserve the section's role and core content.
- Preserve the same data-block-id.
- Update the visual treatment, spacing, typography, and supporting classes as needed to match the new style direction.
- Return the FULL updated section using the exact format with ---SUMMARY--- and ---HTML--- sections.`;
}

export function buildModificationIntentPrompt(
    userRequest: string,
    blocksSummary: string,
    selectedBlockId?: string | null,
    contentMatchHints?: string,
): string {
    return `You are resolving a user's intent for modifying an EXISTING landing page.

USER REQUEST:
${userRequest}

CURRENT PAGE SECTIONS:
${blocksSummary}

CURRENT SELECTION:
${selectedBlockId ? `Block "${selectedBlockId}" is currently selected. Treat it as a helpful hint, not a mandate.` : 'No section is currently selected.'}
${contentMatchHints || ''}

Return ONLY JSON with this shape:
{
  "requestKind": "section-edit" | "multi-section-edit" | "add-section" | "remove-section" | "global-style-edit",
  "selectedBlockId": "string or null",
  "targetBlockIds": ["string"],
  "summary": "short explanation",
  "confidence": "high" | "medium" | "low"
}

Rules:
- Choose the action that best matches the user's actual intent.
- Prefer updating existing content when the request refers to content that is already present on the page.

TEXT MATCHING (critical):
- When the user mentions specific text, find which section ACTUALLY CONTAINS that exact text in its headings or content.
- Do NOT match based on thematic similarity. "Unmatched Gaming Performance" and "Next-Gen Gaming Performance" are DIFFERENT strings in DIFFERENT sections — always use exact text matching.
- Headings are the strongest signal — if the user references a heading, that heading's section is almost certainly the target.
- If the CONTENT MATCH ANALYSIS section is present above, strongly prefer those matches.

SECTION TARGETING:
- Use the section headings, text content, and landmarks to identify the best target section(s).
- Use "multi-section-edit" only when the user clearly wants coordinated changes across multiple existing sections.
- Use "add-section" only when the user is asking for new section content that does not already exist.
- Use "global-style-edit" only for page-wide stylistic changes (e.g., "change all fonts", "make everything dark mode").
- For "section-edit" and "remove-section", return exactly one best target in "selectedBlockId".
- For "multi-section-edit", return all relevant block ids in "targetBlockIds".
- Never invent block ids.
- If the current selection conflicts with the user's request, ignore it.`;
}
