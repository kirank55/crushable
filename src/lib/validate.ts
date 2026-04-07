import { setRootSectionIdentifiers } from '@/lib/blocks';
import { Block, ValidationIssue } from '@/types';

// ─── Detection helpers ──────────────────────────────────────────

function hasExplicitBackground(section: Element): boolean {
  const className = section.getAttribute('class') || '';
  const style = section.getAttribute('style') || '';
  return /(^|\s)bg-[^\s]+/.test(className) || /background(?:-color|-image)?\s*:/.test(style);
}

function isMissingImageSource(src: string | null): boolean {
  if (!src) return true;
  const normalized = src.trim().toLowerCase();
  if (!normalized) return true;
  return /placeholder|example\.com|via\.placeholder|dummyimage|your-image|image-url/.test(normalized);
}

function isInvalidImageSource(src: string | null): boolean {
  if (!src) return true;
  const normalized = src.trim();
  if (!normalized) return true;
  if (/^(data:|blob:|https?:\/\/|\/|\.\/|\.\.\/)/i.test(normalized)) {
    if (/^https?:\/\//i.test(normalized)) {
      try {
        const parsed = new URL(normalized);
        return !parsed.hostname;
      } catch {
        return true;
      }
    }
    return false;
  }
  return true;
}

// Detect images with very low opacity class applied (opacity-0 to opacity-40)
function hasLowOpacity(element: Element): boolean {
  const className = element.getAttribute('class') || '';
  const style = element.getAttribute('style') || '';
  // Tailwind opacity utilities: opacity-0 through opacity-40
  const lowOpacityClass = /\bopacity-([0-9]|[1-3][0-9]|40)\b/.test(className);
  const lowOpacityStyle = (() => {
    const match = style.match(/opacity\s*:\s*([\d.]+)/);
    if (!match) return false;
    return parseFloat(match[1]) < 0.4;
  })();
  return lowOpacityClass || lowOpacityStyle;
}

function hasTextContent(element: Element): boolean {
  return (element.textContent || '').replace(/\s+/g, ' ').trim().length > 0;
}

function isVisuallyHiddenText(element: Element): boolean {
  if (!hasTextContent(element)) return false;
  const className = element.getAttribute('class') || '';
  const style = element.getAttribute('style') || '';
  const id = element.getAttribute('id') || '';
  const hasGradientClip = /bg-clip-text/.test(className);
  const transparentWithoutClip = /\btext-transparent\b/.test(className) && !hasGradientClip;
  // Skip responsive toggle patterns (e.g. "hidden md:flex") and mobile menu containers
  const isResponsiveToggle = /(?<![:\w])hidden(?![:\w])/.test(className)
    && /\b(sm|md|lg|xl|2xl):(flex|block|grid|inline|table|inline-flex|inline-block)\b/.test(className);
  const isMobileMenu = /mobile.?menu/i.test(id);
  const hiddenClass = !isResponsiveToggle && !isMobileMenu && /\b(?:hidden|invisible)\b/.test(className);
  const lowOpacityClass = /\bopacity-([0-9]|[1-3][0-9]|40)\b/.test(className);
  const hiddenStyle = /display\s*:\s*none|visibility\s*:\s*hidden/i.test(style);
  const lowOpacityStyle = (() => {
    const match = style.match(/opacity\s*:\s*([\d.]+)/i);
    if (!match) return false;
    return parseFloat(match[1]) < 0.4;
  })();
  return transparentWithoutClip || hiddenClass || lowOpacityClass || hiddenStyle || lowOpacityStyle;
}

/** Light Tailwind shades that should NOT be treated as "dark / colored". */
const LIGHT_SHADE_PATTERN = 'white|gray-(?:50|1(?:00)?|2(?:00)?|3(?:00)?)|slate-(?:50|1(?:00)?|2(?:00)?|3(?:00)?)|zinc-(?:50|1(?:00)?|2(?:00)?|3(?:00)?)|neutral-(?:50|1(?:00)?|2(?:00)?|3(?:00)?)|stone-(?:50|1(?:00)?|2(?:00)?|3(?:00)?)';

