import { Block } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export function buildBlockLabel(blockId: string): string {
    return blockId.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function replaceBlockIdInHtml(html: string, blockId: string): string {
    if (/data-block-id="[^"]+"/.test(html)) {
        return html.replace(/data-block-id="[^"]+"/, `data-block-id="${blockId}"`);
    }

    if (/^<section\b/i.test(html)) {
        return html.replace(/^<section/i, `<section data-block-id="${blockId}"`);
    }

    return html;
}

function replaceOrInsertSectionAttribute(openingTag: string, attribute: string, value: string): string {
    const attributePattern = new RegExp(`\\s${attribute}="[^"]*"`, 'i');

    if (attributePattern.test(openingTag)) {
        return openingTag.replace(attributePattern, ` ${attribute}="${value}"`);
    }

    return openingTag.replace(/^<section\b/i, `<section ${attribute}="${value}"`);
}

export function setRootSectionIdentifiers(html: string, sectionId: string): string {
    if (!/^\s*<section\b/i.test(html)) {
        return html;
    }

    return html.replace(/<section\b[^>]*>/i, (openingTag) => {
        const withId = replaceOrInsertSectionAttribute(openingTag, 'id', sectionId);
        return replaceOrInsertSectionAttribute(withId, 'data-block-id', sectionId);
    });
}

function buildUniqueId(baseId: string, existingIds: string[]): string {
    const normalizedBaseId = baseId.trim() || 'section';
    let nextId = normalizedBaseId;
    let suffix = 2;

    while (existingIds.includes(nextId)) {
        nextId = `${normalizedBaseId}-${suffix}`;
        suffix += 1;
    }

    return nextId;
}

function buildUniqueBlockId(baseId: string, existingIds: string[]): string {
    const normalizedBaseId = baseId.replace(/-copy(?:-\d+)?$/, '');
    let nextId = `${normalizedBaseId}-copy`;
    let suffix = 2;

    while (existingIds.includes(nextId)) {
        nextId = `${normalizedBaseId}-copy-${suffix}`;
        suffix += 1;
    }

    return nextId;
}

export function ensureUniqueBlockIdentity(block: Block, existingIds: string[]): Block {
    const uniqueId = buildUniqueId(block.id, existingIds);
    const normalizedHtml = setRootSectionIdentifiers(block.html, uniqueId);

    if (uniqueId === block.id && normalizedHtml === block.html) {
        return block;
    }

    return {
        ...block,
        id: uniqueId,
        html: normalizedHtml,
    };
}

export function createBlock(html: string, label?: string): Block {
    const id = uuidv4().slice(0, 8);
    // Try to extract data-block-id from the HTML
    const match = html.match(/data-block-id="([^"]+)"/);
    const blockId = match ? match[1] : id;
    const blockLabel = label || buildBlockLabel(blockId);

    // Ensure the HTML has the correct data-block-id
    const finalHtml = match ? html : replaceBlockIdInHtml(html, id);

    return {
        id: match ? blockId : id,
        label: blockLabel,
        html: finalHtml,
        visible: true,
    };
}

export function extractBlockIdFromHtml(html: string): string | null {
    const match = html.match(/data-block-id="([^"]+)"/);
    return match ? match[1] : null;
}

export function duplicateExistingBlock(block: Block, existingIds: string[]): Block {
    const nextId = buildUniqueBlockId(block.id, existingIds);
    const copyNumber = existingIds.filter((id) => id === `${block.id}-copy` || id.startsWith(`${block.id}-copy-`)).length + 1;
    const nextLabel = copyNumber === 1 ? `${block.label} Copy` : `${block.label} Copy ${copyNumber}`;

    return {
        ...block,
        id: nextId,
        label: nextLabel,
        html: replaceBlockIdInHtml(block.html, nextId),
        visible: block.visible !== false,
    };
}

export function getDefaultBlocks(): Block[] {
    return [];
}
