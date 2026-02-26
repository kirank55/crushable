import { Block } from '@/types';
import { logger } from '@/lib/logger';

/**
 * Parse imported HTML and extract <section data-block-id="..."> blocks.
 */
export function parseImportedHtml(html: string): Block[] {
    logger.action('parseImportedHtml', { htmlLength: html.length });

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const sections = doc.querySelectorAll('section[data-block-id]');

    const blocks: Block[] = [];

    sections.forEach((section) => {
        const blockId = section.getAttribute('data-block-id') || '';
        const label = blockId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

        blocks.push({
            id: blockId,
            label,
            html: section.outerHTML,
        });
    });

    logger.action('parseImportedHtml result', { blocksFound: blocks.length });
    return blocks;
}

/**
 * Read a file and return its text content.
 */
export function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}