// Check if a section has a strongly-colored background (not white/light gray/transparent)
function hasDarkOrColoredBackground(section: Element): boolean {
  const className = section.getAttribute('class') || '';
  const style = section.getAttribute('style') || '';
  // Detects Tailwind bg-{color}-{shade} where shade >= 400, gradients, and inline bg with non-white colors
  const bgRe = new RegExp(`\\bbg-(?!${LIGHT_SHADE_PATTERN}|transparent|black\\/0)[a-z]`);
  const fromRe = new RegExp(`from-(?!${LIGHT_SHADE_PATTERN})`);
  const toRe = new RegExp(`to-(?!${LIGHT_SHADE_PATTERN})`);
  return bgRe.test(className)
    || fromRe.test(className)
    || toRe.test(className)
    || /background(?:-color)?\s*:\s*(?!white|#fff|rgba\(255,255,255)/i.test(style);
}

// Find dark text classes inside an element — only problematic on colored backgrounds
function findDarkTextElements(section: Element): Element[] {
  const darkTextPattern = /\btext-(?:gray|slate|zinc|neutral|stone)-(?:[6-9][0-9][0-9]|[6-9]00)\b|\btext-black\b/;
  return Array.from(section.querySelectorAll('[class]')).filter((el) => {
    const cls = el.getAttribute('class') || '';
    return hasTextContent(el) && darkTextPattern.test(cls);
  });
}

function hasLightBackground(section: Element): boolean {
  const className = section.getAttribute('class') || '';
  const style = section.getAttribute('style') || '';
  const lightBg = /\bbg-(white|gray-(?:50|100|200|300)|slate-(?:50|100|200|300)|zinc-(?:50|100|200|300)|neutral-(?:50|100|200|300)|stone-(?:50|100|200|300))\b/;
  const lightFrom = /\bfrom-(white|gray-(?:50|100|200|300)|slate-(?:50|100|200|300)|blue-(?:50|100))\b/;
  const lightTo = /\bto-(white|gray-(?:50|100|200|300)|slate-(?:50|100|200|300)|blue-(?:50|100))\b/;
  return lightBg.test(className)
    || lightFrom.test(className)
    || lightTo.test(className)
    || /background(?:-color)?\s*:\s*(white|#fff|#ffffff|rgb\(255,\s*255,\s*255\)|rgba\(255,\s*255,\s*255)/i.test(style);
}

function findLightTextElements(section: Element): Element[] {
  const lightTextPattern = /\btext-(?:white|gray-(?:50|100|200|300)|slate-(?:50|100|200|300)|zinc-(?:50|100|200|300)|neutral-(?:50|100|200|300)|stone-(?:50|100|200|300))\b/;
  return Array.from(section.querySelectorAll('[class]')).filter((el) => {
    const cls = el.getAttribute('class') || '';
    return hasTextContent(el) && lightTextPattern.test(cls);
  });
}

/** Tailwind color names (excluding gray-scale which is handled separately). */
const COLORED_BG_PATTERN = /\b(?:bg-(?:blue|indigo|purple|violet|fuchsia|pink|rose|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky)-(?:[4-9]00)\b|from-(?:blue|indigo|purple|violet|fuchsia|pink|rose|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky)-(?:[4-9]00)\b)/;

/**
 * Find elements that have a colored background (buttons, badges, etc.) with dark text.
 * This catches e.g. bg-blue-600 text-gray-900 or bg-gradient from-indigo-600 text-gray-900.
 */
function findColoredBgWithDarkText(section: Element): Element[] {
  const darkTextPattern = /\btext-(?:gray|slate|zinc|neutral|stone)-(?:[6-9]00)\b|\btext-black\b/;
  return Array.from(section.querySelectorAll('[class]')).filter((el) => {
    const cls = el.getAttribute('class') || '';
    return COLORED_BG_PATTERN.test(cls) && darkTextPattern.test(cls);
  });
}

/**
 * Find inner elements that have their own light background with light text children.
 * This catches cases like cards with bg-white inside a dark-background section.
 */
function findInnerLightBgWithLightText(section: Element): Element[] {
  const lightBgPattern = /\bbg-(white|gray-(?:50|100|200|300)|slate-(?:50|100|200|300)|zinc-(?:50|100|200|300))\b/;
  const lightTextPattern = /\btext-(?:white|gray-(?:50|100|200|300)|slate-(?:50|100|200|300)|zinc-(?:50|100|200|300))\b/;
  const results: Element[] = [];

  // Find inner containers (not the section itself) that have light backgrounds
  Array.from(section.querySelectorAll('[class]')).forEach((el) => {
    if (el === section) return;
    const cls = el.getAttribute('class') || '';
    if (!lightBgPattern.test(cls)) return;

    // Check if this element or its children have light text
    const hasOwnLightText = lightTextPattern.test(cls) && hasTextContent(el);
    const childLightText = Array.from(el.querySelectorAll('[class]')).some((child) => {
      const childCls = child.getAttribute('class') || '';
      return hasTextContent(child) && lightTextPattern.test(childCls);
    });

    if (hasOwnLightText || childLightText) {
      results.push(el);
    }
  });

  return results;
}

// Detect heading/subtext alignment mismatch: e.g. h2 text-left but sibling p text-center
function hasAlignmentMismatch(section: Element): boolean {
  const wrapper = Array.from(section.querySelectorAll('div')).find((div) => {
    const cls = div.getAttribute('class') || '';
    return /\btext-(?:center|left|right)\b/.test(cls) && div.querySelector('h2,h3');
  });
  if (wrapper) {
    const wrapperAlign = (wrapper.getAttribute('class') || '').match(/\btext-(center|left|right)\b/)?.[1];
    const headings = Array.from(wrapper.querySelectorAll('h2,h3'));
    const paras = Array.from(wrapper.querySelectorAll('p'));
    for (const h of headings) {
      const hAlign = (h.getAttribute('class') || '').match(/\btext-(center|left|right)\b/)?.[1];
      for (const p of paras) {
        const pAlign = (p.getAttribute('class') || '').match(/\btext-(center|left|right)\b/)?.[1];
        if (hAlign && pAlign && hAlign !== pAlign) return true;
        if (wrapperAlign && hAlign && wrapperAlign !== hAlign) return true;
        if (wrapperAlign && pAlign && wrapperAlign !== pAlign) return true;
      }
    }
  }
  // Also check md:text-left overriding base text-center
  const headerDiv = section.querySelector('div[class*="md:text-left"]');
  if (headerDiv) {
    const cls = headerDiv.getAttribute('class') || '';
    if (/\btext-center\b/.test(cls) && /\bmd:text-left\b/.test(cls)) return true;
  }
  return false;
}

function isHeroSection(section: Element): boolean {
  const sectionId = (section.getAttribute('id') || '').toLowerCase();
  const blockId = (section.getAttribute('data-block-id') || '').toLowerCase();
  const className = (section.getAttribute('class') || '').toLowerCase();
  return sectionId.includes('hero') || blockId.includes('hero') || /\bhero\b/.test(className);
}

function isSocialProofSection(section: Element): boolean {
  const sectionId = (section.getAttribute('id') || '').toLowerCase();
  const blockId = (section.getAttribute('data-block-id') || '').toLowerCase();
  const className = (section.getAttribute('class') || '').toLowerCase();
  return sectionId.includes('social-proof')
    || sectionId.includes('testimonials')
    || blockId.includes('social-proof')
    || blockId.includes('testimonials')
    || /\btestimonial|metrics|trust|proof\b/.test(className);
}

function usesViewportHeight(section: Element): boolean {
  const className = section.getAttribute('class') || '';
  const style = section.getAttribute('style') || '';
  return /min-h-screen|min-h-\[100vh\]|h-screen|h-\[100vh\]/.test(className) || /(min-height|height)\s*:\s*100vh/i.test(style);
}

function hasIntentionalVerticalBalancing(section: Element): boolean {
  const className = section.getAttribute('class') || '';
  const style = section.getAttribute('style') || '';
  return /(items-center|justify-center|justify-between|content-center|place-items-center|place-content-center|self-center|min-h-screen)/.test(className)
    || /(align-items|justify-content|place-items|place-content)\s*:\s*center/i.test(style)
    || /(justify-content)\s*:\s*space-between/i.test(style);
}

function hasCrowdedSocialProofLayout(section: Element): boolean {
  return Array.from(section.querySelectorAll('div[class]')).some((element) => {
    const className = (element.getAttribute('class') || '').toLowerCase();
    if (!/\bgrid\b/.test(className)) return false;
    const usesThreeColumns = /sm:grid-cols-3|md:grid-cols-3|lg:grid-cols-3|xl:grid-cols-3/.test(className);
    const hasDesktopSizing = /lg:max-w-|lg:w-|lg:flex-1|lg:grid-cols-2|xl:grid-cols-2/.test(className);
    return usesThreeColumns && !hasDesktopSizing;
  });
}

// ─── Anchor resolution ──────────────────────────────────────────

function extractRootId(html: string): string | null {
  const match = html.match(/<section\b[^>]*\bid="([^"]+)"/i);
  return match ? match[1] : null;
}

function normalizeAnchorToken(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function singularizeToken(value: string): string {
  if (value.endsWith('ies')) return `${value.slice(0, -3)}y`;
  if (value.endsWith('s') && !value.endsWith('ss')) return value.slice(0, -1);
  return value;
}

function buildAnchorVariants(value: string): string[] {
  const normalized = normalizeAnchorToken(value);
  if (!normalized) return [];
  const variants = new Set<string>([normalized, singularizeToken(normalized)]);
  if (!normalized.endsWith('s')) variants.add(`${normalized}s`);
  return Array.from(variants).filter(Boolean);
}

function getAnchorCandidateMetadata(blocks: Block[]): Array<{ id: string; label: string; normalizedId: string; normalizedLabel: string }> {
  return blocks.map((block) => {
    const id = extractRootId(block.html) || block.id;
    return {
      id,
      label: block.label || '',
      normalizedId: normalizeAnchorToken(id),
      normalizedLabel: normalizeAnchorToken(block.label || ''),
    };
  });
}

function resolveAnchorTarget(targetId: string | undefined, blocks: Block[]): string | null {
  const normalizedTarget = normalizeAnchorToken(targetId || '');
  const targetVariants = buildAnchorVariants(normalizedTarget);
  const candidates = getAnchorCandidateMetadata(blocks);
  if (!normalizedTarget) return null;

  const exact = candidates.find((c) => c.normalizedId === normalizedTarget);
  if (exact) return exact.id;

  for (const variant of targetVariants) {
    const prefixed = candidates.find((c) => c.normalizedId === variant || c.normalizedId.startsWith(`${variant}-`));
    if (prefixed) return prefixed.id;
  }

  for (const variant of targetVariants) {
    const labelMatch = candidates.find((c) => c.normalizedLabel === variant || c.normalizedLabel.includes(variant));
    if (labelMatch) return labelMatch.id;
  }

  return null;
}

// ─── Navigation chrome helpers ──────────────────────────────────

function parseSection(html: string): Element | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc.body.querySelector('section');
}

function blockContainsNavigationChrome(block: Block): boolean {
  const section = parseSection(block.html);
  if (!section) return false;

  const rootId = (section.getAttribute('id') || block.id || '').toLowerCase();
  const label = (block.label || '').toLowerCase();

  return Boolean(
    section.querySelector('nav')
    || Array.from(section.querySelectorAll('header')).some((header) => {
      const className = header.getAttribute('class') || '';
      const style = header.getAttribute('style') || '';
      return /(sticky|fixed)/.test(className) || /position\s*:\s*(sticky|fixed)/i.test(style);
    })
    || /\b(nav|navigation|header)\b/.test(rootId)
    || /\b(nav|navigation|header)\b/.test(label),
  );
}

function stripStickyTokens(className: string): string {
  return className
    .split(/\s+/)
    .filter((token) => token && !/^(sticky|fixed|top-\S+|bottom-\S+|left-\S+|right-\S+|inset-\S+|z-\S+)$/.test(token))
    .join(' ')
    .trim();
}

function stripStickyStyles(styleValue: string): string {
  return styleValue
    .replace(/position\s*:\s*(?:sticky|fixed)\s*;?/gi, '')
    .replace(/\b(?:top|right|bottom|left)\s*:\s*[^;"]+;?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/^;|;$/g, '');
}

function demoteDuplicateNavigation(html: string): string {
  let nextHtml = html
    .replace(/<nav\b/gi, '<div data-demoted-nav="true"')
    .replace(/<\/nav>/gi, '</div>');

  nextHtml = nextHtml.replace(/<header\b[^>]*>/gi, (openingTag) => {
    let nextTag = openingTag;
    nextTag = nextTag.replace(/\sclass="([^"]*)"/i, (_, className: string) => {
      const cleaned = stripStickyTokens(className);
      return cleaned ? ` class="${cleaned}"` : '';
    });
    nextTag = nextTag.replace(/\sstyle="([^"]*)"/i, (_, styleValue: string) => {
      const cleaned = stripStickyStyles(styleValue);
      return cleaned ? ` style="${cleaned}"` : '';
    });
    return nextTag;
  });

  return nextHtml;
}

