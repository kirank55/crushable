import { Block } from '@/types';
import { v4 as uuidv4 } from 'uuid';

export function buildBlockLabel(blockId: string): string {
  return blockId
    .replace(/-/g, ' ') //replaces hyphens with spaces
    .replace(/\b\w/g, (char) => char.toUpperCase()); //capitalizes the first letter of each word
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
  if (!/^\s*<section\b/i.test(html)) return html;
  return html.replace(/<section\b[^>]*>/i, (openingTag) => {
    const withId = replaceOrInsertSectionAttribute(openingTag, 'id', sectionId);
    return replaceOrInsertSectionAttribute(withId, 'data-block-id', sectionId);
  });
}

export function createBlock(html: string, label?: string): Block {
  const id = uuidv4().slice(0, 8);
  const match = html.match(/data-block-id="([^"]+)"/);
  const blockId = match ? match[1] : id;
  const blockLabel = label || buildBlockLabel(blockId);
  const finalHtml = match ? html : replaceBlockIdInHtml(html, id);
  return {
    id: match ? blockId : id,
    label: blockLabel,
    html: finalHtml,
    visible: true,
  };
}

export function duplicateExistingBlock(block: Block, existingIds: string[]): Block {
  const normalizedBaseId = block.id.replace(/-copy(?:-\d+)?$/, '');
  let nextId = `${normalizedBaseId}-copy`;
  let suffix = 2;
  while (existingIds.includes(nextId)) {
    nextId = `${normalizedBaseId}-copy-${suffix}`;
    suffix += 1;
  }
  const copyNumber = existingIds.filter(
    (id) => id === `${block.id}-copy` || id.startsWith(`${block.id}-copy-`)
  ).length + 1;
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
