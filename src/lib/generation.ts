import { ComponentSummary, ExampleReference, PlannedSectionLike, SectionTemplate } from "@/types";
import { formatReferenceExamples } from "@/lib/rag";

export function buildTemplateCatalog(templates: SectionTemplate[]): string {
  return templates
    .map(
      (template) =>
        `- ${template.id}: ${template.name} [${template.category}] (${template.designStyles.join(", ")}) - ${template.description}`,
    )
    .join("\n");
}

export function buildComponentCatalog(components: ComponentSummary[]): string {
  return components
    .map(
      (component) =>
        `- ${component.id}: ${component.name} [${component.category}] (${component.variants.join(", ")}) - ${component.description}`,
    )
    .join("\n");
}

export function buildSectionMap(sections: Array<{ title: string; id: string }>): string {
  return sections
    .filter((section) => section.id !== "home")
    .map((section) => `- ${section.title} -> #${section.id}`)
    .join("\n");
}

export function buildSectionGenerationPrompt({
  section,
  index,
  totalSections,
  sectionMap,
  examples,
}: {
  section: PlannedSectionLike;
  index: number;
  totalSections: number;
  sectionMap: string;
  examples?: ExampleReference[];
}): string {
  const isNavbarSection = section.id === "home";
  const isSocialProofSection = section.id.includes("social-proof") || section.title.toLowerCase().includes("social proof");
  const exampleBlock = examples && examples.length > 0
    ? `Reference examples for inspiration:\n${formatReferenceExamples(examples)}`
    : "";

  return [
    `Create a ${section.title} section for a landing page. This is section ${index + 1} of ${totalSections}.`,
    `Use id="${section.id}" and data-block-id="${section.id}" on the root <section>. Do not reuse ids from examples or previous sections.`,
    sectionMap ? `Page section map:\n${sectionMap}` : "",
    isNavbarSection
      ? "If this is the navbar, include anchor links ONLY for the sections listed in the page section map. Do not invent links to sections that are not being generated."
      : "Make sure this section matches its assigned role in the page section map so navbar links stay valid.",
    isSocialProofSection
      ? "For social proof metric cards, keep the desktop layout balanced. Prefer a 2x2 metric grid or a clearly sized proof column, not a cramped 3-column strip of small cards."
      : "",
    section.details ? `Requirements: ${section.details}` : "",
    exampleBlock,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4)
    .slice(0, 12);
}

export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function consume(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const count = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: count }, () => consume()));
  return results;
}

export function formatParallelProgress(states: Array<{ title: string; status: 'pending' | 'running' | 'done' | 'error' }>): string {
  return states
    .map((state) => {
      const prefix =
        state.status === "done"
          ? "\n ✓"
          : state.status === "running"
            ? "\n ⟳"
            : state.status === "error"
              ? "\n !"
              : "\n •";
      return `${prefix} ${state.title}`;
    })
    .join("  ");
}