// ─── Social proof layout fix ────────────────────────────────────

function improveSocialProofLayout(html: string): string {
  let nextHtml = html.replace(
    /class="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between"/i,
    'class="grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start"',
  );
  nextHtml = nextHtml.replace(
    /class="grid grid-cols-2 gap-4 sm:grid-cols-3"/i,
    'class="grid gap-4 sm:grid-cols-2 lg:max-w-xl"',
  );
  return nextHtml;
}

// ─── Low-contrast text fix ──────────────────────────────────────

function fixLowContrastText(html: string): string {
  // Replace dark text utilities with white equivalents when on colored backgrounds.
  // Use negative lookbehind to skip responsive-prefixed variants (hover:text-gray-900 etc.)
  return html
    .replace(/(?<![:\w])text-gray-900\b/g, 'text-white')
    .replace(/(?<![:\w])text-gray-800\b/g, 'text-white')
    .replace(/(?<![:\w])text-gray-700\b/g, 'text-white')
    .replace(/(?<![:\w])text-gray-600\b/g, 'text-white\/80')
    .replace(/(?<![:\w])text-slate-900\b/g, 'text-white')
    .replace(/(?<![:\w])text-slate-800\b/g, 'text-white')
    .replace(/(?<![:\w])text-slate-700\b/g, 'text-white')
    .replace(/(?<![:\w])text-slate-600\b/g, 'text-white\/80');
}

function fixLightTextOnLightBg(html: string): string {
  // Replace light text utilities with dark equivalents when on light backgrounds
  return html
    .replace(/\btext-white\b/g, 'text-gray-900')
    .replace(/\btext-white\/80\b/g, 'text-gray-600')
    .replace(/\btext-white\/60\b/g, 'text-gray-500')
    .replace(/\btext-gray-50\b/g, 'text-gray-900')
    .replace(/\btext-gray-100\b/g, 'text-gray-800')
    .replace(/\btext-gray-200\b/g, 'text-gray-700')
    .replace(/\btext-gray-300\b/g, 'text-gray-600')
    .replace(/\btext-slate-50\b/g, 'text-slate-900')
    .replace(/\btext-slate-100\b/g, 'text-slate-800')
    .replace(/\btext-slate-200\b/g, 'text-slate-700')
    .replace(/\btext-slate-300\b/g, 'text-slate-600');
}

// ─── Low-opacity image fix ──────────────────────────────────────

function fixLowOpacityImages(html: string): string {
  // Remove Tailwind low-opacity classes from img tags (opacity-0 through opacity-40)
  return html.replace(
    /(<img\b[^>]*)\s+opacity-([0-9]|[1-3][0-9]|40)\b([^>]*>)/g,
    '$1$3',
  ).replace(
    /(<img\b[^>]*style="[^"]*?)opacity\s*:\s*0\.[0-3][^;"]*;?([^"]*")/g,
    '$1$2',
  );
}

// ─── Alignment mismatch fix ──────────────────────────────────────

function fixColoredBgDarkText(html: string): string {
  // Per-element fix: for elements with colored backgrounds, swap dark text to white
  return html.replace(
    /class="([^"]*)"/g,
    (match, classValue: string) => {
      if (!COLORED_BG_PATTERN.test(classValue)) return match;
      let fixed = classValue
        .replace(/(?<![:\w])text-gray-900\b/g, 'text-white')
        .replace(/(?<![:\w])text-gray-800\b/g, 'text-white')
        .replace(/(?<![:\w])text-gray-700\b/g, 'text-white')
        .replace(/(?<![:\w])text-gray-600\b/g, 'text-white\/80')
        .replace(/(?<![:\w])text-slate-900\b/g, 'text-white')
        .replace(/(?<![:\w])text-slate-800\b/g, 'text-white')
        .replace(/(?<![:\w])text-slate-700\b/g, 'text-white')
        .replace(/(?<![:\w])text-slate-600\b/g, 'text-white\/80');
      return fixed !== classValue ? `class="${fixed}"` : match;
    },
  );
}

function fixAlignmentMismatch(html: string): string {
  // Remove md:text-left from wrappers that also have text-center â€” enforce consistent centering
  return html.replace(
    /class="([^"]*\btext-center\b[^"]*?)\s*md:text-left\b([^"]*)"/g,
    'class="$1$2"',
  );
}

function getNavigationTargets(blocks: Block[]): Array<{ id: string; label: string }> {
  return blocks
    .map((block) => ({
      id: extractRootId(block.html) || block.id,
      label: block.label || '',
    }))
    .filter((target) => target.id !== 'home' && target.id !== 'nav' && target.id !== 'navbar' && target.id !== 'footer' && target.id !== 'hero');
}

