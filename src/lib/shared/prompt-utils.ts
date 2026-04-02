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
export function parseResponse(response: string): { summary: string; html: string } {
    const summaryMatch = response.match(/---SUMMARY---\s*([\s\S]*?)\s*---HTML---/);
    const htmlMatch = response.match(/---HTML---\s*([\s\S]*)/);

    if (summaryMatch && htmlMatch) {
        return {
            summary: summaryMatch[1].trim(),
            html: htmlMatch[1].trim(),
        };
    }

    throw new Error(
        `parseResponse: LLM response missing required ---SUMMARY--- / ---HTML--- delimiters.\n` +
        `Raw response (first 500 chars): ${response.slice(0, 500)}`,
    );
}

/**
 * Parse a plan response (JSON array of section descriptions).
 *
 * Throws if no JSON array is found or the JSON is malformed — the LLM did not
 * follow the output format and the caller must handle the error.
 *
 * Post-processing guard: ensures the plan always starts with a nav-like
 * section and ends with a footer. If the LLM forgot either, they are inserted.
 */
export function parsePlanResponse(response: string): string[] {
    const match = response.match(/\[[\s\S]*\]/);

    if (!match) {
        throw new Error(
            `parsePlanResponse: LLM response contains no JSON array.\n` +
            `Raw response (first 500 chars): ${response.slice(0, 500)}`,
        );
    }

    const sections: string[] = JSON.parse(match[0]);

    // Ensure first section is navigation
    const hasNav = sections.length > 0 && NAV_PATTERN.test(sections[0]);
    if (!hasNav) {
        sections.unshift('Navigation bar with logo and links');
    }

    // Ensure last section is footer
    const hasFooter = sections.length > 0 && FOOTER_PATTERN.test(sections[sections.length - 1]);
    if (!hasFooter) {
        sections.push('Footer with links and social media');
    }

    return sections;
}
