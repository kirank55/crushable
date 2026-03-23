"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Block,
  ComponentManifestItem,
  DESIGN_STYLES,
  HtmlPatch,
  Message,
  ModificationEngineOperation,
  ModificationEngineResponse,
  SectionCritique,
  ValidationIssue,
} from "@/types";
import {
  createBlock,
  ensureUniqueBlockIdentity,
  setRootSectionIdentifiers,
} from "@/lib/blocks";
import {
  getApiKey,
  getGenerationStrategy,
  getModel,
  getRefinementLevel,
} from "@/lib/storage";
import {
  parseJsonArrayResponse,
  parseJsonObjectResponse,
  parsePlanResponse,
  parseResponse,
} from "@/lib/prompt";
import {
  Send,
  Loader2,
  ChevronDown,
  ChevronRight,
  Code,
  Zap,
  CheckCircle2,
  Link2,
  ClipboardList,
  Hammer,
  RefreshCw,
  Square,
  RotateCcw,
  Pencil,
  Plus,
  Cpu,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@/lib/logger";
import { generateFullHTML } from "@/lib/export";
import {
  applyGlobalValidationFixes,
  autoFixIssues,
  validateGeneratedHtml,
} from "@/lib/validate";
import {
  fillTemplateSkeleton,
  getSectionTemplateById,
  inferTemplateCategory,
  pickTemplateForSection,
  SECTION_TEMPLATES,
} from "@/lib/section-templates";
import {
  buildComponentCatalog,
  buildSectionGenerationPrompt,
  buildSectionMap,
  buildTemplateCatalog,
  extractKeywords,
  formatParallelProgress,
  runWithConcurrency,
} from "@/lib/generation";
import {
  getComponentSummaries,
  renderComponentManifestItem,
} from "@/lib/component-registry";
import { inferIndustryFromContext, retrieveExamples } from "@/lib/rag";
import { applyModificationOperationsToBlocks } from "@/lib/modification";
import { applyPatch, summarizePatch } from "@/lib/patch";

interface ChatPanelProps {
  blocks: Block[];
  selectedBlockId: string | null;
  designStyle: string | undefined;
  isFullScreen: boolean;
  resetKey: number;
  onAddBlock: (block: Block) => void;
  onInsertBlockAfter: (
    afterBlockId: string | null | undefined,
    block: Block,
  ) => void;
  onUpdateBlock: (id: string, html: string) => void;
  onRemoveBlock: (id: string) => void;
  onSelectBlock: (id: string | null) => void;
  onClearSelection: () => void;
  onVersionCreated: (prompt: string) => void;
  onSetDesignStyle: (style: string) => void;
  onSetProjectDetails: (details: ProjectDetails) => void;
  onOpenSettings: () => void;
  designStylePrompt: string | undefined;
  projectContext: string | undefined;
  onRestoreBlocks: (blocks: Block[]) => void;
  initialMessages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
}

export interface ProjectDetails {
  title?: string;
  subtitle?: string;
  ctaText?: string;
  brandName?: string;
  productDescription?: string;
}

type LoadingStatus = {
  phase: "idle" | "requesting" | "generating" | "planning" | "building";
  model?: string;
  currentSection?: string;
  sectionIndex?: number;
  totalSections?: number;
};

type PlannedSection = {
  title: string;
  details?: string;
};

type PlannedSectionBlueprint = PlannedSection & {
  id: string;
};

function formatMessageTime(timestamp?: number): string | null {
  if (!timestamp) return null;

  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildUnifiedDiff(beforeText: string, afterText: string): string {
  const before = beforeText.replace(/\r\n/g, "\n").split("\n");
  const after = afterText.replace(/\r\n/g, "\n").split("\n");
  const dp: number[][] = Array.from({ length: before.length + 1 }, () =>
    Array(after.length + 1).fill(0),
  );

  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      if (before[i] === after[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const lines: string[] = ["--- before", "+++ after"];
  let i = 0;
  let j = 0;

  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      lines.push(` ${before[i]}`);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push(`-${before[i]}`);
      i++;
    } else {
      lines.push(`+${after[j]}`);
      j++;
    }
  }

  while (i < before.length) lines.push(`-${before[i++]}`);
  while (j < after.length) lines.push(`+${after[j++]}`);

  return lines.join("\n");
}

function looksLikeDiff(content: string): boolean {
  return (
    content.startsWith("--- before\n+++ after\n") ||
    content === "--- before\n+++ after"
  );
}

function isMultiSectionIntent(prompt: string): boolean {
  const patterns = [
    /\b(landing\s*page|full\s*page|complete\s*page|entire\s*page|whole\s*page)\b/i,
    /\b(build|create|generate|design)\b.*\b(page|website|site)\b/i,
    /\bmultiple\s+sections\b/i,
  ];
  return patterns.some((p) => p.test(prompt));
}

function getModelLabel(modelId: string): string {
  const labels: Record<string, string> = {
    "auto:free": "Free Model",
    "stepfun/step-3.5-flash:free": "StepFun 3.5 Flash",
    "z-ai/glm-4.5-air:free": "GLM 4.5 Air",
    "nvidia/nemotron-3-nano-30b-a3b:free": "NVIDIA Nemotron 30B",
    "google/gemma-3-27b-it:free": "Gemma 3 27B",
    "anthropic/claude-sonnet-4": "Claude Sonnet 4",
    "google/gemini-2.5-flash": "Gemini 2.5 Flash",
    "openai/gpt-4o": "GPT-4o",
    "openai/gpt-4o-mini": "GPT-4o Mini",
    "anthropic/claude-3.5-haiku": "Claude 3.5 Haiku",
  };
  return labels[modelId] || modelId;
}

function extractDetailedPlanSections(plan: string): PlannedSection[] {
  const lines = plan.split(/\r?\n/);
  const sections: PlannedSection[] = [];
  let currentTitle = "";
  let currentDetails: string[] = [];

  const flushCurrent = () => {
    if (!currentTitle) return;
    sections.push({
      title: currentTitle,
      details: currentDetails.join(" ").trim() || undefined,
    });
    currentTitle = "";
    currentDetails = [];
  };

  for (const line of lines) {
    const numberedSectionMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (numberedSectionMatch) {
      flushCurrent();
      currentTitle = numberedSectionMatch[1].trim();
      continue;
    }

    if (!currentTitle) continue;
    if (!line.trim()) continue;

    if (/^\s+/.test(line)) {
      currentDetails.push(line.trim());
      continue;
    }

    break;
  }

  flushCurrent();
  return sections;
}

function shouldShowRestoreButton(
  message: Message,
  isLoading: boolean,
  messages: Message[],
  messageIndex: number,
): boolean {
  if (!message.blocksSnapshot || isLoading) return false;

  if (
    message.content === "Proceed with landing page plan" ||
    message.content === "User clicked on Generate Landing Page" ||
    message.content === "Continue"
  ) {
    return false;
  }

  // Only show restore if the next assistant message has a code diff
  const nextMessage = messages[messageIndex + 1];
  if (!nextMessage || nextMessage.role !== "assistant") return false;

  return looksLikeDiff(nextMessage.content);
}

function isSyntheticSetupMessage(content: string): boolean {
  return (
    content === "Proceed with landing page plan" ||
    content === "User clicked on Generate Landing Page" ||
    content === "Continue"
  );
}

function isExplanationIntent(prompt: string): boolean {
  const patterns = [
    /\bexplain\s+(the\s+)?(previous|last|recent)\s+(change|edit|update)\b/i,
    /\b(explain|describe|summarize)\s+what\s+(changed|you changed|you did)\b/i,
    /\bwhat\s+changed\b/i,
  ];
  return patterns.some((pattern) => pattern.test(prompt));
}

function buildSectionId(title: string, index: number): string {
  const normalized = title.toLowerCase();
  if (/\b(nav|navbar|navigation|header)\b/.test(normalized)) return "home";
  if (/\bhero\b/.test(normalized)) return "hero";
  if (/\bfeature\b/.test(normalized)) return "features";
  if (/\bpricing|offer\b/.test(normalized)) return "pricing";
  if (/\btestimonial\b/.test(normalized)) return "testimonials";
  if (/\bfaq\b/.test(normalized)) return "faq";
  if (/\bfooter\b/.test(normalized)) return "footer";
  if (/\bhow it works\b|\bsteps?\b|\bprocess\b/.test(normalized))
    return "how-it-works";
  if (/\bsocial proof\b|\bmetrics\b|\blogos\b/.test(normalized))
    return "social-proof";
  if (/\bcta\b/.test(normalized)) return "cta";

  const slug = normalized
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || `section-${index + 1}`;
}

function buildSectionBlueprint(
  sections: PlannedSection[],
): PlannedSectionBlueprint[] {
  const usedIds = new Set<string>();

  return sections.map((section, index) => {
    const baseId = buildSectionId(section.title, index);
    let nextId = baseId;
    let suffix = 2;

    while (usedIds.has(nextId)) {
      nextId = `${baseId}-${suffix}`;
      suffix += 1;
    }

    usedIds.add(nextId);
    return {
      ...section,
      id: nextId,
    };
  });
}

function buildPreviousChangeExplanation(messages: Message[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const assistantMessage = messages[i];
    if (assistantMessage.role !== "assistant") continue;
    if (assistantMessage.plan) continue;

    const summary = assistantMessage.summary?.trim();
    if (!summary) continue;
    if (/^Error:/i.test(summary) || /request cancelled/i.test(summary))
      continue;
    if (/planning complete/i.test(summary) || /now implementing/i.test(summary))
      continue;

    const relatedUserMessage = [...messages.slice(0, i)]
      .reverse()
      .find(
        (message) =>
          message.role === "user" &&
          !isSyntheticSetupMessage(message.content) &&
          !isExplanationIntent(message.content),
      );

    const lines = ["Previous change summary:", summary];
    if (relatedUserMessage) {
      lines.push(
        "",
        `It came from your request: "${relatedUserMessage.content}"`,
      );
    }
    if (assistantMessage.blockId) {
      lines.push("", `Affected section: ${assistantMessage.blockId}`);
    }
    return lines.join("\n");
  }

  return null;
}

function buildModificationContent(
  blocks: Block[],
  operations: ModificationEngineOperation[],
): string {
  const updatedDiffs = operations
    .filter(
      (
        operation,
      ): operation is Extract<
        ModificationEngineOperation,
        { type: "update-block" }
      > => operation.type === "update-block",
    )
    .map((operation) => {
      const currentBlock = blocks.find(
        (block) => block.id === operation.blockId,
      );
      if (!currentBlock) return "";
      return buildUnifiedDiff(currentBlock.html, operation.html);
    })
    .filter(Boolean);

  if (updatedDiffs.length > 0) {
    return updatedDiffs.join("\n\n");
  }

  const insertedBlock = operations.find(
    (
      operation,
    ): operation is Extract<
      ModificationEngineOperation,
      { type: "insert-block" }
    > => operation.type === "insert-block",
  );
  if (insertedBlock) {
    return insertedBlock.block.html;
  }

  return "";
}

export default function ChatPanel({
  blocks,
  selectedBlockId,
  designStyle,
  isFullScreen,
  resetKey,
  onAddBlock,
  onInsertBlockAfter,
  onUpdateBlock,
  onRemoveBlock,
  onSelectBlock,
  onClearSelection,
  onVersionCreated,
  onSetDesignStyle,
  onSetProjectDetails,
  onOpenSettings,
  designStylePrompt,
  projectContext,
  onRestoreBlocks,
  initialMessages,
  onMessagesChange,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages || []);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>({
    phase: "idle",
  });
  const [showSelectDropdown, setShowSelectDropdown] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(
    new Set(),
  );
  const [setupPhase, setSetupPhase] = useState<"details" | "ready">(
    designStyle ? "ready" : "details",
  );
  const [setupDetails, setSetupDetails] = useState<ProjectDetails>({});
  const [triedToProceed, setTriedToProceed] = useState(false);
  const [isAutoSelectingStyle, setIsAutoSelectingStyle] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastPersistedMessageIdsRef = useRef("");
  const lastPersistedMessageSignatureRef = useRef("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const selectDropdownRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);
  const selectedStyle = DESIGN_STYLES.find((style) => style.id === designStyle);
  const currentModel = getModel();
  const isUsingFreeModel =
    currentModel === "auto:free" || currentModel.endsWith(":free");
  useEffect(() => {
    setMessages(initialMessages || []);
    setExpandedMessages(new Set());
    lastPersistedMessageIdsRef.current = "";
    lastPersistedMessageSignatureRef.current = "";
    setSetupPhase(designStyle ? "ready" : "details");
    setSetupDetails({});
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load initial messages when they change (e.g. project switch)
  useEffect(() => {
    if (
      initialMessages &&
      initialMessages.length > 0 &&
      messages.length === 0
    ) {
      setMessages(initialMessages);
    }
  }, [initialMessages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync messages to parent for persistence
  useEffect(() => {
    if (!onMessagesChange || messages.length === 0) return;

    const messageIds = messages.map((message) => message.id).join("|");
    const messageSignature = JSON.stringify(
      messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        summary: message.summary,
        plan: message.plan,
        blockId: message.blockId,
        snapshotSize: message.blocksSnapshot?.length || 0,
      })),
    );

    const shouldPersistWhileLoading =
      messageIds !== lastPersistedMessageIdsRef.current;
    if (isLoading && !shouldPersistWhileLoading) return;
    if (messageSignature === lastPersistedMessageSignatureRef.current) return;

    onMessagesChange(messages);
    lastPersistedMessageIdsRef.current = messageIds;
    lastPersistedMessageSignatureRef.current = messageSignature;
  }, [messages, isLoading, onMessagesChange]);

  // Removed: useEffect that auto-advanced setupPhase from "design" to "details"
  // whenever designStyle was truthy. This caused the Back button to not work
  // because clicking Back set phase to "design" but the effect immediately
  // pushed it back to "details". handleDesignStyleSelect already handles this.

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        selectDropdownRef.current &&
        !selectDropdownRef.current.contains(e.target as Node)
      ) {
        setShowSelectDropdown(false);
      }
    };
    if (showSelectDropdown)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSelectDropdown]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.style.height = "auto";
    const computed = window.getComputedStyle(input);
    const lineHeight = Number.parseFloat(computed.lineHeight) || 20;
    const maxHeight = lineHeight * 6 + 20;

    input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`;
    input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [input]);

  useEffect(() => {
    if (!selectedBlockId || isLoading) return;

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isLoading, selectedBlockId]);

  const toggleMessageExpanded = (messageId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  const requestStyleSelection = useCallback(
    async (productDescription: string): Promise<string> => {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: productDescription,
          mode: "style-select",
          apiKey: getApiKey(),
          model: getModel(),
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || "Failed to select a design style.");
      }

      const styleId = (await response.text()).trim();
      return DESIGN_STYLES.some((style) => style.id === styleId)
        ? styleId
        : "professional";
    },
    [],
  );

  const requestModelText = useCallback(
    async (payload: Record<string, unknown>): Promise<string> => {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortControllerRef.current?.signal,
        body: JSON.stringify({
          apiKey: getApiKey(),
          model: getModel(),
          designStylePrompt,
          projectContext,
          designStyle,
          ...payload,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || "Failed to generate");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullContent += decoder.decode(value, { stream: true });
      }

      return fullContent;
    },
    [designStyle, designStylePrompt, projectContext],
  );

  const requestModification = useCallback(
    async (
      payload: Omit<
        Record<string, unknown>,
        | "apiKey"
        | "model"
        | "designStylePrompt"
        | "projectContext"
        | "designStyle"
        | "blocks"
      > & { requestKind: string },
    ): Promise<ModificationEngineResponse> => {
      const response = await fetch("/api/modification-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortControllerRef.current?.signal,
        body: JSON.stringify({
          apiKey: getApiKey(),
          model: getModel(),
          designStylePrompt,
          projectContext,
          designStyle,
          blocks,
          ...payload,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || "Failed to apply modification");
      }

      return (await response.json()) as ModificationEngineResponse;
    },
    [blocks, designStyle, designStylePrompt, projectContext],
  );

  const applyModificationOperations = useCallback(
    (operations: ModificationEngineOperation[]) => {
      operations.forEach((operation) => {
        switch (operation.type) {
          case "update-block":
            onUpdateBlock(operation.blockId, operation.html);
            break;
          case "insert-block":
            onInsertBlockAfter(operation.afterBlockId, operation.block);
            break;
          case "remove-block":
            onRemoveBlock(operation.blockId);
            break;
          case "select-block":
            onSelectBlock(operation.blockId);
            break;
          case "set-design-style":
            onSetDesignStyle(operation.designStyle);
            break;
          default:
            break;
        }
      });
    },
    [
      onInsertBlockAfter,
      onRemoveBlock,
      onSelectBlock,
      onSetDesignStyle,
      onUpdateBlock,
    ],
  );

  const getSectionExamples = useCallback(
    (section: PlannedSection): ReturnType<typeof retrieveExamples> => {
      const industry = inferIndustryFromContext(projectContext);
      return retrieveExamples(
        {
          industry,
          sectionType: inferTemplateCategory(section.title),
          designStyle: designStyle || "professional",
          keywords: extractKeywords(
            `${section.title} ${section.details || ""} ${projectContext || ""}`,
          ),
        },
        2,
      );
    },
    [designStyle, projectContext],
  );

  const summarizeValidationIssues = useCallback((issues: ValidationIssue[]) => {
    if (issues.length === 0) {
      return "Validation complete — no issues found in the assembled page.";
    }

    const preview = issues
      .slice(0, 3)
      .map((issue) => issue.message)
      .join(" ");

    return `Validation found ${issues.length} issue${issues.length === 1 ? "" : "s"}: ${preview}`;
  }, []);

  const generateSection = useCallback(
    async (
      prompt: string,
      mode: "new" | "edit",
      currentBlock?: Block,
    ): Promise<{ summary: string; html: string; raw: string }> => {
      const model = getModel();

      setLoadingStatus({
        phase: "requesting",
        model: getModelLabel(model || "auto:free"),
      });

      const normalizedPrompt = prompt.toLowerCase();
      const promptWithReview =
        mode === "new" && /\bhero\b/.test(normalizedPrompt)
          ? `${prompt}\n\nFinal review before returning HTML:\n- Review the hero for awkward empty space, off-balance composition, floating badges/media, and spacing mistakes.\n- Do not default to centered content. Choose the alignment that best suits the composition.\n- Only keep a full-viewport hero when the layout remains visually balanced; otherwise use padding-based height instead of min-h-screen or 100vh.\n- If you use viewport-height sizing, explicitly balance the layout so the content does not sit awkwardly at the top with large empty space below.`
          : prompt;

      const fullContent = await requestModelText({
        prompt: promptWithReview,
        currentHtml: currentBlock?.html,
        blockId: currentBlock?.id,
        mode,
      });

      setLoadingStatus((prev) => ({ ...prev, phase: "generating" }));

      const { summary, html } = parseResponse(fullContent);
      return { summary, html, raw: fullContent };
    },
    [requestModelText],
  );

  const editBlockWithPatchFallback = useCallback(
    async (prompt: string, currentBlock: Block) => {
      try {
        const patchContent = await requestModelText({
          prompt,
          currentHtml: currentBlock.html,
          blockId: currentBlock.id,
          mode: "patch-edit",
        });
        const patch = parseJsonObjectResponse<HtmlPatch>(patchContent);
        if (patch?.ops?.length) {
          const html = applyPatch(currentBlock.html, patch);
          const summaryLines = summarizePatch(patch);
          return {
            summary:
              summaryLines.join(" ") || "Applied a targeted section update.",
            html,
            raw: patchContent,
          };
        }
      } catch (error) {
        logger.error("Patch edit fallback", error);
      }

      return generateSection(prompt, "edit", currentBlock);
    },
    [generateSection, requestModelText],
  );

  const critiqueSection = useCallback(
    async (block: Block): Promise<SectionCritique | null> => {
      try {
        const critiqueContent = await requestModelText({
          currentHtml: block.html,
          blockId: block.id,
          sectionRole: block.label,
          mode: "critique",
        });

        return parseJsonObjectResponse<SectionCritique>(critiqueContent);
      } catch (error) {
        logger.error("Critique section", error);
        return null;
      }
    },
    [requestModelText],
  );

  const fillTemplateForSection = useCallback(
    async (section: PlannedSectionBlueprint, templateId: string) => {
      const template = getSectionTemplateById(templateId);
      if (!template) {
        throw new Error(`Unknown template: ${templateId}`);
      }

      const responseText = await requestModelText({
        prompt: `${section.title}\n${section.details || ""}`,
        mode: "fill-template",
        templateSkeleton: template.skeleton,
        sectionRole: section.title,
      });
      const values =
        parseJsonObjectResponse<Record<string, string>>(responseText);
      if (!values) {
        throw new Error(`Template fill failed for ${section.title}`);
      }

      return {
        summary: `Filled the ${template.name} template for ${section.title}.`,
        html: setRootSectionIdentifiers(
          fillTemplateSkeleton(template.skeleton, values),
          section.id,
        ),
        raw: responseText,
      };
    },
    [requestModelText],
  );

  const selectTemplatesForSections = useCallback(
    async (sections: PlannedSectionBlueprint[]) => {
      const fallbackSelections = Object.fromEntries(
        sections
          .map((section) => [
            section.title,
            pickTemplateForSection(section.title, designStyle)?.id,
          ])
          .filter((entry): entry is [string, string] => Boolean(entry[1])),
      );

      try {
        const responseText = await requestModelText({
          mode: "select-templates",
          sections: sections.map((section) => section.title),
          templateCatalog: buildTemplateCatalog(SECTION_TEMPLATES),
        });
        const parsed =
          parseJsonObjectResponse<Record<string, string>>(responseText);
        return {
          ...fallbackSelections,
          ...(parsed || {}),
        };
      } catch (error) {
        logger.error("Select templates", error);
        return fallbackSelections;
      }
    },
    [designStyle, requestModelText],
  );

  const composeSectionsFromComponents = useCallback(
    async (sections: PlannedSectionBlueprint[]): Promise<Block[] | null> => {
      try {
        const responseText = await requestModelText({
          prompt:
            projectContext ||
            sections.map((section) => section.title).join("\n"),
          mode: "compose",
          componentCatalog: buildComponentCatalog(getComponentSummaries()),
          sectionPlan: sections.map((section) => section.title),
        });
        const manifest =
          parseJsonArrayResponse<ComponentManifestItem>(responseText);
        if (!manifest || manifest.length < sections.length) {
          return null;
        }

        return manifest.slice(0, sections.length).map((item, index) => {
          const html = setRootSectionIdentifiers(
            renderComponentManifestItem(item),
            sections[index].id,
          );
          return createBlock(html, sections[index].title);
        });
      } catch (error) {
        logger.error("Compose sections", error);
        return null;
      }
    },
    [projectContext, requestModelText],
  );

  const generatePlannedSection = useCallback(
    async (
      section: PlannedSectionBlueprint,
      index: number,
      totalSections: number,
      sectionMap: string,
      templateSelections: Record<string, string>,
    ) => {
      const generationStrategy = getGenerationStrategy();
      const selectedTemplateId = templateSelections[section.title];

      if (
        generationStrategy !== "html-only" &&
        selectedTemplateId &&
        (generationStrategy === "template-first" ||
          generationStrategy === "hybrid" ||
          generationStrategy === "component-first")
      ) {
        try {
          return await fillTemplateForSection(section, selectedTemplateId);
        } catch (error) {
          logger.error("Template fill fallback", error);
        }
      }

      const result = await generateSection(
        buildSectionGenerationPrompt({
          section,
          index,
          totalSections,
          sectionMap,
          examples: getSectionExamples(section),
        }),
        "new",
      );

      return {
        ...result,
        html: setRootSectionIdentifiers(result.html, section.id),
      };
    },
    [fillTemplateForSection, generateSection, getSectionExamples],
  );

  const runGenerationValidation = useCallback(
    async (candidateBlocks: Block[]) => {
      const refinementLevel = getRefinementLevel();
      const normalizedHtml = applyGlobalValidationFixes(
        generateFullHTML(candidateBlocks),
      );
      const issues = validateGeneratedHtml(normalizedHtml);

      let nextBlocks = candidateBlocks.map((block) => ({ ...block }));
      const appliedFixes: string[] = [];

      if (refinementLevel !== "off") {
        const autoFixed = autoFixIssues(nextBlocks, issues);
        nextBlocks = autoFixed.blocks;
        appliedFixes.push(...autoFixed.applied);
      }

      if (refinementLevel === "full") {
        for (let index = 0; index < nextBlocks.length; index += 1) {
          const block = nextBlocks[index];
          const critique = await critiqueSection(block);
          if (!critique) continue;

          const scores = [
            critique.visualAppeal,
            critique.copyQuality,
            critique.conversionPotential,
            critique.mobileReadiness,
          ];
          if (
            scores.every((score) => score >= 6) ||
            !critique.suggestedPrompt
          ) {
            continue;
          }

          const refinementPrompt = [
            critique.suggestedPrompt,
            critique.issues.length > 0
              ? `Address these issues:\n- ${critique.issues.join("\n- ")}`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n");

          const refined = await generateSection(
            refinementPrompt,
            "edit",
            block,
          );
          nextBlocks[index] = { ...block, html: refined.html };
          appliedFixes.push(`Refined ${block.label} after critique.`);
        }
      }

      nextBlocks.forEach((block) => {
        const original = candidateBlocks.find(
          (candidate) => candidate.id === block.id,
        );
        if (original && original.html !== block.html) {
          onUpdateBlock(block.id, block.html);
        }
      });

      const summarySuffix =
        appliedFixes.length > 0
          ? ` Applied fixes: ${appliedFixes.slice(0, 3).join(" ")}`
          : "";

      const validationMessage: Message = {
        id: uuidv4(),
        role: "assistant",
        content: "",
        summary: `${summarizeValidationIssues(issues)}${summarySuffix}`,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, validationMessage]);
      return nextBlocks;
    },
    [
      critiqueSection,
      generateSection,
      onUpdateBlock,
      summarizeValidationIssues,
    ],
  );

  async function generateLandingPageFromDetails(resolvedStyleId?: string) {
    if (isLoading) return;
    const initialPrompt =
      setupDetails.productDescription?.trim() ||
      setupDetails.title?.trim() ||
      "Continue";

    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content: initialPrompt,
      blocksSnapshot: blocks.map((block) => ({ ...block })),
      timestamp: Date.now(),
    };

    const assistantMessageId = uuidv4();
    const assistantPlaceholder: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setIsLoading(true);
    setLoadingStatus({ phase: "planning" });
    abortControllerRef.current = new AbortController();

    try {
      const apiKey = getApiKey();
      const model = getModel();
      const style = DESIGN_STYLES.find((item) => item.id === resolvedStyleId);

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortControllerRef.current?.signal,
        body: JSON.stringify({
          mode: "detailed-plan",
          apiKey,
          model,
          planDetails: {
            brandName: setupDetails.brandName?.trim() || "Your brand",
            productDescription:
              setupDetails.productDescription?.trim() || "A product",
            designStyleLabel: style?.label || "Professional",
            heroTitle:
              setupDetails.title?.trim() ||
              "A strong value-focused hero headline",
            subtitle:
              setupDetails.subtitle?.trim() ||
              "A concise supporting message that explains the offer and why it matters.",
            ctaText: setupDetails.ctaText?.trim() || "Get Started",
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate plan");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let planContent = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        planContent += decoder.decode(value, { stream: true });
      }

      planContent = planContent
        .replace(/^```[\w]*\n?/gm, "")
        .replace(/^```$/gm, "")
        .trim();

      const planMessageId = uuidv4();
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                id: planMessageId,
                plan: planContent,
              }
            : message,
        ),
      );
      const plannedSections = extractDetailedPlanSections(planContent);
      if (plannedSections.length === 0) {
        throw new Error("Detailed plan did not contain recognizable sections.");
      }

      const buildMessageId = uuidv4();
      const buildMessage: Message = {
        id: buildMessageId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, buildMessage]);

      const results = await executeSectionPlan(
        plannedSections,
        "Building your page with parallel generation and structured fallbacks...",
      );
      const summaries = results
        .map((result, index) => `${index + 1}. ${result.summary}`)
        .join("\n");

      setMessages((prev) =>
        prev.map((message) =>
          message.id === buildMessageId
            ? {
                ...message,
                content: `Built ${results.length} sections`,
                summary: `Generated ${results.length} sections from the saved plan:\n${summaries}`,
              }
            : message,
        ),
      );
      onVersionCreated(initialPrompt);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        logger.action("Landing page generation cancelled by user");
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: "",
                  summary: "Landing page generation cancelled",
                }
              : message,
          ),
        );
      } else {
        const errorMsg =
          error instanceof Error ? error.message : "Something went wrong";
        logger.error("ChatPanel", error);
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: `Error: ${errorMsg}`,
                  summary: `Error generating landing page: ${errorMsg}`,
                }
              : message,
          ),
        );
      }
    } finally {
      setIsLoading(false);
      setLoadingStatus({ phase: "idle" });
      abortControllerRef.current = null;
    }
  }

  const handleSetupComplete = useCallback(async () => {
    const productDescription = (setupDetails.productDescription || "").trim();
    if (productDescription.length < 50) return;

    try {
      setIsAutoSelectingStyle(true);

      let resolvedStyle = designStyle;
      if (!resolvedStyle) {
        resolvedStyle = await requestStyleSelection(productDescription);
        const selectedStyle = DESIGN_STYLES.find(
          (style) => style.id === resolvedStyle,
        );
        logger.info("Design style selected", {
          styleId: resolvedStyle,
          styleLabel: selectedStyle?.label ?? resolvedStyle,
          source: "auto",
        });
        onSetDesignStyle(resolvedStyle);
      }

      onSetProjectDetails(setupDetails);
      setSetupPhase("ready");
      await generateLandingPageFromDetails(resolvedStyle);
    } catch (error) {
      logger.error("Style selection", error);
      onSetDesignStyle("professional");
      onSetProjectDetails(setupDetails);
      setSetupPhase("ready");
      await generateLandingPageFromDetails("professional");
    } finally {
      setIsAutoSelectingStyle(false);
    }
  }, [
    designStyle,
    generateLandingPageFromDetails,
    onSetDesignStyle,
    onSetProjectDetails,
    requestStyleSelection,
    setupDetails,
  ]);

  const executeSectionPlan = useCallback(
    async (sections: PlannedSection[], implementationSummary: string) => {
      const model = getModel();
      const generationStrategy = getGenerationStrategy();
      const sectionBlueprint = buildSectionBlueprint(sections);
      const sectionMap = buildSectionMap(sectionBlueprint);

      const implMsg: Message = {
        id: uuidv4(),
        role: "assistant",
        content: "",
        summary: implementationSummary,
        timestamp: Date.now(),
      };
      const trackerId = uuidv4();
      const progressStates: Array<{
        title: string;
        status: "pending" | "running" | "done";
      }> = sectionBlueprint.map((section) => ({
        title: section.title,
        status: "pending",
      }));

      setMessages((prev) => [
        ...prev,
        implMsg,
        {
          id: trackerId,
          role: "assistant",
          content: "",
          summary: `Parallel generation started.\n${formatParallelProgress(progressStates)}`,
          timestamp: Date.now(),
        },
      ]);

      const updateTracker = () => {
        const trackerSummary = `Generation in progress.\n${formatParallelProgress(progressStates)}`;
        setMessages((prev) =>
          prev.map((message) =>
            message.id === trackerId
              ? { ...message, summary: trackerSummary }
              : message,
          ),
        );
      };

      if (generationStrategy === "component-first") {
        const composedBlocks =
          await composeSectionsFromComponents(sectionBlueprint);
        if (composedBlocks) {
          const uniqueBlocks = composedBlocks.reduce<Block[]>((acc, block) => {
            const nextBlock = ensureUniqueBlockIdentity(
              block,
              [...blocks, ...acc].map((candidate) => candidate.id),
            );
            acc.push(nextBlock);
            return acc;
          }, []);

          uniqueBlocks.forEach((block) => onAddBlock(block));
          await runGenerationValidation([...blocks, ...uniqueBlocks]);
          setMessages((prev) =>
            prev.map((message) =>
              message.id === trackerId
                ? {
                    ...message,
                    summary: `Component composition complete. ${uniqueBlocks.length} sections assembled from the library.`,
                  }
                : message,
            ),
          );
          return uniqueBlocks.map((block) => ({
            summary: `Composed ${block.label} from the component library.`,
            html: block.html,
          }));
        }
      }

      const templateSelections =
        generationStrategy === "html-only"
          ? {}
          : await selectTemplatesForSections(sectionBlueprint);
      const concurrencyLimit = model === "auto:free" ? 3 : 4;
      const results: Array<{ summary: string; html: string }> = new Array(
        sectionBlueprint.length,
      );
      const insertedBlocks: Block[] = [];
      let nextInsertIndex = 0;

      await runWithConcurrency(
        sectionBlueprint,
        concurrencyLimit,
        async (section, index) => {
          progressStates[index].status = "running";
          setLoadingStatus({
            phase: "building",
            model: getModelLabel(model || "auto:free"),
            currentSection: section.title,
            sectionIndex: index + 1,
            totalSections: sectionBlueprint.length,
          });
          updateTracker();

          const result = await generatePlannedSection(
            section,
            index,
            sectionBlueprint.length,
            sectionMap,
            templateSelections,
          );
          results[index] = result;
          progressStates[index].status = "done";
          updateTracker();

          while (results[nextInsertIndex]) {
            const candidateBlock = createBlock(
              results[nextInsertIndex].html,
              sectionBlueprint[nextInsertIndex].title,
            );
            const nextBlock = ensureUniqueBlockIdentity(
              candidateBlock,
              [...blocks, ...insertedBlocks].map((block) => block.id),
            );
            insertedBlocks.push(nextBlock);
            onAddBlock(nextBlock);
            nextInsertIndex += 1;
          }
        },
      );

      await runGenerationValidation([...blocks, ...insertedBlocks]);

      setMessages((prev) =>
        prev.map((message) =>
          message.id === trackerId
            ? {
                ...message,
                summary: `Parallel generation complete.\n${formatParallelProgress(progressStates)}`,
              }
            : message,
        ),
      );

      return results.filter(
        (result): result is { summary: string; html: string } =>
          Boolean(result),
      );
    },
    [
      blocks,
      composeSectionsFromComponents,
      generatePlannedSection,
      onAddBlock,
      runGenerationValidation,
      selectTemplatesForSections,
    ],
  );

  /** Handle multi-section generation (e.g. "build a landing page") */
  const handleMultiSectionGeneration = useCallback(
    async (prompt: string) => {
      setLoadingStatus({ phase: "planning" });
      const planContent = await requestModelText({
        prompt,
        mode: "plan",
      });

      const sections = parsePlanResponse(planContent);
      logger.info("Multi-section plan", { sections });

      const planSummary = sections
        .map((section, i) => `${i + 1}. ${section}`)
        .join("\n");
      const planMsg: Message = {
        id: uuidv4(),
        role: "assistant",
        content: "",
        summary: `Planning complete — ${sections.length} sections planned:\n${planSummary}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, planMsg]);
      return executeSectionPlan(
        sections.map((section) => ({ title: section })),
        `Planning complete — building ${sections.length} sections with the active generation strategy.`,
      );
    },
    [executeSectionPlan, requestModelText],
  );

  const handleSubmit = async (
    overridePrompt?: string,
    displayPrompt?: string,
  ) => {
    const trimmed = (overridePrompt || input).trim();
    const visiblePrompt = (displayPrompt || overridePrompt || input).trim();
    if (!trimmed || !visiblePrompt || isLoading) return;

    // Retry intent detection — re-run last user prompt
    if (
      /^(try\s*again|retry|redo|re-?run)$/i.test(trimmed) &&
      !overridePrompt
    ) {
      const lastUserMsg = [...messages]
        .reverse()
        .find((m) => m.role === "user");
      if (lastUserMsg) {
        setInput("");
        handleSubmit(lastUserMsg.content);
        return;
      }
    }

    if (isExplanationIntent(trimmed)) {
      const userMessage: Message = {
        id: uuidv4(),
        role: "user",
        content: visiblePrompt,
        blocksSnapshot: blocks.map((b) => ({ ...b })),
        timestamp: Date.now(),
      };
      const explanation = buildPreviousChangeExplanation(messages);
      const assistantMessage: Message = {
        id: uuidv4(),
        role: "assistant",
        content: "",
        summary:
          explanation ||
          "There is no previous completed change to explain yet.",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setInput("");
      return;
    }

    const hasExistingBlocks = blocks.length > 0;
    const currentSelectedBlock = selectedBlockId
      ? blocks.find((b) => b.id === selectedBlockId)
      : undefined;
    const isMultiSection = !hasExistingBlocks && isMultiSectionIntent(trimmed);
    const matchedBlocks: { block: Block; score: number }[] = [];
    const isMultiEdit = false;
    const isRemoveSection = false;
    const isGlobalStyleEdit = false;
    const isAddSection = false;
    const mode: "new" | "edit" = currentSelectedBlock ? "edit" : "new";

    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content: visiblePrompt,
      blockId: currentSelectedBlock?.id || undefined,
      blocksSnapshot: blocks.map((b) => ({ ...b })),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    const assistantMessage: Message = {
      id: uuidv4(),
      role: "assistant",
      content: "",
      blockId: currentSelectedBlock?.id || undefined,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      if (hasExistingBlocks) {
        setLoadingStatus({
          phase: "requesting",
          model: getModelLabel(getModel() || "auto:free"),
        });

        const result = await requestModification({
          prompt: trimmed,
          requestKind: "auto",
          selectedBlockId,
        });
        const candidateBlocks = applyModificationOperationsToBlocks(
          blocks,
          result.operations,
        );
        applyModificationOperations(result.operations);
        if (candidateBlocks.length > 0) {
          await runGenerationValidation(candidateBlocks);
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? {
                  ...m,
                  content: buildModificationContent(blocks, result.operations),
                  summary: `Modification engine (${result.resolvedRequestKind || "auto"} / ${result.executorMode}) — ${result.summary}`,
                }
              : m,
          ),
        );
        onVersionCreated(trimmed);
        return;
      }

      if (isRemoveSection) {
        const targetBlock = currentSelectedBlock || matchedBlocks[0]?.block;
        if (!targetBlock) {
          throw new Error(
            "Select a section or mention one clearly to remove it.",
          );
        }

        const result = await requestModification({
          prompt: trimmed,
          requestKind: "remove-section",
          selectedBlockId: targetBlock.id,
          targetBlockIds: [targetBlock.id],
        });
        const candidateBlocks = applyModificationOperationsToBlocks(
          blocks,
          result.operations,
        );
        applyModificationOperations(result.operations);
        if (candidateBlocks.length > 0) {
          await runGenerationValidation(candidateBlocks);
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? {
                  ...m,
                  content: "",
                  summary: `Modification engine (${result.executorMode}) â€” ${result.summary}`,
                }
              : m,
          ),
        );
        onVersionCreated(trimmed);
        return;
      }

      if (isGlobalStyleEdit) {
        const result = await requestModification({
          prompt: trimmed,
          requestKind: "global-style-edit",
          selectedBlockId: selectedBlockId,
        });
        const candidateBlocks = applyModificationOperationsToBlocks(
          blocks,
          result.operations,
        );
        applyModificationOperations(result.operations);
        if (candidateBlocks.length > 0) {
          await runGenerationValidation(candidateBlocks);
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? {
                  ...m,
                  content: buildModificationContent(blocks, result.operations),
                  summary: `Modification engine (${result.executorMode}) â€” ${result.summary}`,
                }
              : m,
          ),
        );
        onVersionCreated(trimmed);
        return;
      }

      if (mode === "edit" && currentSelectedBlock) {
        const result = await requestModification({
          prompt: trimmed,
          requestKind: "section-edit",
          selectedBlockId: currentSelectedBlock.id,
        });
        const candidateBlocks = applyModificationOperationsToBlocks(
          blocks,
          result.operations,
        );
        applyModificationOperations(result.operations);
        if (candidateBlocks.length > 0) {
          await runGenerationValidation(candidateBlocks);
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? {
                  ...m,
                  content: buildModificationContent(blocks, result.operations),
                  summary: `Modification engine (${result.executorMode}) â€” ${result.summary}`,
                }
              : m,
          ),
        );
        onVersionCreated(trimmed);
        return;
      }

      if (isAddSection) {
        const result = await requestModification({
          prompt: trimmed,
          requestKind: "add-section",
          selectedBlockId: selectedBlockId,
        });
        const candidateBlocks = applyModificationOperationsToBlocks(
          blocks,
          result.operations,
        );
        applyModificationOperations(result.operations);
        if (candidateBlocks.length > 0) {
          await runGenerationValidation(candidateBlocks);
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? {
                  ...m,
                  content: buildModificationContent(blocks, result.operations),
                  summary: `Modification engine (${result.executorMode}) â€” ${result.summary}`,
                }
              : m,
          ),
        );
        onVersionCreated(trimmed);
        return;
      }

      if (isMultiEdit) {
        // Multi-section edit — edit all matched blocks
        const editBlocks = matchedBlocks.map((m) => m.block);
        const sectionNames = editBlocks
          .map((b) => b.label || "section")
          .join(", ");
        logger.action("Multi-section edit", {
          sections: sectionNames,
          count: editBlocks.length,
        });

        // Notify user which sections we're editing
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? {
                  ...m,
                  summary: `✏️ Editing ${editBlocks.length} sections: ${sectionNames}`,
                }
              : m,
          ),
        );

        const results: string[] = [];
        const updatedBlockHtml = new Map<string, string>();
        for (let i = 0; i < editBlocks.length; i++) {
          const block = editBlocks[i];
          setLoadingStatus({
            phase: "building",
            model: getModelLabel(getModel() || "auto:free"),
            currentSection: block.label || "section",
            sectionIndex: i + 1,
            totalSections: editBlocks.length,
          });

          // Give the AI context about the multi-edit
          const multiEditContext = `This is a multi-section edit. The user wants to change ${editBlocks.length} sections together. You are editing the "${block.label}" section (${i + 1} of ${editBlocks.length}). Other sections being edited: ${editBlocks
            .filter((b) => b.id !== block.id)
            .map((b) => b.label)
            .join(", ")}. Apply only the changes relevant to THIS section.`;

          const result = await editBlockWithPatchFallback(
            `${multiEditContext}\n\nUser request: ${trimmed}`,
            block,
          );

          const diff = buildUnifiedDiff(block.html, result.html);
          onUpdateBlock(block.id, result.html);
          updatedBlockHtml.set(block.id, result.html);
          results.push(`${block.label}: ${result.summary}`);

          // Per-section progress message
          const progressMsg: Message = {
            id: uuidv4(),
            role: "assistant",
            content: diff,
            summary: `✅ Updated ${block.label} (${i + 1}/${editBlocks.length}): ${result.summary}`,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, progressMsg]);
        }

        await runGenerationValidation(
          blocks.map((block) =>
            updatedBlockHtml.has(block.id)
              ? { ...block, html: updatedBlockHtml.get(block.id)! }
              : block,
          ),
        );

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? {
                  ...m,
                  content: `Edited ${editBlocks.length} sections`,
                  summary: `✅ Multi-edit complete — updated ${editBlocks.length} sections:\n${results.map((r, i) => `${i + 1}. ${r}`).join("\n")}`,
                }
              : m,
          ),
        );
        onVersionCreated(trimmed);
      } else if (isMultiSection) {
        // Multi-section generation
        const results = await handleMultiSectionGeneration(trimmed);
        const summaries = results
          .map((r, i) => `${i + 1}. ${r.summary}`)
          .join("\n");

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? {
                  ...m,
                  content: `Built ${results.length} sections`,
                  summary: `Generated ${results.length} sections:\n${summaries}`,
                }
              : m,
          ),
        );
        onVersionCreated(trimmed);
      } else {
        // Single section generation/edit
        setLoadingStatus({
          phase: "requesting",
          model: getModelLabel(getModel() || "auto:free"),
        });

        // Build cross-section context so the AI knows about other sections on the page
        let editPrompt = trimmed;
        if (mode === "edit" && blocks.length > 1) {
          const sectionMap = blocks
            .filter((b) => b.id !== currentSelectedBlock?.id)
            .map((b) => {
              const sid = b.html?.match(/id="([^"]+)"/)?.[1] || "";
              return `- "${b.label}"${sid ? ` (id="${sid}")` : ""}`;
            })
            .join("\n");
          editPrompt = `${trimmed}\n\n[Page context — other sections on this page:\n${sectionMap}\nUse these section IDs for any anchor links or scroll references.]`;
        }

        const result =
          mode === "edit" && currentSelectedBlock
            ? await editBlockWithPatchFallback(editPrompt, currentSelectedBlock)
            : await generateSection(editPrompt, mode, currentSelectedBlock);

        const normalizedResult =
          mode === "edit" && currentSelectedBlock
            ? {
                ...result,
                html: setRootSectionIdentifiers(
                  result.html,
                  currentSelectedBlock.id,
                ),
              }
            : result;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? {
                  ...m,
                  content:
                    mode === "edit" && currentSelectedBlock
                      ? buildUnifiedDiff(
                          currentSelectedBlock.html,
                          normalizedResult.html,
                        )
                      : normalizedResult.raw,
                  summary: normalizedResult.summary,
                }
              : m,
          ),
        );

        if (mode === "edit" && currentSelectedBlock) {
          onUpdateBlock(currentSelectedBlock.id, normalizedResult.html);
          await runGenerationValidation(
            blocks.map((block) =>
              block.id === currentSelectedBlock.id
                ? { ...block, html: normalizedResult.html }
                : block,
            ),
          );
        } else {
          const newBlock = ensureUniqueBlockIdentity(
            createBlock(normalizedResult.html),
            blocks.map((block) => block.id),
          );
          onAddBlock(newBlock);
          await runGenerationValidation([...blocks, newBlock]);
        }
        onVersionCreated(trimmed);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        logger.action("Request cancelled by user");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? { ...m, content: "", summary: "Request cancelled" }
              : m,
          ),
        );
      } else {
        const errorMsg =
          error instanceof Error ? error.message : "Something went wrong";
        logger.error("ChatPanel", error);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? {
                  ...m,
                  content: `Error: ${errorMsg}`,
                  summary: `Error: ${errorMsg}`,
                }
              : m,
          ),
        );
      }
    } finally {
      setIsLoading(false);
      setLoadingStatus({ phase: "idle" });
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey || !e.shiftKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSelectBlock = (blockId: string) => {
    onSelectBlock(blockId);
    setShowSelectDropdown(false);
  };

  const renderLoadingStatus = () => {
    switch (loadingStatus.phase) {
      case "requesting":
        return (
          <div className="result-status streaming">
            <Loader2 size={14} className="spin" />
            <span>
              <Link2 size={12} className="inline-icon" /> Connecting to{" "}
              {loadingStatus.model} — preparing your prompt…
            </span>
          </div>
        );
      case "generating":
        return (
          <div className="result-status streaming">
            <Loader2 size={14} className="spin" />
            <span>
              <Zap size={12} className="inline-icon" /> {loadingStatus.model} is
              generating your section…
            </span>
          </div>
        );
      case "planning":
        return (
          <div className="result-status streaming">
            <Loader2 size={14} className="spin" />
            <span>
              <ClipboardList size={12} className="inline-icon" /> Analyzing your
              request — planning page sections…
            </span>
          </div>
        );
      case "building":
        return (
          <div className="result-status streaming">
            <Loader2 size={14} className="spin" />
            <span>
              <Hammer size={12} className="inline-icon" /> Building section{" "}
              {loadingStatus.sectionIndex}/{loadingStatus.totalSections}:{" "}
              {loadingStatus.currentSection}…
            </span>
          </div>
        );
      default:
        // When loading but no specific phase yet, show preparing message
        if (isLoading) {
          return (
            <div className="result-status streaming">
              <Loader2 size={14} className="spin" />
              <span>Analyzing your request and selecting the best model…</span>
            </div>
          );
        }
        return null;
    }
  };

  // === SETUP SCREENS ===

  if (setupPhase === "details" && blocks.length === 0) {
    const productDescriptionLength = (
      setupDetails.productDescription || ""
    ).trim().length;
    const canContinue = productDescriptionLength >= 50;
    return (
      <div className={`chat-panel ${isFullScreen ? "full-screen" : ""}`}>
        <div className="chat-messages">
          <div className="chat-empty setup-form">
            <div className="setup-progress" aria-label="Builder setup progress">
              <span className="setup-progress-step active">1. Details</span>
            </div>
            <h3>Project Details</h3>
            <p>
              Provide the essentials so Crushable can plan stronger sections and
              keep the first draft aligned with your product.
            </p>
            <div className="setup-fields">
              <div className="setup-field">
                <label>
                  Brand / Company Name{" "}
                  <span className="optional-tag">optional</span>
                </label>
                <input
                  value={setupDetails.brandName || ""}
                  onChange={(e) =>
                    setSetupDetails((prev) => ({
                      ...prev,
                      brandName: e.target.value,
                    }))
                  }
                  placeholder="e.g. Acme Inc."
                />
              </div>

              <div className="setup-field">
                <label>
                  Hero Title <span className="optional-tag">optional</span>
                </label>
                <input
                  value={setupDetails.title || ""}
                  onChange={(e) =>
                    setSetupDetails((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  placeholder="e.g. Build Faster, Ship Smarter"
                />
              </div>
              <div className="setup-field">
                <label>
                  Subtitle / Description{" "}
                  <span className="optional-tag">optional</span>
                </label>
                <input
                  value={setupDetails.subtitle || ""}
                  onChange={(e) =>
                    setSetupDetails((prev) => ({
                      ...prev,
                      subtitle: e.target.value,
                    }))
                  }
                  placeholder="e.g. The AI-powered platform for..."
                />
              </div>
              <div className="setup-field">
                <label>
                  Primary CTA Button{" "}
                  <span className="optional-tag">optional</span>
                </label>
                <input
                  value={setupDetails.ctaText || ""}
                  onChange={(e) =>
                    setSetupDetails((prev) => ({
                      ...prev,
                      ctaText: e.target.value,
                    }))
                  }
                  placeholder="e.g. Get Started Free"
                />
              </div>
              <div className="setup-field">
                <label>Write few lines about your product</label>
                <textarea
                  value={setupDetails.productDescription || ""}
                  onChange={(e) => {
                    setTriedToProceed(false);
                    setSetupDetails((prev) => ({
                      ...prev,
                      productDescription: e.target.value,
                    }));
                  }}
                  placeholder="Describe what your product does, who it is for, and why it matters."
                  rows={4}
                />
                <span
                  className={`setup-field-hint ${canContinue ? "valid" : "invalid"} ${triedToProceed && !canContinue ? "tried" : ""}`}
                >
                  {canContinue
                    ? "Looks good. You can continue."
                    : `Write at least 50 characters to proceed (${productDescriptionLength}/50).`}
                </span>
              </div>
            </div>
            <div className="setup-completion-meter" aria-hidden="true">
              <span
                style={{
                  width: `${Math.min(100, (productDescriptionLength / 50) * 100)}%`,
                }}
              />
            </div>
            <div className="setup-actions">
              <button
                onClick={() => {
                  if (!canContinue) {
                    setTriedToProceed(true);
                    return;
                  }
                  handleSetupComplete();
                }}
                className="setup-continue-btn"
                disabled={!canContinue || isAutoSelectingStyle}
              >
                {isAutoSelectingStyle ? "Choosing style..." : "Continue"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // === MAIN CHAT VIEW ===
  return (
    <div className={`chat-panel ${isFullScreen ? "full-screen" : ""}`}>
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <h3>Welcome to Crushable</h3>
            <p>
              Describe what you want to build and Crushable will stream sections
              into the live preview as you go.
            </p>
            {designStyle && (
              <div className="design-style-badge">
                {selectedStyle?.label} style
              </div>
            )}
          </div>
        )}

        {messages.map((message, messageIndex) => {
          const isExpanded = expandedMessages.has(message.id);
          const isCurrentlyStreaming =
            isLoading && messages[messages.length - 1]?.id === message.id;
          const hasDiff = looksLikeDiff(message.content);
          const shouldHideAssistantMessage =
            message.role === "assistant" &&
            (Boolean(message.plan) ||
              (!isCurrentlyStreaming && !message.content && !message.summary));

          if (shouldHideAssistantMessage) {
            return null;
          }

          return (
            <div key={message.id} className={`chat-message ${message.role}`}>
              <div className="message-content">
                {message.role === "user" ? (
                  <>
                    {message.blockId && (
                      <span className="message-block-tag">
                        <Pencil size={10} />{" "}
                        {blocks.find((b) => b.id === message.blockId)?.label ||
                          message.blockId}
                      </span>
                    )}
                    <p>{message.content}</p>
                    {shouldShowRestoreButton(
                      message,
                      isLoading,
                      messages,
                      messageIndex,
                    ) && (
                      <button
                        className="checkpoint-restore-btn"
                        title="Restore to this checkpoint"
                        onClick={() => {
                          if (message.blocksSnapshot) {
                            onRestoreBlocks(message.blocksSnapshot);
                            const restoreMsg: Message = {
                              id: uuidv4(),
                              role: "assistant",
                              content: "",
                              summary: `Restored to checkpoint: "${message.content.slice(0, 50)}${message.content.length > 50 ? "…" : ""}"`,
                              timestamp: Date.now(),
                            };
                            setMessages((prev) => [...prev, restoreMsg]);
                          }
                        }}
                      >
                        <RotateCcw size={12} />
                        Restore
                      </button>
                    )}
                    {formatMessageTime(message.timestamp) && (
                      <div className="message-time">
                        {formatMessageTime(message.timestamp)}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="assistant-response">
                    {message.plan ? (
                      <>
                        {/* <div className="assistant-plan-header">
                          <div className="assistant-plan-heading">
                            <span className="assistant-plan-label">
                              Landing Page Plan
                            </span>
                            <span className="assistant-plan-summary">
                              {message.summary ||
                                "Detailed landing page plan ready"}
                            </span>
                          </div>
                        </div>

                        {editingPlanId === message.id ? (
                          <textarea
                            value={planDraft}
                            onChange={(e) => setPlanDraft(e.target.value)}
                            className="assistant-plan-editor"
                            rows={18}
                          />
                        ) : (
                          <pre className="assistant-plan-text">
                            {message.plan}
                          </pre>
                        )}

                        {editingPlanId === message.id ? (
                          <div className="assistant-plan-actions">
                            <button
                              onClick={handlePlanEditCancel}
                              className="assistant-plan-btn secondary"
                            >
                              <X size={14} />
                              Cancel
                            </button>
                            <button
                              onClick={() => handlePlanEditSave(message.id)}
                              className="assistant-plan-btn"
                            >
                              <Save size={14} />
                              Save
                            </button>
                          </div>
                        ) : usedPlanIds.has(message.id) ? (
                          <div className="assistant-plan-actions">
                            <span className="result-status done" style={{ fontSize: 12 }}>
                              <CheckCircle2 size={12} /> Plan executed
                            </span>
                          </div>
                        ) : (
                          <div className="assistant-plan-actions">
                            <button
                              onClick={() => handlePlanEditStart(message)}
                              className="assistant-plan-btn"
                            >
                              <Pencil size={14} />
                              Edit
                            </button>
                          </div>
                        )} */}
                      </>
                    ) : message.content ? (
                      <div className="assistant-result">
                        <div className="result-summary">
                          {isCurrentlyStreaming ? (
                            renderLoadingStatus() || (
                              <div className="result-status streaming">
                                <Loader2 size={14} className="spin" />
                                <span>
                                  Generating... ({message.content.length} chars)
                                </span>
                              </div>
                            )
                          ) : (
                            <div className="result-status done">
                              <CheckCircle2 size={14} className="done-icon" />
                              <span style={{ whiteSpace: "pre-line" }}>
                                {message.summary || "Generated section"}
                              </span>
                            </div>
                          )}
                        </div>

                        {!isCurrentlyStreaming &&
                          message.content.length > 20 && (
                            <button
                              onClick={() => toggleMessageExpanded(message.id)}
                              className="code-toggle-btn"
                            >
                              {isExpanded ? (
                                <ChevronDown size={14} />
                              ) : (
                                <ChevronRight size={14} />
                              )}
                              <Code size={14} />
                              <span>
                                {hasDiff
                                  ? "View code diff"
                                  : `${message.content.length} chars generated`}
                              </span>
                            </button>
                          )}

                        {isExpanded &&
                          !isCurrentlyStreaming &&
                          (hasDiff ? (
                            <div className="diff-preview">
                              {message.content
                                .split("\n")
                                .map((line, index) => {
                                  const diffClass =
                                    line.startsWith("---") ||
                                    line.startsWith("+++")
                                      ? "meta"
                                      : line.startsWith("+")
                                        ? "add"
                                        : line.startsWith("-")
                                          ? "remove"
                                          : "context";
                                  return (
                                    <div
                                      key={`${message.id}-${index}`}
                                      className={`diff-line ${diffClass}`}
                                    >
                                      {line}
                                    </div>
                                  );
                                })}
                            </div>
                          ) : (
                            <pre className="code-preview">
                              <code>{message.content}</code>
                            </pre>
                          ))}
                      </div>
                    ) : message.summary ? (
                      <div className="result-status done">
                        <span style={{ whiteSpace: "pre-line" }}>
                          {message.summary}
                        </span>
                      </div>
                    ) : isCurrentlyStreaming ? (
                      <div className="typing-indicator">
                        {renderLoadingStatus() || (
                          <div className="result-status streaming">
                            <Loader2 size={14} className="spin" />
                            <span>
                              Reading your prompt and setting up the generation
                              pipeline…
                            </span>
                          </div>
                        )}
                      </div>
                    ) : null}
                    {formatMessageTime(message.timestamp) && (
                      <div className="message-time">
                        {formatMessageTime(message.timestamp)}
                      </div>
                    )}
                  </div>
                )}
                {/* Try Again button for error messages */}
                {message.role === "assistant" &&
                  message.content.startsWith("Error:") &&
                  !isLoading && (
                    <button
                      onClick={() => {
                        const lastUserMsg = [...messages]
                          .reverse()
                          .find((m) => m.role === "user");
                        if (lastUserMsg) handleSubmit(lastUserMsg.content);
                      }}
                      className="retry-btn"
                    >
                      <RefreshCw size={14} />
                      Try Again
                    </button>
                  )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        {selectedBlock && (
          <div className="selected-section-hint">
            <Pencil size={14} />
            Editing <strong>{selectedBlock.label}</strong>. Your next prompt
            will only change this section until you clear the target.
          </div>
        )}
        <div className="input-row">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              selectedBlock
                ? `Describe changes to "${selectedBlock.label}"...`
                : "Describe a section to create..."
            }
            rows={2}
            disabled={isLoading}
          />
          {isUsingFreeModel && (
            <>
              <p className="model-warning-inline">
                you are using free models which can be slow unexpectedly. please
                be patient
              </p>
              <div className="input-actions">
                <button
                  onClick={onOpenSettings}
                  className="model-badge-btn"
                  title="Model"
                >
                  <Cpu size={12} />
                  Model
                </button>

                <div className="select-block-wrapper" ref={selectDropdownRef}>
                  <button
                    onClick={() => setShowSelectDropdown(!showSelectDropdown)}
                    className={`select-block-btn ${selectedBlockId ? "has-selection" : ""}`}
                    title="Select block to edit"
                    disabled={blocks.length === 0}
                  >
                    {selectedBlock ? (
                      <span className="selected-label">
                        {selectedBlock.label}
                      </span>
                    ) : (
                      <span>Select Section</span>
                    )}
                    <ChevronDown size={14} />
                  </button>
                  {showSelectDropdown && (
                    <div className="select-dropdown">
                      <button
                        onClick={() => {
                          onClearSelection();
                          setShowSelectDropdown(false);
                        }}
                        className={`select-dropdown-item ${!selectedBlockId ? "active" : ""}`}
                      >
                        <Plus size={14} /> New Section (no selection)
                      </button>
                      {blocks.map((block) => (
                        <button
                          key={block.id}
                          onClick={() => handleSelectBlock(block.id)}
                          className={`select-dropdown-item ${selectedBlockId === block.id ? "active" : ""}`}
                        >
                          <Pencil size={12} /> {block.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (isLoading && abortControllerRef.current) {
                      abortControllerRef.current.abort();
                    } else {
                      handleSubmit();
                    }
                  }}
                  disabled={!isLoading && !input.trim()}
                  className={`send-button ${isLoading ? "cancel" : ""}`}
                  title={isLoading ? "Cancel request" : "Send"}
                >
                  {isLoading ? <Square size={16} /> : <Send size={18} />}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