function normalizeNavbarAnchors(html: string, blocks: Block[]): { html: string; changed: boolean } {
  const section = parseSection(html);
  if (!section) return { html, changed: false };

  const navRoot = section.querySelector('nav, header');
  if (!navRoot) return { html, changed: false };

  const targets = getNavigationTargets(blocks);
  if (targets.length === 0) return { html, changed: false };

  const targetIds = new Set(targets.map((target) => target.id));
  const anchors = Array.from(navRoot.querySelectorAll('a[href^="#"]'));

  // Detect the logo/brand anchor — may be icon-based, class-based, or the
  // first bold, large-text anchor whose text does NOT match any navigation
  // target (it's the site name, not a section link).
  const logoAnchor = anchors.find((anchor) => {
    const cls = anchor.getAttribute('class') || '';
    // Icon / image logos
    if (anchor.querySelector('img,svg,i[data-lucide]')) return true;
    // Explicit class hints
    if (/flex-shrink-0|logo|brand/.test(cls)) return true;
    // Text-only brand link: bold + large text, and its text doesn't resolve to
    // any known section ID (e.g. "Apex" vs "Features").
    if (/\bfont-bold\b/.test(cls) && /\btext-(xl|2xl|3xl|4xl)\b/.test(cls)) {
      const text = anchor.textContent?.replace(/\s+/g, ' ').trim() || '';
      const resolved = resolveAnchorTarget(text, blocks);
      // If the bold text doesn't match any content section, it's the brand name
      if (!resolved || !targetIds.has(resolved)) return true;
    }
    return false;
  });

  const contentAnchors = anchors.filter((anchor) => anchor !== logoAnchor);
  let changed = false;

  // Phase 0: Remove anchors that point to the footer section — footer links
  // in the navbar are redundant since footers are always at the bottom.
  const FOOTER_TOKENS = /\b(footer|foot)\b/i;
  contentAnchors.slice().forEach((anchor) => {
    const href = (anchor.getAttribute('href') || '').slice(1).toLowerCase();
    const text = (anchor.textContent || '').trim().toLowerCase();
    if (FOOTER_TOKENS.test(href) || FOOTER_TOKENS.test(text)) {
      anchor.remove();
      contentAnchors.splice(contentAnchors.indexOf(anchor), 1);
      changed = true;
    }
  });

  // Phase 1: Build an ideal mapping from anchor text → section ID using direct
  // text matching. This gives us high-confidence assignments first.
  const textMatchMap = new Map<Element, string>();
  const textClaimedIds = new Set<string>();

  contentAnchors.forEach((anchor) => {
    const anchorText = anchor.textContent?.replace(/\s+/g, ' ').trim() || '';
    const resolved = resolveAnchorTarget(anchorText, blocks);
    if (resolved && targetIds.has(resolved) && !textClaimedIds.has(resolved)) {
      textMatchMap.set(anchor, resolved);
      textClaimedIds.add(resolved);
    }
  });

  // Phase 2: For anchors without a text match, fall back to their current href
  // target or assign the next available section in order.
  let fallbackIndex = 0;
  const getNextFallback = (): string | null => {
    while (fallbackIndex < targets.length) {
      const candidate = targets[fallbackIndex++];
      if (!textClaimedIds.has(candidate.id)) {
        return candidate.id;
      }
    }
    return null;
  };

  contentAnchors.forEach((anchor) => {
    const href = anchor.getAttribute('href') || '';

    // Use the text-matched target if available
    let resolvedTarget = textMatchMap.get(anchor) || null;

    if (!resolvedTarget) {
      // Try keeping the current href if it points to a valid, unclaimed section
      const currentTarget = href.slice(1).trim();
      if (currentTarget && targetIds.has(currentTarget) && !textClaimedIds.has(currentTarget)) {
        resolvedTarget = currentTarget;
        textClaimedIds.add(resolvedTarget);
      }
    }

    if (!resolvedTarget) {
      resolvedTarget = getNextFallback();
      if (resolvedTarget) textClaimedIds.add(resolvedTarget);
    }

    if (!resolvedTarget) return;

    const desiredHref = `#${resolvedTarget}`;
    if (href !== desiredHref) {
      anchor.setAttribute('href', desiredHref);
      changed = true;
    }
  });

  // Phase 3: Sync mobile menu anchors to match corrected desktop nav anchors.
  // The mobile menu (#mobile-menu) is typically a sibling of <nav>, so its
  // anchors wouldn't have been processed above.
  const mobileMenu = section.querySelector('#mobile-menu');
  if (mobileMenu) {
    // Build a map from anchor text → corrected href from the desktop nav
    const textToHref = new Map<string, string>();
    contentAnchors.forEach((anchor) => {
      const text = normalizeAnchorToken(anchor.textContent?.replace(/\s+/g, ' ').trim() || '');
      const href = anchor.getAttribute('href') || '';
      if (text && href) textToHref.set(text, href);
    });

    Array.from(mobileMenu.querySelectorAll('a[href^="#"]')).forEach((mobileAnchor) => {
      const rawText = (mobileAnchor.textContent || '').trim();
      const href = (mobileAnchor.getAttribute('href') || '').slice(1);
      // Remove footer links from mobile menu too
      if (FOOTER_TOKENS.test(href) || FOOTER_TOKENS.test(rawText)) {
        mobileAnchor.remove();
        changed = true;
        return;
      }
      const text = normalizeAnchorToken(rawText);
      const correctHref = textToHref.get(text);
      if (correctHref && mobileAnchor.getAttribute('href') !== correctHref) {
        mobileAnchor.setAttribute('href', correctHref);
        changed = true;
      }
    });
  }

  return { html: changed ? section.outerHTML : html, changed };
}

// ─── Navbar responsive fix ──────────────────────────────────────

