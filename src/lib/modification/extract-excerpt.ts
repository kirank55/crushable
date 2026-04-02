/**
 * Extract readable text content and headings from HTML for intent resolution.
 *
 * The previous approach (html.slice(0, 200)) sent raw HTML tags and classes
 * to the LLM, which contained almost no readable text. This module extracts
 * actual visible text and heading content, giving the intent resolver much
 * better signal for matching user requests to target sections.
 */

export interface BlockExcerpt {
    /** Visible text content of the section (plain text, up to 400 chars) */
    excerpt: string;
    /** Heading text extracted from h1-h6 elements */
    headings: string[];
}

/**
 * Extract visible text content and headings from an HTML block.
 *
 * Uses DOMParser in browser environments and falls back to regex stripping
 * in non-browser environments (SSR / Edge runtime).
 */
export function extractBlockExcerpt(html: string): BlockExcerpt {
    // Browser environment — use DOMParser for accurate extraction
    if (typeof DOMParser !== 'undefined') {
        return extractWithDOMParser(html);
    }
    // Fallback — regex-based extraction (Edge runtime, SSR)
    return extractWithRegex(html);
}

// ─── DOMParser-based extraction (browser) ────────────────────────

function extractWithDOMParser(html: string): BlockExcerpt {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract headings (h1-h6)
        const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6'))
            .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean);

        // Extract all visible text (strips HTML)
        const textContent = (doc.body.textContent || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 400);

        return { excerpt: textContent, headings };
    } catch {
        return extractWithRegex(html);
    }
}

// ─── Regex-based extraction (server / fallback) ──────────────────

function extractWithRegex(html: string): BlockExcerpt {
    // Extract headings via regex
    const headingRegex = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
    const headings: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = headingRegex.exec(html)) !== null) {
        const text = match[1]
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (text) headings.push(text);
    }

    // Strip all HTML tags to get visible text
    const textContent = html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 400);

    return { excerpt: textContent, headings };
}
