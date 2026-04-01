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

  // Placeholder images
  Array.from(doc.querySelectorAll('img')).forEach((image) => {
    if (isMissingImageSource(image.getAttribute('src'))) {
      const blockId = image.closest('section')?.getAttribute('data-block-id') || undefined;
      issues.push({
        type: 'warning',
        code: 'missing-image-source',
        message: 'One or more images are missing a real src value or still use a placeholder source.',
        blockId,
      });
    }
  });

  // Per-section checks
  Array.from(doc.querySelectorAll('section')).forEach((section) => {
    if (!hasExplicitBackground(section)) {
      const sectionId = section.getAttribute('id') || section.getAttribute('data-block-id') || 'section';
      issues.push({
        type: 'warning',
        code: 'missing-background',
        message: `Section "${sectionId}" is missing an explicit background class or style.`,
        blockId: section.getAttribute('data-block-id') || undefined,
        targetId: section.getAttribute('id') || undefined,
      });
    }

    if (isHeroSection(section) && usesViewportHeight(section) && !hasIntentionalVerticalBalancing(section)) {
      const sectionId = section.getAttribute('id') || section.getAttribute('data-block-id') || 'hero';
      issues.push({
        type: 'warning',
        code: 'hero-balance',
        message: `Hero section "${sectionId}" uses full-viewport height without clear vertical balancing.`,
        blockId: section.getAttribute('data-block-id') || undefined,
        targetId: section.getAttribute('id') || undefined,
      });
    }

    if (isSocialProofSection(section) && hasCrowdedSocialProofLayout(section)) {
      const sectionId = section.getAttribute('id') || section.getAttribute('data-block-id') || 'social-proof';
      issues.push({
        type: 'warning',
        code: 'social-proof-layout',
        message: `Social proof section "${sectionId}" uses a cramped desktop metrics grid.`,
        blockId: section.getAttribute('data-block-id') || undefined,
        targetId: section.getAttribute('id') || undefined,
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
  }

  return { blocks: nextBlocks, applied };
}

export function applyGlobalValidationFixes(fullHtml: string): string {
  return ensureSmoothScroll(fullHtml);
}
