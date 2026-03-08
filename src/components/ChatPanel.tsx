"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Block, Message, DESIGN_STYLES } from "@/types";
import { createBlock } from "@/lib/blocks";
import { getApiKey, getModel } from "@/lib/storage";
import { parseResponse, parsePlanResponse } from "@/lib/prompt";
import {
  Send,
  Loader2,
  Sparkles,
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
  Save,
  X,
  Plus,
  Layout,
  Grid3x3,
  DollarSign,
  Cpu,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@/lib/logger";

interface ChatPanelProps {
  blocks: Block[];
  selectedBlockId: string | null;
  designStyle: string | undefined;
  isFullScreen: boolean;
  resetKey: number;
  onAddBlock: (block: Block) => void;
  onUpdateBlock: (id: string, html: string) => void;
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

function isEditIntent(prompt: string, hasBlocks: boolean): boolean {
  if (!hasBlocks) return false;
  if (isExplanationIntent(prompt)) return false;
  const editPatterns = [
    /\b(change|modify|update|edit|fix|replace|move|remove|delete|hide|show)\b/i,
    /\b(add|put|insert)\b.*\b(link|button|text|image|icon|color|padding|margin|border|shadow|font|size|style)\b/i,
    /\b(make|set)\b.*\b(it|this|the|that)\b/i,
    /\b(bigger|smaller|larger|wider|taller|shorter|darker|lighter|bolder|thinner)\b/i,
    /\b(align|center|left|right)\b/i,
    /\bto\s+(the\s+)?(button|heading|title|text|image|section|nav|header|footer)\b/i,
    /\bcolor\b.*\bto\b/i,
    /\bfont\b/i,
    /\bbackground\b/i,
    /\bgradient\b/i,
    /\bspacing\b/i,
  ];
  const newPatterns = [
    /\b(create|build|generate|design)\b.*\b(new\s+)?(section|component|block|page|landing)\b/i,
    /\bnew\s+(hero|feature|pricing|contact|footer|header|testimonial|faq|cta)\b/i,
  ];
  for (const pattern of newPatterns) {
    if (pattern.test(prompt)) return false;
  }
  for (const pattern of editPatterns) {
    if (pattern.test(prompt)) return true;
  }
  return false;
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
    message.content === "User clicked on Generate Landing Page"
  ) {
    return false;
  }

  // Only show restore if the next assistant message has a code diff
  const nextMessage = messages[messageIndex + 1];
  if (!nextMessage || nextMessage.role !== "assistant") return false;

  return looksLikeDiff(nextMessage.content);
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
          message.content !== "Proceed with landing page plan" &&
          message.content !== "User clicked on Generate Landing Page" &&
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

export default function ChatPanel({
  blocks,
  selectedBlockId,
  designStyle,
  isFullScreen,
  resetKey,
  onAddBlock,
  onUpdateBlock,
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
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planDraft, setPlanDraft] = useState("");
  const [usedPlanIds, setUsedPlanIds] = useState<Set<string>>(new Set());
  const [setupPhase, setSetupPhase] = useState<"design" | "details" | "ready">(
    designStyle ? "ready" : "design",
  );
  const [setupDetails, setSetupDetails] = useState<ProjectDetails>({});
  const [triedToProceed, setTriedToProceed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastPersistedMessageIdsRef = useRef("");
  const lastPersistedMessageSignatureRef = useRef("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const selectDropdownRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId);

  useEffect(() => {
    setMessages(initialMessages || []);
    setExpandedMessages(new Set());
    setEditingPlanId(null);
    setPlanDraft("");
    lastPersistedMessageIdsRef.current = "";
    lastPersistedMessageSignatureRef.current = "";
    setSetupPhase(designStyle ? "ready" : "design");
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

  const toggleMessageExpanded = (messageId: string) => {
    setExpandedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };

  const handleDesignStyleSelect = (styleId: string) => {
    onSetDesignStyle(styleId);
    setSetupPhase("details");
  };

  const handleSetupComplete = () => {
    if ((setupDetails.productDescription || "").trim().length < 50) return;
    onSetProjectDetails(setupDetails);
    setSetupPhase("ready");
  };

  /** Generate a single section via API */
  const generateSection = useCallback(
    async (
      prompt: string,
      mode: "new" | "edit",
      currentBlock?: Block,
    ): Promise<{ summary: string; html: string; raw: string }> => {
      const apiKey = getApiKey();
      const model = getModel();

      setLoadingStatus({
        phase: "requesting",
        model: getModelLabel(model || "auto:free"),
      });

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortControllerRef.current?.signal,
        body: JSON.stringify({
          prompt,
          currentHtml: currentBlock?.html,
          blockId: currentBlock?.id,
          mode,
          apiKey,
          model,
          designStylePrompt,
          projectContext,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate");
      }

      setLoadingStatus((prev) => ({ ...prev, phase: "generating" }));

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullContent += decoder.decode(value, { stream: true });
      }

      const { summary, html } = parseResponse(fullContent);
      return { summary, html, raw: fullContent };
    },
    [designStylePrompt, projectContext],
  );

  const executeSectionPlan = useCallback(
    async (sections: PlannedSection[], implementationSummary: string) => {
      const model = getModel();
      const sectionBlueprint = sections.map((section, index) => ({
        ...section,
        id: buildSectionId(section.title, index),
      }));
      const anchorTargets = sectionBlueprint.filter(
        (section) => section.id !== "home",
      );
      const sectionMap = anchorTargets
        .map((section) => `- ${section.title} -> #${section.id}`)
        .join("\n");

      const implMsg: Message = {
        id: uuidv4(),
        role: "assistant",
        content: "",
        summary: implementationSummary,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, implMsg]);

      const results: { summary: string; html: string }[] = [];
      for (let i = 0; i < sectionBlueprint.length; i++) {
        const section = sectionBlueprint[i];
        const isNavbarSection = section.id === "home";
        const sectionProgressMessageId = uuidv4();

        const sectionProgressMsg: Message = {
          id: sectionProgressMessageId,
          role: "assistant",
          content: "",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, sectionProgressMsg]);

        setLoadingStatus({
          phase: "building",
          model: getModelLabel(model || "auto:free"),
          currentSection: section.title,
          sectionIndex: i + 1,
          totalSections: sectionBlueprint.length,
        });

        const sectionPrompt = [
          `Create a ${section.title} section for a landing page. This is section ${i + 1} of ${sectionBlueprint.length}.`,
          `Use id="${section.id}" on the root <section>.`,
          sectionMap ? `Page section map:\n${sectionMap}` : "",
          isNavbarSection
            ? "If this is the navbar, include anchor links ONLY for the sections listed in the page section map. Do not invent links to sections that are not being generated."
            : "Make sure this section matches its assigned role in the page section map so navbar links stay valid.",
          section.details ? `Requirements: ${section.details}` : "",
        ]
          .filter(Boolean)
          .join("\n\n");

        const result = await generateSection(sectionPrompt, "new");

        const newBlock = createBlock(result.html);
        onAddBlock(newBlock);
        results.push(result);

        setMessages((prev) =>
          prev.map((message) =>
            message.id === sectionProgressMessageId
              ? {
                ...message,
                summary: `Section ${i + 1}/${sections.length} done: ${result.summary}`,
              }
              : message,
          ),
        );

        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      return results;
    },
    [generateSection, onAddBlock],
  );

  /** Handle multi-section generation (e.g. "build a landing page") */
  const handleMultiSectionGeneration = useCallback(
    async (prompt: string) => {
      setLoadingStatus({ phase: "planning" });

      // Step 1: Plan the sections
      const apiKey = getApiKey();
      const model = getModel();
      const planResponse = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortControllerRef.current?.signal,
        body: JSON.stringify({
          prompt,
          mode: "plan",
          apiKey,
          model,
          designStylePrompt,
          projectContext,
        }),
      });

      if (!planResponse.ok) {
        const error = await planResponse.json();
        throw new Error(error.error || "Failed to plan page");
      }

      const planReader = planResponse.body?.getReader();
      if (!planReader) throw new Error("No plan response");
      const planDecoder = new TextDecoder();
      let planContent = "";
      while (true) {
        const { done, value } = await planReader.read();
        if (done) break;
        planContent += planDecoder.decode(value, { stream: true });
      }

      const sections = parsePlanResponse(planContent);
      logger.info("Multi-section plan", { sections });
      const sectionBlueprint = sections.map((section, index) => ({
        title: section,
        id: buildSectionId(section, index),
      }));
      const sectionMap = sectionBlueprint
        .filter((section) => section.id !== "home")
        .map((section) => `- ${section.title} -> #${section.id}`)
        .join("\n");

      // Message 1: Plan completed — show what was planned
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

      // Small pause so user can read the plan
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Message 2: Starting implementation
      const implMsg: Message = {
        id: uuidv4(),
        role: "assistant",
        content: "",
        summary: `🚀 **Now implementing!** Building all ${sections.length} sections one by one…`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, implMsg]);

      // Step 2: Build each section one by one
      const results: { summary: string; html: string }[] = [];
      for (let i = 0; i < sections.length; i++) {
        const section = sectionBlueprint[i];
        const isNavbarSection = section.id === "home";
        const sectionProgressMessageId = uuidv4();

        const sectionProgressMsg: Message = {
          id: sectionProgressMessageId,
          role: "assistant",
          content: "",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, sectionProgressMsg]);

        setLoadingStatus({
          phase: "building",
          model: getModelLabel(model || "auto:free"),
          currentSection: section.title,
          sectionIndex: i + 1,
          totalSections: sections.length,
        });

        const result = await generateSection(
          [
            `Create a ${section.title} section for a landing page. This is section ${i + 1} of ${sections.length}.`,
            `Use id="${section.id}" on the root <section>.`,
            sectionMap ? `Page section map:\n${sectionMap}` : "",
            isNavbarSection
              ? "If this is the navbar, include anchor links ONLY for the sections listed in the page section map. Do not invent links to sections that are not being generated."
              : "Make sure this section matches its assigned role in the page section map so navbar links stay valid.",
          ]
            .filter(Boolean)
            .join("\n\n"),
          "new",
        );

        const newBlock = createBlock(result.html);
        onAddBlock(newBlock);
        results.push(result);

        setMessages((prev) =>
          prev.map((message) =>
            message.id === sectionProgressMessageId
              ? {
                ...message,
                summary: `Section ${i + 1}/${sections.length} done: ${result.summary}`,
              }
              : message,
          ),
        );

        // Small delay between sections
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      return results;
    },
    [designStylePrompt, projectContext, generateSection, onAddBlock],
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

    // Intent detection
    let effectiveBlockId = selectedBlockId;
    if (!selectedBlockId && blocks.length > 0 && isEditIntent(trimmed, true)) {
      const lastBlock = blocks[blocks.length - 1];
      logger.action("Intent detection: auto-selecting last block", {
        autoSelectedBlock: lastBlock.label,
      });
      effectiveBlockId = lastBlock.id;
      onSelectBlock(lastBlock.id);
    }

    // Smart block matching: find ALL blocks referenced in the prompt
    // Uses fuzzy bidirectional matching (prompt word matches label word or vice versa)
    const matchedBlocks: { block: Block; score: number }[] = [];
    if (blocks.length > 1) {
      const words = trimmed
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length >= 3);

      for (const block of blocks) {
        const label = (block.label || "").toLowerCase();
        const labelWords = label.split(/[\s\-_]+/).filter((w) => w.length >= 3);
        const blockIdMatch =
          block.html?.match(/data-block-id="([^"]+)"/)?.[1]?.toLowerCase() ||
          "";
        const blockIdWords = blockIdMatch
          .split(/[\s\-_]+/)
          .filter((w) => w.length >= 3);
        const sectionId =
          block.html?.match(/id="([^"]+)"/)?.[1]?.toLowerCase() || "";
        const sectionIdWords = sectionId
          .split(/[\s\-_]+/)
          .filter((w) => w.length >= 3);

        let score = 0;
        for (const word of words) {
          // Direct substring: "pricing" in "pricing table"
          if (label.includes(word)) score += 3;
          if (blockIdMatch.includes(word)) score += 3;
          if (sectionId.includes(word)) score += 3;

          // Bidirectional partial: "nav" in "navbar" OR "navbar" starts with "nav"
          for (const lw of labelWords) {
            if (lw.includes(word) || word.includes(lw)) score += 2;
          }
          for (const bw of blockIdWords) {
            if (bw.includes(word) || word.includes(bw)) score += 2;
          }
          for (const sw of sectionIdWords) {
            if (sw.includes(word) || word.includes(sw)) score += 2;
          }
        }

        if (score > 0) {
          matchedBlocks.push({ block, score });
        }
      }

      matchedBlocks.sort((a, b) => b.score - a.score);
    }

    // Multi-section edit: if 2+ sections are referenced AND user isn't explicitly targeting one section
    const isMultiEdit =
      !selectedBlockId &&
      matchedBlocks.length >= 2 &&
      isEditIntent(trimmed, true);

    // Single block redirect (only if not multi-edit)
    if (!isMultiEdit && matchedBlocks.length > 0) {
      const best = matchedBlocks[0];
      if (best.block.id !== effectiveBlockId) {
        logger.action("Smart block redirect", {
          from: effectiveBlockId,
          to: best.block.id,
          label: best.block.label,
          score: best.score,
        });
        effectiveBlockId = best.block.id;
        onSelectBlock(best.block.id);
      }
    }

    const currentSelectedBlock = effectiveBlockId
      ? blocks.find((b) => b.id === effectiveBlockId)
      : undefined;
    const mode = currentSelectedBlock ? "edit" : "new";
    const isMultiSection =
      !currentSelectedBlock && !isMultiEdit && isMultiSectionIntent(trimmed);

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

          const result = await generateSection(
            `${multiEditContext}\n\nUser request: ${trimmed}`,
            "edit",
            block,
          );

          const diff = buildUnifiedDiff(block.html, result.html);
          onUpdateBlock(block.id, result.html);
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

          await new Promise((resolve) => setTimeout(resolve, 300));
        }

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

        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortControllerRef.current?.signal,
          body: JSON.stringify({
            prompt: editPrompt,
            currentHtml: currentSelectedBlock?.html,
            blockId: currentSelectedBlock?.id,
            mode,
            apiKey: getApiKey(),
            model: getModel(),
            designStylePrompt,
            projectContext,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to generate");
        }

        setLoadingStatus((prev) => ({ ...prev, phase: "generating" }));

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessage.id ? { ...m, content: fullContent } : m,
            ),
          );
        }

        const { summary, html: htmlContent } = parseResponse(fullContent);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? {
                ...m,
                content:
                  mode === "edit" && currentSelectedBlock
                    ? buildUnifiedDiff(currentSelectedBlock.html, htmlContent)
                    : fullContent,
                summary,
              }
              : m,
          ),
        );

        if (mode === "edit" && currentSelectedBlock) {
          onUpdateBlock(currentSelectedBlock.id, htmlContent);
        } else {
          const newBlock = createBlock(htmlContent);
          onAddBlock(newBlock);
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

  const handleGenerateLandingPageClick = async () => {
    if (isLoading) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content: "User clicked on Generate Landing Page",
      blocksSnapshot: blocks.map((block) => ({ ...block })),
      timestamp: Date.now(),
    };

    // Add a placeholder assistant message so the loading spinner appears immediately
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
      const style = DESIGN_STYLES.find((item) => item.id === designStyle);

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
            productDescription: setupDetails.productDescription?.trim() || "A product",
            designStyleLabel: style?.label || "Professional",
            heroTitle: setupDetails.title?.trim() || "A strong value-focused hero headline",
            subtitle: setupDetails.subtitle?.trim() || "A concise supporting message that explains the offer and why it matters.",
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

      // Strip any markdown code fences the LLM might have added
      planContent = planContent.replace(/^```[\w]*\n?/gm, "").replace(/^```$/gm, "").trim();

      // Replace the placeholder with the finished plan message
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? { ...m, summary: "Detailed landing page plan ready", plan: planContent }
            : m,
        ),
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        logger.action("Plan generation cancelled by user");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, summary: "Plan generation cancelled" }
              : m,
          ),
        );
      } else {
        const errorMsg = error instanceof Error ? error.message : "Something went wrong";
        logger.error("ChatPanel", error);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, summary: `Error generating plan: ${errorMsg}` }
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

  const handlePlanEditStart = (message: Message) => {
    setEditingPlanId(message.id);
    setPlanDraft(message.plan || "");
  };

  const handlePlanEditCancel = () => {
    setEditingPlanId(null);
    setPlanDraft("");
  };

  const handlePlanEditSave = (messageId: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId ? { ...message, plan: planDraft } : message,
      ),
    );
    setEditingPlanId(null);
    setPlanDraft("");
  };

  const handlePlanProceed = async (message: Message) => {
    if (!message.plan || isLoading) return;

    setUsedPlanIds((prev) => new Set(prev).add(message.id));

    const plannedSections = extractDetailedPlanSections(message.plan);
    if (plannedSections.length === 0) {
      handleSubmit(message.plan, "Proceed with landing page plan");
      return;
    }

    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content: "Proceed with landing page plan",
      blocksSnapshot: blocks.map((block) => ({ ...block })),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    const assistantMessage: Message = {
      id: uuidv4(),
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const results = await executeSectionPlan(
        plannedSections,
        `Building your page section by section...`,
      );
      const summaries = results
        .map((result, index) => `${index + 1}. ${result.summary}`)
        .join("\n");

      setMessages((prev) =>
        prev.map((currentMessage) =>
          currentMessage.id === assistantMessage.id
            ? {
              ...currentMessage,
              content: `Built ${results.length} sections`,
              summary: `Generated ${results.length} sections from the saved plan:\n${summaries}`,
            }
            : currentMessage,
        ),
      );
      onVersionCreated("Proceed with landing page plan");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        logger.action("Request cancelled by user");
        setMessages((prev) =>
          prev.map((currentMessage) =>
            currentMessage.id === assistantMessage.id
              ? {
                ...currentMessage,
                content: "",
                summary: "Request cancelled",
              }
              : currentMessage,
          ),
        );
      } else {
        const errorMsg =
          error instanceof Error ? error.message : "Something went wrong";
        logger.error("ChatPanel", error);
        setMessages((prev) =>
          prev.map((currentMessage) =>
            currentMessage.id === assistantMessage.id
              ? {
                ...currentMessage,
                content: `Error: ${errorMsg}`,
                summary: `Error: ${errorMsg}`,
              }
              : currentMessage,
          ),
        );
      }
    } finally {
      setIsLoading(false);
      setLoadingStatus({ phase: "idle" });
      abortControllerRef.current = null;
    }
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

  if (setupPhase === "design" && blocks.length === 0) {
    return (
      <div className={`chat-panel ${isFullScreen ? "full-screen" : ""}`}>
        <div className="chat-messages">
          <div className="chat-empty">
            <Sparkles size={32} strokeWidth={1.5} />
            <h3>Choose a Design Style</h3>
            <p>Pick a visual direction for your project.</p>
            <div className="design-style-grid">
              {DESIGN_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => handleDesignStyleSelect(style.id)}
                  className="design-style-option"
                >
                  <span className="design-style-emoji">{style.emoji}</span>
                  <span className="design-style-label">{style.label}</span>
                  <span className="design-style-desc">{style.description}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => handleDesignStyleSelect("professional")}
              className="skip-design-btn"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (setupPhase === "details" && blocks.length === 0) {
    const selectedStyle = DESIGN_STYLES.find((s) => s.id === designStyle);
    const productDescriptionLength = (
      setupDetails.productDescription || ""
    ).trim().length;
    const canContinue = productDescriptionLength >= 50;
    return (
      <div className={`chat-panel ${isFullScreen ? "full-screen" : ""}`}>
        <div className="chat-messages">
          <div className="chat-empty setup-form">
            <div className="design-style-badge">
              {selectedStyle?.emoji} {selectedStyle?.label} style
            </div>
            <h3>
              Project Details
            </h3>
            <p>Provide some context to help the AI generate better content.</p>
            <div className="setup-fields">
              <div className="setup-field">
                <label>Brand / Company Name  <span className="optional-tag">optional</span></label>
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
                <label>Hero Title  <span className="optional-tag">optional</span></label>
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
                <label>Subtitle / Description  <span className="optional-tag">optional</span></label>
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
                <label>Primary CTA Button <span className="optional-tag">optional</span></label>
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
            <div className="setup-actions">
              <button
                onClick={() => {
                  onSetDesignStyle('');
                  setSetupPhase("design");
                }}
                className="skip-design-btn"
              >
                ← Back
              </button>
              <button
                onClick={() => {
                  if (!canContinue) {
                    setTriedToProceed(true);
                    return;
                  }
                  handleSetupComplete();
                }}
                className="setup-continue-btn"
                disabled={!canContinue}
              >
                Start Building →
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
            <Sparkles size={32} strokeWidth={1.5} />
            <h3>Welcome to Crushable</h3>
            <p>Describe a section to create, or select one to edit it.</p>
            {designStyle && (
              <div className="design-style-badge">
                {DESIGN_STYLES.find((s) => s.id === designStyle)?.emoji}{" "}
                {DESIGN_STYLES.find((s) => s.id === designStyle)?.label} style
              </div>
            )}

            {/* Generate Landing Page button */}
            <button
              onClick={handleGenerateLandingPageClick}
              className="generate-landing-btn"
              disabled={isLoading}
            >
              <Zap size={18} />
              Generate Landing Page
            </button>

            <div className="chat-suggestions">
              <button
                onClick={() =>
                  setInput(
                    "Create a modern hero section with a gradient background, headline, subtext, and CTA button",
                  )
                }
              >
                <Layout size={14} /> Hero Section
              </button>
              <button
                onClick={() =>
                  setInput(
                    "Create a features grid with 3 cards, each with an icon, title, and description",
                  )
                }
              >
                <Grid3x3 size={14} /> Features Grid
              </button>
              <button
                onClick={() =>
                  setInput(
                    "Create a pricing section with 3 tiers: Basic, Pro, and Enterprise",
                  )
                }
              >
                <DollarSign size={14} /> Pricing Table
              </button>
            </div>
          </div>
        )}

        {messages.map((message, messageIndex) => {
          const isExpanded = expandedMessages.has(message.id);
          const isCurrentlyStreaming =
            isLoading && messages[messages.length - 1]?.id === message.id;
          const hasDiff = looksLikeDiff(message.content);

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
                    {shouldShowRestoreButton(message, isLoading, messages, messageIndex) && (
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
                      <div className="message-time">{formatMessageTime(message.timestamp)}</div>
                    )}
                  </>
                ) : (
                  <div className="assistant-response">
                    {message.plan ? (
                      <div className="assistant-plan-card">
                        <div className="assistant-plan-header">
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
                              onClick={() => handlePlanProceed(message)}
                              className="assistant-plan-btn"
                              disabled={isLoading}
                            >
                              <Send size={14} />
                              Proceed
                            </button>
                            <button
                              onClick={() => handlePlanEditStart(message)}
                              className="assistant-plan-btn"
                            >
                              <Pencil size={14} />
                              Edit
                            </button>
                          </div>
                        )}
                      </div>
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
                      <div className="message-time">{formatMessageTime(message.timestamp)}</div>
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
          <div className="input-actions">
            <button onClick={onOpenSettings} className="model-badge-btn" title="Model">
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
                  <span className="selected-label">{selectedBlock.label}</span>
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
        </div>
        <div className="input-shortcuts-hint">
          Enter sends, Shift+Enter adds a new line, Ctrl/Cmd+S saves, Ctrl/Cmd+Z undoes, Esc clears selection.
        </div>
      </div>
    </div>
  );
}
