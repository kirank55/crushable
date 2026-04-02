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

function getOwnText(element: Element): string {
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent || '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function setOwnText(element: Element, value: string): boolean {
  const textNodes = Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
  if (textNodes.length > 0) {
    textNodes[0].textContent = value;
    for (let index = 1; index < textNodes.length; index++) {
      textNodes[index].textContent = '';
    }
    return true;
  }

  const textChild = Array.from(element.children).find((child) => {
    const ownText = getOwnText(child);
    return ownText.length > 0 && ownText.length <= 40;
  });

  if (textChild) {
    return setOwnText(textChild, value);
  }

  return false;
}

function findBrandCandidate(root: ParentNode, selectors: string[]): Element | null {
  for (const selector of selectors) {
    const elements = Array.from(root.querySelectorAll(selector));
    const match = elements.find((element) => {
      const text = getOwnText(element) || element.textContent?.replace(/\s+/g, ' ').trim() || '';
      return text.length > 0 && text.length <= 40;
    });

    if (match) return match;
  }

  return null;
}

export function enforceSectionBrandName(html: string, brandName?: string): string {
  const trimmedBrandName = brandName?.trim() || '';
  if (!trimmedBrandName || typeof DOMParser === 'undefined') return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const section = doc.body.querySelector('section');
  if (!section) return html;

  const navRoot = section.querySelector('nav, header');
  const footerRoot = section.querySelector('footer');
  let changed = false;

  if (navRoot) {
    const navBrand = findBrandCandidate(navRoot, [
      '[class*="brand"]',
      '[class*="logo"]',
      'a[href="#hero"]',
      'a[href="#home"]',
      'a[href="#"]',
      'a',
    ]);

    if (navBrand) {
      changed = setOwnText(navBrand, trimmedBrandName) || changed;
      const image = navBrand.querySelector('img');
      if (image) {
        image.setAttribute('alt', `${trimmedBrandName} logo`);
        changed = true;
      }
    }
  }

  if (footerRoot) {
    const footerBrand = findBrandCandidate(footerRoot, [
      '[class*="brand"]',
      '[class*="logo"]',
      'a',
      'h1',
      'h2',
      'h3',
      'strong',
      'span',
      'p',
      'div',
    ]);

    if (footerBrand) {
      changed = setOwnText(footerBrand, trimmedBrandName) || changed;
      const image = footerBrand.querySelector('img');
      if (image) {
        image.setAttribute('alt', `${trimmedBrandName} logo`);
        changed = true;
      }
    }
  }

  return changed ? section.outerHTML : html;
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
