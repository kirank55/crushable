/**
 * Pure parsing utilities shared by both engines.
 * These extract structured data from LLM responses — no prompt building here.
 */

/** Keywords that identify a section as a navbar/navigation. */
const NAV_PATTERN = /\b(nav|navbar|navigation|header|menu)\b/i;

/** Keywords that identify a section as a footer. */
const FOOTER_PATTERN = /\b(footer)\b/i;

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
 *
 * Throws if the expected ---SUMMARY--- / ---HTML--- delimiters are absent —
 * the LLM did not follow the output format and the caller must handle the error.
 */
/**
 * Repair truncated HTML by closing any unclosed tags.
 * This handles cases where the LLM response was cut off mid-HTML.
 */
function repairTruncatedHtml(html: string): string {
    // Remove any trailing incomplete tag (e.g., `<div class="foo` without closing `>`)
    const lastOpenBracket = html.lastIndexOf('<');
    const lastCloseBracket = html.lastIndexOf('>');
    if (lastOpenBracket > lastCloseBracket) {
        html = html.slice(0, lastOpenBracket);
    }

    // Track open tags that need closing
    const openTags: string[] = [];
    const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g;
    const selfClosingTags = new Set([
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
        'link', 'meta', 'param', 'source', 'track', 'wbr',
    ]);

    let match;
    while ((match = tagRegex.exec(html)) !== null) {
        const [fullMatch, tagName] = match;
        const lower = tagName.toLowerCase();
        if (selfClosingTags.has(lower) || fullMatch.endsWith('/>')) continue;

        if (fullMatch.startsWith('</')) {
            // Closing tag — pop matching open tag
            const idx = openTags.lastIndexOf(lower);
            if (idx !== -1) openTags.splice(idx, 1);
        } else {
            openTags.push(lower);
        }
    }

    // Close remaining open tags in reverse order
    if (openTags.length > 0) {
        html += openTags.reverse().map(tag => `</${tag}>`).join('');
    }

    return html;
}

export function parseResponse(response: string): { summary: string; html: string } {
    const summaryMatch = response.match(/---SUMMARY---\s*([\s\S]*?)\s*---HTML---/);
    const htmlMatch = response.match(/---HTML---\s*([\s\S]*)/);

    if (summaryMatch && htmlMatch) {
        let html = htmlMatch[1].trim();

        // Strip markdown code fences if present
        html = html.replace(/^```html?\s*/i, '').replace(/\s*```$/, '');

        // Repair any truncated/unclosed HTML tags
        html = repairTruncatedHtml(html);

        return {
            summary: summaryMatch[1].trim(),
            html,
        };
    }

    throw new Error(
        `parseResponse: LLM response missing required ---SUMMARY--- / ---HTML--- delimiters.\n` +
        `Raw response (first 500 chars): ${response.slice(0, 500)}`,
    );
}

/**
 * Parse a plan response — supports both the new `{ brandName, sections }` object
 * and the legacy plain JSON array (backward compat with older model outputs).
 *
 * Throws if no JSON is found or the JSON is malformed.
 *
 * Post-processing guard: ensures the plan always starts with a nav-like
 * section and ends with a footer. If the LLM forgot either, they are inserted.
 */
export function parsePlanResponse(response: string): { brandName: string; sections: string[] } {
    // Try object format first: { brandName, sections }
    const objectMatch = response.match(/\{[\s\S]*\}/);
    if (objectMatch) {
        try {
            const parsed = JSON.parse(objectMatch[0]) as { brandName?: string; sections?: unknown };
            if (Array.isArray(parsed.sections)) {
                const sections: string[] = parsed.sections as string[];
                const brandName = (typeof parsed.brandName === 'string' ? parsed.brandName : '').trim();

                // Ensure first section is navigation
                if (sections.length === 0 || !NAV_PATTERN.test(sections[0])) {
                    sections.unshift('Navigation bar with logo and links');
                }
                // Ensure last section is footer
                if (sections.length === 0 || !FOOTER_PATTERN.test(sections[sections.length - 1])) {
                    sections.push('Footer with links and social media');
                }

                return { brandName, sections };
            }
        } catch {
            // fall through to array format
        }
    }

    // Fallback: legacy plain array format
    const arrayMatch = response.match(/\[[\s\S]*\]/);
    if (!arrayMatch) {
        throw new Error(
            `parsePlanResponse: LLM response contains no JSON object or array.\n` +
            `Raw response (first 500 chars): ${response.slice(0, 500)}`,
        );
    }

    const sections: string[] = JSON.parse(arrayMatch[0]);

    if (sections.length === 0 || !NAV_PATTERN.test(sections[0])) {
        sections.unshift('Navigation bar with logo and links');
    }
    if (sections.length === 0 || !FOOTER_PATTERN.test(sections[sections.length - 1])) {
        sections.push('Footer with links and social media');
    }

    return { brandName: '', sections };
}