function fixNavbarResponsive(html: string): { html: string; changed: boolean } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const section = doc.body.querySelector('section');
  if (!section) return { html, changed: false };

  const nav = section.querySelector('nav');
  if (!nav) return { html, changed: false };

  let changed = false;

  // 1. Fix desktop links container: should be "hidden md:flex"
  //    Look for a direct child div of nav that contains anchor links (not the mobile menu)
  //    Skip wrapper divs that also contain the hamburger button (they wrap everything).
  const desktopLinksDiv = Array.from(nav.querySelectorAll(':scope > div')).find((div) => {
    const id = div.getAttribute('id') || '';
    if (id === 'mobile-menu') return false;
    // Skip wrapper divs that contain buttons (hamburger) — they wrap the entire nav
    if (div.querySelector('button')) return false;
    const anchors = div.querySelectorAll('a[href^="#"]');
    return anchors.length >= 2;
  })
  // Fallback: look for nested divs with md:flex that contain links (common LLM pattern)
  || nav.querySelector(':scope > div > div[class*="md:flex"]:not(#mobile-menu)')
  || (() => {
    // Last resort: find the innermost div that directly contains 2+ anchor links
    // but does NOT contain the hamburger button
    const candidates = Array.from(nav.querySelectorAll('div:not(#mobile-menu)'));
    return candidates.find((div) => {
      if (div.querySelector('button')) return false;
      const directAnchors = Array.from(div.children).filter(
        (ch) => ch.tagName === 'A' && ch.getAttribute('href')?.startsWith('#'),
      );
      return directAnchors.length >= 2;
    }) || null;
  })();

  if (desktopLinksDiv) {
    const cls = desktopLinksDiv.getAttribute('class') || '';
    // Check if it's missing "hidden" before md:flex
    const hasMdFlex = /\bmd:flex\b/.test(cls);
    const hasHidden = /\bhidden\b/.test(cls);
    if (hasMdFlex && !hasHidden) {
      desktopLinksDiv.setAttribute('class', `hidden ${cls}`.trim());
      changed = true;
    } else if (!hasMdFlex && !hasHidden) {
      // No responsive classes at all — add them
      const cleaned = cleanBrokenResponsiveTokens(cls);
      desktopLinksDiv.setAttribute('class', `hidden md:flex ${cleaned}`.trim());
      changed = true;
    } else if (!hasMdFlex && hasHidden) {
      // Has hidden but no md:flex — links would never show
      const cleaned = cleanBrokenResponsiveTokens(cls);
      desktopLinksDiv.setAttribute('class', `hidden md:flex ${cleaned.replace(/\bhidden\b/, '').trim()}`.trim());
      changed = true;
    }
  }

  // 2. Fix hamburger button: should have "md:hidden"
  const hamburgerBtn = nav.querySelector('button[onclick*="mobile-menu"], button[aria-label*="menu" i], button[aria-label*="Menu" i]')
    || Array.from(nav.querySelectorAll('button')).find((btn) => {
      return btn.querySelector('i[data-lucide="menu"]') || btn.querySelector('.icon-menu');
    });

  if (hamburgerBtn) {
    const cls = hamburgerBtn.getAttribute('class') || '';
    if (!/\bmd:hidden\b/.test(cls)) {
      const cleaned = cleanBrokenResponsiveTokens(cls);
      hamburgerBtn.setAttribute('class', `md:hidden ${cleaned}`.trim());
      changed = true;
    }
  }

  // 3. Fix mobile menu container: should start hidden, and be hidden on md+
  const mobileMenu = section.querySelector('#mobile-menu');
  if (mobileMenu) {
    const cls = mobileMenu.getAttribute('class') || '';
    const hasHidden = /\bhidden\b/.test(cls);
    if (!hasHidden) {
      const cleaned = cleanBrokenResponsiveTokens(cls);
      mobileMenu.setAttribute('class', `hidden ${cleaned}`.trim());
      changed = true;
    }
  }

  // 4. Fix toggle script: ensure it toggles 'hidden', not empty string
  let resultHtml = changed ? section.outerHTML : html;
  // Replace classList.toggle('') or classList.toggle("") with classList.toggle('hidden')
  resultHtml = resultHtml.replace(
    /classList\.toggle\(\s*['"]['"]\s*\)/g,
    "classList.toggle('hidden')",
  );
  if (resultHtml !== (changed ? section.outerHTML : html)) {
    changed = true;
  }

  // 5. Replace incomplete standalone "md:" or "hidden:" tokens in class attributes within nav
  const beforeClean = resultHtml;
  resultHtml = resultHtml.replace(
    /class="([^"]*)"/g,
    (match, classValue: string) => {
      const cleaned = cleanBrokenResponsiveTokens(classValue);
      return cleaned !== classValue ? `class="${cleaned}"` : match;
    },
  );
  if (resultHtml !== beforeClean) changed = true;

  // 6. Ensure hamburger onclick actually toggles hidden on mobile-menu
  if (hamburgerBtn && mobileMenu) {
    const onclick = hamburgerBtn.getAttribute('onclick') || '';
    if (!onclick.includes('mobile-menu') || onclick.includes("toggle('')") || onclick.includes('toggle("")')) {
      resultHtml = resultHtml.replace(
        /onclick="[^"]*"/,
        `onclick="document.getElementById('mobile-menu').classList.toggle('hidden')"`,
      );
      changed = true;
    }
  }

  return { html: resultHtml, changed };
}

function cleanBrokenResponsiveTokens(classValue: string): string {
  // Remove standalone "md:" "lg:" "sm:" "hidden:" tokens that have no property after the colon
  return classValue
    .split(/\s+/)
    .filter((token) => !/^(sm|md|lg|xl|2xl|hidden):$/.test(token) && token !== '')
    .join(' ')
    .trim();
}

// ─── Public API ─────────────────────────────────────────────────

