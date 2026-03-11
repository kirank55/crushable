export interface ValidationIssue {
  type: 'error' | 'warning';
  message: string;
}

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

export function validateGeneratedHtml(fullHtml: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const parser = new DOMParser();
  const documentFragment = parser.parseFromString(fullHtml, 'text/html');

  const navElements = Array.from(documentFragment.querySelectorAll('nav'));
  const stickyHeaders = Array.from(documentFragment.querySelectorAll('header')).filter((header) => {
    const className = header.getAttribute('class') || '';
    const style = header.getAttribute('style') || '';
    return /(sticky|fixed)/.test(className) || /position\s*:\s*(sticky|fixed)/.test(style);
  });

  if (navElements.length + stickyHeaders.length > 1) {
    issues.push({
      type: 'warning',
      message: 'Duplicate navigation detected. Multiple nav or sticky header elements were found.',
    });
  }

  const ids = new Set(
    Array.from(documentFragment.querySelectorAll('[id]'))
      .map((element) => element.getAttribute('id')?.trim())
      .filter((value): value is string => Boolean(value))
  );

  Array.from(documentFragment.querySelectorAll('a[href^="#"]')).forEach((anchor) => {
    const href = anchor.getAttribute('href') || '';
    const targetId = href.slice(1).trim();
    if (targetId && !ids.has(targetId)) {
      issues.push({
        type: 'error',
        message: `Broken anchor link detected: ${href} does not match any element id.`,
      });
    }
  });

  Array.from(documentFragment.querySelectorAll('img')).forEach((image) => {
    if (isMissingImageSource(image.getAttribute('src'))) {
      issues.push({
        type: 'warning',
        message: 'One or more images are missing a real src value or still use a placeholder source.',
      });
    }
  });

  Array.from(documentFragment.querySelectorAll('section')).forEach((section) => {
    if (!hasExplicitBackground(section)) {
      const sectionId = section.getAttribute('id') || section.getAttribute('data-block-id') || 'section';
      issues.push({
        type: 'warning',
        message: `Section "${sectionId}" is missing an explicit background class or style.`,
      });
    }
  });

  if (!/scroll-behavior\s*:\s*smooth/i.test(fullHtml)) {
    issues.push({
      type: 'warning',
      message: 'Smooth scrolling is missing from the assembled HTML.',
    });
  }

  return issues;
}
