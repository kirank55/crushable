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

// Check if a section has a strongly-colored background (not white/gray/transparent)
function hasDarkOrColoredBackground(section: Element): boolean {
  const className = section.getAttribute('class') || '';
  const style = section.getAttribute('style') || '';
  // Detects Tailwind bg-{color}-{shade} where shade >= 400, gradients, and inline bg with non-white colors
  return /\bbg-(?!white|gray-[0-2]|slate-[0-2]|zinc-[0-2]|neutral-[0-2]|stone-[0-2]|transparent|black\/0)[a-z]/.test(className)
    || /from-(?!white|gray-[0-2]|slate-[0-2])/.test(className)
    || /to-(?!white|gray-[0-2]|slate-[0-2])/.test(className)
    || /background(?:-color)?\s*:\s*(?!white|#fff|rgba\(255,255,255)/i.test(style);
}

// Find dark text classes inside an element — only problematic on colored backgrounds
function findDarkTextElements(section: Element): Element[] {
  const darkTextPattern = /\btext-(?:gray|slate|zinc|neutral|stone)-(?:[6-9][0-9][0-9]|[6-9]00)\b|\btext-black\b/;
  return Array.from(section.querySelectorAll('[class]')).filter((el) => {
    const cls = el.getAttribute('class') || '';
    return darkTextPattern.test(cls);
  });
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
  // Replace dark text utilities with white equivalents when on colored backgrounds
  return html
    .replace(/\btext-gray-900\b/g, 'text-white')
    .replace(/\btext-gray-800\b/g, 'text-white')
    .replace(/\btext-gray-700\b/g, 'text-white')
    .replace(/\btext-gray-600\b/g, 'text-white\/80')
    .replace(/\btext-slate-900\b/g, 'text-white')
    .replace(/\btext-slate-800\b/g, 'text-white')
    .replace(/\btext-slate-700\b/g, 'text-white')
    .replace(/\btext-slate-600\b/g, 'text-white\/80');
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
  const logoAnchor = anchors.find((anchor) => {
    const cls = anchor.getAttribute('class') || '';
    return anchor.querySelector('img,svg,i[data-lucide]') || /flex-shrink-0|logo|brand/.test(cls);
  });

  const contentAnchors = anchors.filter((anchor) => anchor !== logoAnchor);
  const usedTargetIds = new Set<string>();
  let fallbackIndex = 0;
  let changed = false;

  const getNextFallbackTarget = (): string | null => {
    while (fallbackIndex < targets.length) {
      const candidate = targets[fallbackIndex++];
      if (!usedTargetIds.has(candidate.id)) {
        return candidate.id;
      }
    }
    return null;
  };

  contentAnchors.forEach((anchor) => {
    const href = anchor.getAttribute('href') || '';
    const currentTarget = href.slice(1).trim();
    const anchorText = anchor.textContent?.replace(/\s+/g, ' ').trim() || '';

    let resolvedTarget = resolveAnchorTarget(anchorText, blocks);

    if (!resolvedTarget && currentTarget && targetIds.has(currentTarget) && !usedTargetIds.has(currentTarget)) {
      resolvedTarget = currentTarget;
    }

    if (!resolvedTarget || usedTargetIds.has(resolvedTarget)) {
      resolvedTarget = getNextFallbackTarget();
    }

    if (!resolvedTarget) return;

    usedTargetIds.add(resolvedTarget);
    const desiredHref = `#${resolvedTarget}`;
    if (href !== desiredHref) {
      anchor.setAttribute('href', desiredHref);
      changed = true;
    }
  });

  return { html: changed ? section.outerHTML : html, changed };
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
    if (hasDarkOrColoredBackground(section)) {
      const darkEls = findDarkTextElements(section);
      if (darkEls.length > 0) {
        issues.push({
          type: 'warning',
          code: 'low-contrast-text',
          message: `Section "${sectionId}" has dark text utilities (e.g. text-gray-900) on a colored background — text may be unreadable.`,
          blockId,
          targetId: section.getAttribute('id') || undefined,
        });
      }
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

function replacePlaceholderImages(html: string): string {
  return html.replace(
    /src="([^"]*(?:placeholder|example\.com|via\.placeholder|dummyimage|your-image|image-url)[^"]*)"/gi,
    'src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80"',
  );
}

// ─── Main auto-fix entry point ──────────────────────────────────

export function autoFixIssues(blocks: Block[], issues: ValidationIssue[]): {
  blocks: Block[];
  applied: string[];
} {
  let nextBlocks = blocks.map((block) => {
    const normalizedHtml = setRootSectionIdentifiers(block.html, block.id);
    return normalizedHtml === block.html ? { ...block } : { ...block, html: normalizedHtml };
  });
  const applied: string[] = [];

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
      nextBlocks = nextBlocks.map((block) =>
        block.id === issue.blockId
          ? { ...block, html: replacePlaceholderImages(block.html) }
          : block,
      );
      applied.push(`Replaced placeholder image sources in ${issue.blockId}.`);
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

    if (issue.code === 'low-contrast-text' && issue.blockId) {
      nextBlocks = nextBlocks.map((block) =>
        block.id === issue.blockId
          ? { ...block, html: fixLowContrastText(block.html) }
          : block,
      );
      applied.push(`Fixed low-contrast dark text in ${issue.blockId} — switched to white text on colored background.`);
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
    const { html, changed } = normalizeNavbarAnchors(block.html, nextBlocks);
    if (changed) {
      applied.push(`Normalized navbar anchor targets in ${block.id}.`);
      return { ...block, html };
    }
    return block;
  });

  return { blocks: nextBlocks, applied };
}

export function applyGlobalValidationFixes(fullHtml: string): string {
  return ensureSmoothScroll(fullHtml);
}
