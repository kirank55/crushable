import { ExampleReference, RAGQuery } from "@/types";
import { EXAMPLE_LIBRARY } from "@/lib/examples";

function countKeywordMatches(tags: string[], keywords: string[]): number {
  const normalizedTags = tags.map((tag) => tag.toLowerCase());
  return keywords.reduce((count, keyword) => {
    const normalizedKeyword = keyword.toLowerCase();
    return normalizedTags.some((tag) => tag.includes(normalizedKeyword) || normalizedKeyword.includes(tag))
      ? count + 1
      : count;
  }, 0);
}

export function inferIndustryFromContext(projectContext?: string): string | undefined {
  if (!projectContext) return undefined;

  const normalized = projectContext.toLowerCase();
  if (/agency|studio|consult/.test(normalized)) return "agency";
  if (/course|cohort|creator|education/.test(normalized)) return "education";
  if (/fitness|health|wellness/.test(normalized)) return "health";
  if (/local|service|booking|appointment/.test(normalized)) return "local-services";
  if (/shop|commerce|ecommerce|store/.test(normalized)) return "ecommerce";
  if (/software|saas|platform|product/.test(normalized)) return "saas";
  return undefined;
}

export function retrieveExamples(query: RAGQuery, limit = 2): ExampleReference[] {
  const keywords = query.keywords?.filter(Boolean) || [];

  return [...EXAMPLE_LIBRARY]
    .map((example) => {
      let score = 0;

      if (example.sectionType === query.sectionType) score += 5;
      if (example.designStyle === query.designStyle) score += 3;
      if (query.industry && example.industry === query.industry) score += 3;
      score += countKeywordMatches(example.tags, keywords);

      return { example, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.example);
}

export function formatReferenceExamples(examples: ExampleReference[]): string {
  if (examples.length === 0) return "";

  return examples
    .map(
      (example, index) =>
        `---EXAMPLE ${index + 1}: ${example.description}---\n${example.html}\n---END EXAMPLE ${index + 1}---`,
    )
    .join("\n\n");
}
