import { Block } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export function createBlock(html: string, label?: string): Block {
    const id = uuidv4().slice(0, 8);
    // Try to extract data-block-id from the HTML
    const match = html.match(/data-block-id="([^"]+)"/);
    const blockId = match ? match[1] : id;
    const blockLabel = label || blockId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    // Ensure the HTML has the correct data-block-id
    let finalHtml = html;
    if (!match) {
        finalHtml = html.replace(/^<section/, `<section data-block-id="${id}"`);
    }

    return {
        id: match ? blockId : id,
        label: blockLabel,
        html: finalHtml,
    };
}

export function extractBlockIdFromHtml(html: string): string | null {
    const match = html.match(/data-block-id="([^"]+)"/);
    return match ? match[1] : null;
}

export function getDefaultBlocks(): Block[] {
    return [];
}