export function validateGeneratedHtml(fullHtml: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(fullHtml, 'text/html');

  // Duplicate navigation
  const navElements = Array.from(doc.querySelectorAll('nav'));
  const stickyHeaders = Array.from(doc.querySelectorAll('header')).filter((header) => {
    const className = header.getAttribute('class') || '';
    const style = header.getAttribute('style') || '';
    return /(sticky|fixed)/.test(className) || /position\s*:\s*(sticky|fixed)/.test(style);
  });

  if (navElements.length + stickyHeaders.length > 1) {
    issues.push({
      type: 'warning',
      code: 'duplicate-navigation',
      message: 'Duplicate navigation detected. Multiple nav or sticky header elements were found.',
    });
  }

  // Duplicate IDs
  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();
  Array.from(doc.querySelectorAll('[id]')).forEach((element) => {
    const value = element.getAttribute('id')?.trim();
    if (!value) return;
    if (seenIds.has(value)) { duplicateIds.add(value); return; }
    seenIds.add(value);
  });

  duplicateIds.forEach((targetId) => {
    issues.push({
      type: 'error',
      code: 'duplicate-id',
      message: `Duplicate section id detected: "${targetId}" appears more than once, which can break anchor navigation.`,
      targetId,
    });
  });

  // Duplicate block IDs
  const seenBlockIds = new Set<string>();
  const duplicateBlockIds = new Set<string>();
  Array.from(doc.querySelectorAll('section[data-block-id]')).forEach((section) => {
    const value = section.getAttribute('data-block-id')?.trim();
    if (!value) return;
    if (seenBlockIds.has(value)) { duplicateBlockIds.add(value); return; }
    seenBlockIds.add(value);
  });

  duplicateBlockIds.forEach((blockId) => {
    issues.push({
      type: 'error',
      code: 'duplicate-block-id',
      message: `Duplicate data-block-id detected: "${blockId}" appears more than once, which can destabilize section updates.`,
      blockId,
    });
  });

  // Broken anchors
  const ids = new Set(
    Array.from(doc.querySelectorAll('[id]'))
      .map((el) => el.getAttribute('id')?.trim())
      .filter((v): v is string => Boolean(v)),
  );

  Array.from(doc.querySelectorAll('a[href^="#"]')).forEach((anchor) => {
    const href = anchor.getAttribute('href') || '';
    const targetId = href.slice(1).trim();
    if (targetId && !ids.has(targetId)) {
      issues.push({
        type: 'error',
        code: 'broken-anchor',
        message: `Broken anchor link detected: ${href} does not match any element id.`,
        href,
        targetId,
      });
    }
  });

  // Placeholder images + low-opacity image check
  Array.from(doc.querySelectorAll('img')).forEach((image) => {
    if (isMissingImageSource(image.getAttribute('src'))) {
      const blockId = image.closest('section')?.getAttribute('data-block-id') || undefined;
      issues.push({
        type: 'warning',
        code: 'missing-image-source',
        message: 'One or more images are missing a real src value or still use a placeholder source.',
        src: image.getAttribute('src') || undefined,
        blockId,
      });
    } else if (isInvalidImageSource(image.getAttribute('src'))) {
      const blockId = image.closest('section')?.getAttribute('data-block-id') || undefined;
      issues.push({
        type: 'error',
        code: 'invalid-image-source',
        message: 'One or more images use an invalid or malformed src value.',
        src: image.getAttribute('src') || undefined,
        blockId,
      });
    } else if (hasLowOpacity(image)) {
      // Image is present but nearly invisible
      const blockId = image.closest('section')?.getAttribute('data-block-id') || undefined;
      issues.push({
        type: 'warning',
        code: 'low-opacity-image',
        message: 'An image has a very low opacity class applied and may be nearly invisible.',
        blockId,
      });
    }
  });

  // Per-section checks
  Array.from(doc.querySelectorAll('section')).forEach((section) => {
    const blockId = section.getAttribute('data-block-id') || undefined;
    const sectionId = section.getAttribute('id') || blockId || 'section';

    if (!hasExplicitBackground(section)) {
      issues.push({
        type: 'warning',
        code: 'missing-background',
        message: `Section "${sectionId}" is missing an explicit background class or style.`,
        blockId,
        targetId: section.getAttribute('id') || undefined,
      });
    }

    if (isHeroSection(section) && usesViewportHeight(section) && !hasIntentionalVerticalBalancing(section)) {
      issues.push({
        type: 'warning',
        code: 'hero-balance',
        message: `Hero section "${sectionId}" uses full-viewport height without clear vertical balancing.`,
        blockId,
        targetId: section.getAttribute('id') || undefined,
      });
    }

    if (isSocialProofSection(section) && hasCrowdedSocialProofLayout(section)) {
      issues.push({
        type: 'warning',
        code: 'social-proof-layout',
        message: `Social proof section "${sectionId}" uses a cramped desktop metrics grid.`,
        blockId,
        targetId: section.getAttribute('id') || undefined,
      });
    }

    // Low-contrast text: dark text inside a strongly-colored background section
    const isDark = hasDarkOrColoredBackground(section);
    const isLight = hasLightBackground(section);

    if (isDark && !isLight) {
      const darkEls = findDarkTextElements(section);
      if (darkEls.length > 0) {
        issues.push({
          type: 'warning',
          code: 'dark-text-on-dark-bg',
          message: `Section "${sectionId}" has dark text utilities (e.g. text-gray-900) on a colored background — text may be unreadable.`,
          blockId,
          targetId: section.getAttribute('id') || undefined,
        });
      }
    }

    if (isLight) {
      const lightEls = findLightTextElements(section);
      if (lightEls.length > 0) {
        issues.push({
          type: 'warning',
          code: 'light-text-on-light-bg',
          message: `Section "${sectionId}" has light text on a light background — text may be unreadable.`,
          blockId,
          targetId: section.getAttribute('id') || undefined,
        });
      }
    }

    const hiddenTextElements = Array.from(section.querySelectorAll('[class], [style]')).filter(isVisuallyHiddenText);
    if (hiddenTextElements.length > 0) {
      issues.push({
        type: 'warning',
        code: 'invisible-text',
        message: `Section "${sectionId}" contains text that may be invisible due to transparent color, hidden visibility, or very low opacity.`,
        blockId,
        targetId: section.getAttribute('id') || undefined,
      });
    }

    // Elements with colored backgrounds (buttons, badges) and dark text
    const coloredBgIssues = findColoredBgWithDarkText(section);
    if (coloredBgIssues.length > 0) {
      issues.push({
        type: 'warning',
        code: 'colored-bg-dark-text',
        message: `Section "${sectionId}" has elements with colored backgrounds and dark text — text may be unreadable.`,
        blockId,
        targetId: section.getAttribute('id') || undefined,
      });
    }

    // Inner elements with light background + light text (e.g. bg-white cards with text-white)
    const innerContrastIssues = findInnerLightBgWithLightText(section);
    if (innerContrastIssues.length > 0) {
      issues.push({
        type: 'warning',
        code: 'inner-light-on-light',
        message: `Section "${sectionId}" has inner elements with light backgrounds and light text — text may be unreadable.`,
        blockId,
        targetId: section.getAttribute('id') || undefined,
      });
    }

    // Alignment mismatch: heading and subtext using different alignment in the same wrapper
    if (hasAlignmentMismatch(section)) {
      issues.push({
        type: 'warning',
        code: 'alignment-mismatch',
        message: `Section "${sectionId}" has inconsistent text alignment between headings and body copy.`,
        blockId,
        targetId: section.getAttribute('id') || undefined,
      });
    }
  });

  // Redundant same-section anchor links in navigation blocks
  const navBlocks = Array.from(doc.querySelectorAll('section[data-block-id]')).filter((s) =>
    blockContainsNavigationChrome({ id: s.getAttribute('data-block-id') || '', label: '', html: s.outerHTML }),
  );
  navBlocks.forEach((navSection) => {
    const blockId = navSection.getAttribute('data-block-id') || undefined;
    const firstSection = doc.querySelector('section[data-block-id]');
    const firstSectionId = firstSection?.getAttribute('id') || firstSection?.getAttribute('data-block-id');
    const anchors = Array.from(navSection.querySelectorAll('a[href^="#"]'));
    // The logo-like anchor is the first anchor that contains an icon or image
    const logoAnchor = anchors.find((a) => {
      const cls = a.getAttribute('class') || '';
      return a.querySelector('img,svg,i[data-lucide]') || /flex-shrink-0|logo|brand/.test(cls);
    });
    const logoTarget = logoAnchor?.getAttribute('href')?.slice(1);

    if (logoTarget && firstSectionId) {
      anchors.forEach((anchor) => {
        if (anchor === logoAnchor) return;
        const href = anchor.getAttribute('href') || '';
        const target = href.slice(1);
        if (target && (target === logoTarget || target === firstSectionId)) {
          issues.push({
            type: 'warning',
            code: 'redundant-nav-link',
            message: `Navigation has a redundant "${anchor.textContent?.trim()}" link (${href}) — the logo already scrolls there.`,
            blockId,
            href,
            targetId: target,
          });
        }
      });
    }
  });

  // Missing smooth scroll
  if (!/scroll-behavior\s*:\s*smooth/i.test(fullHtml)) {
    issues.push({
      type: 'warning',
      code: 'missing-smooth-scroll',
      message: 'Smooth scrolling is missing from the assembled HTML.',
    });
  }

  return issues;
}

// ─── Auto-fix helpers ───────────────────────────────────────────

function ensureSectionBackground(html: string): string {
  if (/class="[^"]*\bbg-[^\s"]+/.test(html) || /style="[^"]*background/.test(html)) return html;
  return html.replace(/<section\b([^>]*)class="([^"]*)"/i, '<section$1class="$2 bg-white"');
}

function ensureSmoothScroll(html: string): string {
  if (/scroll-behavior\s*:\s*smooth/i.test(html)) return html;
  return html.replace(/<style>/i, '<style>\n    html { scroll-behavior: smooth; }');
}

async function requestImageSourceRepair(html: string, blockId?: string): Promise<string> {
  try {
    const response = await fetch('/api/image-source', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, blockId }),
    });

    if (!response.ok) {
      return html;
    }

    const data = await response.json().catch(() => null);
    return typeof data?.html === 'string' ? data.html : html;
  } catch {
    return html;
  }
}

