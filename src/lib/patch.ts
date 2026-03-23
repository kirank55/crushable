import { HtmlPatch } from "@/types";

function parseFragment(html: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(html, "text/html");
}

function getRootSection(documentFragment: Document): HTMLElement {
  const section = documentFragment.body.firstElementChild;
  if (!(section instanceof HTMLElement)) {
    throw new Error("Patch target must contain a root section element.");
  }
  return section;
}

function parseHtmlNodes(documentFragment: Document, html: string): Node[] {
  const template = documentFragment.createElement("template");
  template.innerHTML = html.trim();
  return Array.from(template.content.childNodes);
}

function requireTarget(root: HTMLElement, selector: string): HTMLElement {
  const element = root.querySelector(selector);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Patch selector did not match any element: ${selector}`);
  }
  return element;
}

export function applyPatch(html: string, patch: HtmlPatch): string {
  const documentFragment = parseFragment(html);
  const root = getRootSection(documentFragment);

  for (const op of patch.ops) {
    switch (op.type) {
      case "replace": {
        const target = requireTarget(root, op.selector);
        if (op.oldText && !target.textContent?.includes(op.oldText)) {
          throw new Error(`Patch replace op oldText mismatch for selector ${op.selector}`);
        }
        target.textContent = op.newText;
        break;
      }
      case "setAttribute": {
        const target = requireTarget(root, op.selector);
        target.setAttribute(op.attr, op.value);
        break;
      }
      case "addClass": {
        const target = requireTarget(root, op.selector);
        op.classes.split(/\s+/).filter(Boolean).forEach((className) => target.classList.add(className));
        break;
      }
      case "removeClass": {
        const target = requireTarget(root, op.selector);
        op.classes.split(/\s+/).filter(Boolean).forEach((className) => target.classList.remove(className));
        break;
      }
      case "insertAfter": {
        const target = requireTarget(root, op.selector);
        const nodes = parseHtmlNodes(documentFragment, op.html);
        target.after(...nodes);
        break;
      }
      case "insertBefore": {
        const target = requireTarget(root, op.selector);
        const nodes = parseHtmlNodes(documentFragment, op.html);
        target.before(...nodes);
        break;
      }
      case "remove": {
        const target = requireTarget(root, op.selector);
        target.remove();
        break;
      }
      default: {
        const exhaustive: never = op;
        throw new Error(`Unsupported patch op: ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  return root.outerHTML;
}

export function summarizePatch(patch: HtmlPatch): string[] {
  return patch.ops.map((op) => {
    switch (op.type) {
      case "replace":
        return `Updated text in ${op.selector}.`;
      case "setAttribute":
        return `Set ${op.attr} on ${op.selector}.`;
      case "addClass":
        return `Added classes to ${op.selector}: ${op.classes}.`;
      case "removeClass":
        return `Removed classes from ${op.selector}: ${op.classes}.`;
      case "insertAfter":
        return `Inserted content after ${op.selector}.`;
      case "insertBefore":
        return `Inserted content before ${op.selector}.`;
      case "remove":
        return `Removed ${op.selector}.`;
      default:
        return "Applied patch.";
    }
  });
}