function fixInnerLightOnLight(html: string): string {
  // For elements that have bg-white (or similar light bg) AND text-white, swap text to dark
  return html.replace(
    /class="([^"]*\bbg-(?:white|gray-(?:50|100|200|300)|slate-(?:50|100|200|300))\b[^"]*)"/g,
    (match, classValue: string) => {
      let fixed = classValue
        .replace(/\btext-white\b/g, 'text-gray-900')
        .replace(/\btext-gray-(?:50|100|200|300)\b/g, 'text-gray-900')
        .replace(/\btext-slate-(?:50|100|200|300)\b/g, 'text-slate-900');
      return fixed !== classValue ? `class="${fixed}"` : match;
    },
  );
}

function fixInvisibleText(html: string): string {
  return html
    .replace(/\btext-transparent\b(?![^\"]*bg-clip-text)/g, 'text-white')
    // Only strip standalone "invisible" / "hidden" — skip responsive prefixed
    // variants (e.g. md:hidden, lg:invisible) and elements that pair hidden
    // with a responsive display class (e.g. "hidden md:flex").
    .replace(/(?<![:\w])invisible(?![:\w])/g, '')
    .replace(/(?<![:\w])hidden(?![:\w])/g, (match, offset, str) => {
      // Preserve "hidden" when it's part of a responsive toggle pattern
      // e.g. "hidden md:flex", "hidden md:block", "hidden lg:grid"
      const surrounding = str.slice(Math.max(0, offset - 40), offset + 60);
      if (/\b(sm|md|lg|xl|2xl):(flex|block|grid|inline|table)\b/.test(surrounding)) return match;
      // Preserve "hidden" on elements that look like mobile-menu containers
      if (/id="mobile-menu"/.test(surrounding)) return match;
      // Preserve "hidden" inside JavaScript expressions (e.g. toggle('hidden'))
      if (/classList|toggle|querySelector|getElementById/.test(surrounding)) return match;
      return '';
    })
    .replace(/(?<![:\w])opacity-0(?![:\w\d])/g, 'opacity-100')
    .replace(/(?<![:\w])opacity-10(?![:\w\d])/g, 'opacity-100')
    .replace(/(?<![:\w])opacity-20(?![:\w\d])/g, 'opacity-100')
    .replace(/(?<![:\w])opacity-30(?![:\w\d])/g, 'opacity-100')
    .replace(/(?<![:\w])opacity-40(?![:\w\d])/g, 'opacity-100')
    .replace(/style="([^"]*?)display\s*:\s*none;?\s*([^"]*)"/gi, 'style="$1$2"')
    .replace(/style="([^"]*?)visibility\s*:\s*hidden;?\s*([^"]*)"/gi, 'style="$1$2"')
    .replace(/style="([^"]*?)opacity\s*:\s*0(?:\.\d+)?;?\s*([^"]*)"/gi, 'style="$1opacity: 1;$2"')
    .replace(/style="([^"]*?)opacity\s*:\s*0\.[1-3]\d?;?\s*([^"]*)"/gi, 'style="$1opacity: 1;$2"')
    .replace(/\s{2,}/g, ' ');
}

// ─── Broken image URL verification ──────────────────────────────

/** HEAD-check a URL. Returns true if reachable (2xx/3xx), false otherwise. */
async function isImageReachable(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Verify all image URLs in blocks and replace any that return 404/error.
 * Uses HEAD requests with a 5 s timeout per URL.
 */
async function verifyAndRepairBrokenImages(
  blocks: Block[],
): Promise<{ blocks: Block[]; applied: string[] }> {
  const applied: string[] = [];

  // Collect all unique image URLs across all blocks
  const urlToBlocks = new Map<string, Set<string>>();
  const urlToAlt = new Map<string, string>();

  for (const block of blocks) {
    const imgRegex = /<img\b[^>]*\ssrc="([^"]+)"[^>]*>/gi;
    let m;
    while ((m = imgRegex.exec(block.html)) !== null) {
      const src = m[1].trim();
      if (!src || !/^https?:\/\//.test(src)) continue;
      if (!urlToBlocks.has(src)) urlToBlocks.set(src, new Set());
      urlToBlocks.get(src)!.add(block.id);

      // Also grab the alt text for this image
      const altMatch = m[0].match(/\salt="([^"]*)"/i);
      if (altMatch && !urlToAlt.has(src)) {
        urlToAlt.set(src, altMatch[1]);
      }
    }
  }

  if (urlToBlocks.size === 0) return { blocks, applied };

  // HEAD-check all URLs in parallel
  const urls = Array.from(urlToBlocks.keys());
  const results = await Promise.all(urls.map(async (url) => ({ url, ok: await isImageReachable(url) })));
  const brokenUrls = results.filter(r => !r.ok).map(r => r.url);

  if (brokenUrls.length === 0) return { blocks, applied };

  // Build replacement map: broken URL → content-aware alternative
  const replacements = new Map<string, string>();

  brokenUrls.forEach((url) => {
    const alt = urlToAlt.get(url) || '';
    const wMatch = url.match(/[&?]w=(\d+)/);
    const hMatch = url.match(/[&?]h=(\d+)/);
    const w = wMatch ? wMatch[1] : '800';
    const h = hMatch ? hMatch[1] : '600';

    // Extract keywords from alt text for a content-relevant replacement
    const keywords = alt
      .toLowerCase()
      .replace(/[^a-z0-9\s-]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !['image', 'photo', 'picture', 'icon', 'the', 'and', 'for'].includes(t))
      .slice(0, 3);
    const query = keywords.length > 0 ? keywords.join(',') : 'technology,product';
    const lockSeed = encodeURIComponent(query.replace(/\s+/g, '-'));
    replacements.set(url, `https://loremflickr.com/${w}/${h}/${encodeURIComponent(query)}?lock=${lockSeed}`);
  });

  // Apply replacements across all blocks
  let nextBlocks = blocks.map(block => {
    let html = block.html;
    let changed = false;
    for (const [broken, replacement] of replacements) {
      if (html.includes(broken)) {
        html = html.replaceAll(broken, replacement);
        changed = true;
      }
    }
    return changed ? { ...block, html } : block;
  });

  applied.push(`Replaced ${brokenUrls.length} broken image URL${brokenUrls.length !== 1 ? 's' : ''} with working alternatives.`);
  return { blocks: nextBlocks, applied };
}

// ─── Main auto-fix entry point ──────────────────────────────────

export async function autoFixIssues(blocks: Block[], issues: ValidationIssue[]): Promise<{
  blocks: Block[];
  applied: string[];
}> {
  let nextBlocks = blocks.map((block) => {
    const normalizedHtml = setRootSectionIdentifiers(block.html, block.id);
    return normalizedHtml === block.html ? { ...block } : { ...block, html: normalizedHtml };
  });
  const applied: string[] = [];
  const imageRepairCache = new Map<string, Promise<string>>();

  const getRepairedImageHtml = (blockId: string, currentHtml: string): Promise<string> => {
    const cached = imageRepairCache.get(blockId);
    if (cached) return cached;
    const repairPromise = requestImageSourceRepair(currentHtml, blockId);
    imageRepairCache.set(blockId, repairPromise);
    return repairPromise;
  };

  nextBlocks.forEach((block, index) => {
    if (block.html !== blocks[index]?.html) {
      applied.push(`Realigned section id and data-block-id for ${block.id}.`);
    }
  });

  for (const issue of issues) {
    if (issue.code === 'duplicate-navigation') {
      const navigationBlockIds = nextBlocks
        .filter((block) => blockContainsNavigationChrome(block))
        .map((block) => block.id);

      if (navigationBlockIds.length > 1) {
        const duplicateNavigationIds = new Set(navigationBlockIds.slice(1));
        nextBlocks = nextBlocks.map((block) =>
          duplicateNavigationIds.has(block.id)
            ? { ...block, html: demoteDuplicateNavigation(block.html) }
            : block,
        );
        duplicateNavigationIds.forEach((blockId) => {
          applied.push(`Removed duplicate navigation chrome from ${blockId}.`);
        });
      }
    }

    if (issue.code === 'missing-background' && issue.blockId) {
      nextBlocks = nextBlocks.map((block) =>
        block.id === issue.blockId
          ? { ...block, html: ensureSectionBackground(block.html) }
          : block,
      );
      applied.push(`Added an explicit background to ${issue.blockId}.`);
    }

    if (issue.code === 'missing-image-source' && issue.blockId) {
      nextBlocks = await Promise.all(nextBlocks.map(async (block) =>
        block.id === issue.blockId
          ? { ...block, html: await getRepairedImageHtml(block.id, block.html) }
          : block,
      ));
      applied.push(`Requested new image sources from the API for ${issue.blockId}.`);
    }

    if (issue.code === 'invalid-image-source' && issue.blockId) {
      nextBlocks = await Promise.all(nextBlocks.map(async (block) =>
        block.id === issue.blockId
          ? { ...block, html: await getRepairedImageHtml(block.id, block.html) }
          : block,
      ));
      applied.push(`Requested replacement image sources from the API for ${issue.blockId}.`);
    }

    if (issue.code === 'broken-anchor' && issue.href) {
      const target = resolveAnchorTarget(issue.targetId, nextBlocks);
      if (!target) continue;

      nextBlocks = nextBlocks.map((block) => ({
        ...block,
        html: block.html.replaceAll(`href="${issue.href}"`, `href="#${target}"`),
      }));
      applied.push(`Updated broken anchor ${issue.href} to #${target}.`);
    }

    if (issue.code === 'social-proof-layout' && issue.blockId) {
      nextBlocks = nextBlocks.map((block) =>
        block.id === issue.blockId
          ? { ...block, html: improveSocialProofLayout(block.html) }
          : block,
      );
      applied.push(`Rebalanced the social proof grid in ${issue.blockId}.`);
    }

    if (issue.code === 'dark-text-on-dark-bg' && issue.blockId) {
      nextBlocks = nextBlocks.map((block) =>
        block.id === issue.blockId
          ? { ...block, html: fixLowContrastText(block.html) }
          : block,
      );
      applied.push(`Fixed low-contrast dark text in ${issue.blockId} — switched to white text on colored background.`);
    }

    if (issue.code === 'colored-bg-dark-text' && issue.blockId) {
      nextBlocks = nextBlocks.map((block) =>
        block.id === issue.blockId
          ? { ...block, html: fixColoredBgDarkText(block.html) }
          : block,
      );
      applied.push(`Fixed dark text on colored background elements in ${issue.blockId}.`);
    }

    if (issue.code === 'light-text-on-light-bg' && issue.blockId) {
      nextBlocks = nextBlocks.map((block) =>
        block.id === issue.blockId
          ? { ...block, html: fixLightTextOnLightBg(block.html) }
          : block,
      );
      applied.push(`Fixed low-contrast light text in ${issue.blockId} — switched to dark text on light background.`);
    }

    if (issue.code === 'invisible-text' && issue.blockId) {
      nextBlocks = nextBlocks.map((block) =>
        block.id === issue.blockId
          ? { ...block, html: fixInvisibleText(block.html) }
          : block,
      );
      applied.push(`Restored text visibility in ${issue.blockId}.`);
    }

    if (issue.code === 'inner-light-on-light' && issue.blockId) {
      nextBlocks = nextBlocks.map((block) =>
        block.id === issue.blockId
          ? { ...block, html: fixInnerLightOnLight(block.html) }
          : block,
      );
      applied.push(`Fixed light-on-light contrast inside inner elements in ${issue.blockId}.`);
    }

    if (issue.code === 'low-opacity-image' && issue.blockId) {
      nextBlocks = nextBlocks.map((block) =>
        block.id === issue.blockId
          ? { ...block, html: fixLowOpacityImages(block.html) }
          : block,
      );
      applied.push(`Removed near-invisible opacity class from image in ${issue.blockId}.`);
    }

    if (issue.code === 'alignment-mismatch' && issue.blockId) {
      nextBlocks = nextBlocks.map((block) =>
        block.id === issue.blockId
          ? { ...block, html: fixAlignmentMismatch(block.html) }
          : block,
      );
      applied.push(`Fixed heading/body alignment inconsistency in ${issue.blockId}.`);
    }

    if (issue.code === 'redundant-nav-link' && issue.blockId && issue.href) {
      // Remove the redundant anchor element entirely from the nav block
      nextBlocks = nextBlocks.map((block) => {
        if (block.id !== issue.blockId) return block;
        // Match the full <a href="#TARGET">...</a> tag and remove it
        const escapedHref = issue.href!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const anchorPattern = new RegExp(
          `<a\\b[^>]*href="${escapedHref}"[^>]*>[\\s\\S]*?<\/a>`,
          'gi',
        );
        return { ...block, html: block.html.replace(anchorPattern, '') };
      });
      applied.push(`Removed redundant nav link "${issue.href}" from ${issue.blockId} (logo already scrolls there).`);
    }
  }

  nextBlocks = nextBlocks.map((block) => {
    if (!blockContainsNavigationChrome(block)) return block;

    // Fix responsive navbar classes (hidden/md:flex, hamburger, mobile menu)
    const responsive = fixNavbarResponsive(block.html);
    if (responsive.changed) {
      applied.push(`Fixed navbar responsive classes in ${block.id} (desktop/mobile visibility, hamburger toggle).`);
      block = { ...block, html: responsive.html };
    }

    const { html, changed } = normalizeNavbarAnchors(block.html, nextBlocks);
    if (changed) {
      applied.push(`Normalized navbar anchor targets in ${block.id}.`);
      return { ...block, html };
    }
    return block;
  });

  // Verify image URLs are reachable and replace broken ones
  try {
    const imageResult = await verifyAndRepairBrokenImages(nextBlocks);
    if (imageResult.applied.length > 0) {
      nextBlocks = imageResult.blocks;
      applied.push(...imageResult.applied);
    }
  } catch (err) {
    // Non-fatal: skip image verification if it fails (e.g. network issues)
  }

  return { blocks: nextBlocks, applied };
}

export function applyGlobalValidationFixes(fullHtml: string): string {
  return ensureSmoothScroll(fullHtml);
}
