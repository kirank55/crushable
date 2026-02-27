'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Block, Message, DESIGN_STYLES } from '@/types';
import { createBlock } from '@/lib/blocks';
import { getApiKey, getModel } from '@/lib/storage';
import { parseResponse, parsePlanResponse } from '@/lib/prompt';
import { Send, Loader2, Sparkles, PanelLeftClose, Smartphone, History, ChevronDown, ChevronRight, Code, Undo2, Zap, CheckCircle2, Link2, ClipboardList, Hammer, RefreshCw, Square, RotateCcw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

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
    onHide: () => void;
    onToggleMobilePreview: () => void;
    onOpenVersions: () => void;
    onVersionCreated: (prompt: string) => void;
    onSetDesignStyle: (style: string) => void;
    onSetProjectDetails: (details: ProjectDetails) => void;
    onUndo: () => string | null;
    canUndo: boolean;
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
}

type LoadingStatus = {
    phase: 'idle' | 'requesting' | 'generating' | 'planning' | 'building';
    model?: string;
    currentSection?: string;
    sectionIndex?: number;
    totalSections?: number;
};

function isEditIntent(prompt: string, hasBlocks: boolean): boolean {
    if (!hasBlocks) return false;
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
    for (const pattern of newPatterns) { if (pattern.test(prompt)) return false; }
    for (const pattern of editPatterns) { if (pattern.test(prompt)) return true; }
    return false;
}

function isMultiSectionIntent(prompt: string): boolean {
    const patterns = [
        /\b(landing\s*page|full\s*page|complete\s*page|entire\s*page|whole\s*page)\b/i,
        /\b(build|create|generate|design)\b.*\b(page|website|site)\b/i,
        /\bmultiple\s+sections\b/i,
    ];
    return patterns.some(p => p.test(prompt));
}

function getModelLabel(modelId: string): string {
    const labels: Record<string, string> = {
        'auto:free': 'Free Auto',
        'stepfun/step-3.5-flash:free': 'StepFun 3.5 Flash',
        'z-ai/glm-4.5-air:free': 'GLM 4.5 Air',
        'nvidia/nemotron-3-nano-30b-a3b:free': 'NVIDIA Nemotron 30B',
        'google/gemma-3-27b-it:free': 'Gemma 3 27B',
        'anthropic/claude-sonnet-4': 'Claude Sonnet 4',
        'google/gemini-2.5-flash': 'Gemini 2.5 Flash',
        'openai/gpt-4o': 'GPT-4o',
        'openai/gpt-4o-mini': 'GPT-4o Mini',
        'anthropic/claude-3.5-haiku': 'Claude 3.5 Haiku',
    };
    return labels[modelId] || modelId;
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
    onHide,
    onToggleMobilePreview,
    onOpenVersions,
    onVersionCreated,
    onSetDesignStyle,
    onSetProjectDetails,
    onUndo,
    canUndo,
    designStylePrompt,
    projectContext,
    onRestoreBlocks,
    initialMessages,
    onMessagesChange,
}: ChatPanelProps) {
    const [messages, setMessages] = useState<Message[]>(initialMessages || []);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>({ phase: 'idle' });
    const [showSelectDropdown, setShowSelectDropdown] = useState(false);
    const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
    const [setupPhase, setSetupPhase] = useState<'design' | 'details' | 'ready'>(
        designStyle ? 'ready' : 'design'
    );
    const [setupDetails, setSetupDetails] = useState<ProjectDetails>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const selectDropdownRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    const selectedBlock = blocks.find((b) => b.id === selectedBlockId);

    useEffect(() => {
        setMessages(initialMessages || []);
        setExpandedMessages(new Set());
        setSetupPhase(designStyle ? 'ready' : 'design');
        setSetupDetails({});
    }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // Load initial messages when they change (e.g. project switch)
    useEffect(() => {
        if (initialMessages && initialMessages.length > 0 && messages.length === 0) {
            setMessages(initialMessages);
        }
    }, [initialMessages]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sync messages to parent for persistence
    useEffect(() => {
        if (onMessagesChange && messages.length > 0) {
            onMessagesChange(messages);
        }
    }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (designStyle && setupPhase === 'design') setSetupPhase('details');
    }, [designStyle, setupPhase]);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (selectDropdownRef.current && !selectDropdownRef.current.contains(e.target as Node)) {
                setShowSelectDropdown(false);
            }
        };
        if (showSelectDropdown) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showSelectDropdown]);

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
        setSetupPhase('details');
    };

    const handleSetupComplete = () => {
        onSetProjectDetails(setupDetails);
        setSetupPhase('ready');
    };

    /** Generate a single section via API */
    const generateSection = useCallback(async (
        prompt: string,
        mode: 'new' | 'edit',
        currentBlock?: Block,
    ): Promise<{ summary: string; html: string; raw: string }> => {
        const apiKey = getApiKey();
        const model = getModel();

        setLoadingStatus({ phase: 'requesting', model: getModelLabel(model || 'auto:free') });

        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
            throw new Error(error.error || 'Failed to generate');
        }

        setLoadingStatus(prev => ({ ...prev, phase: 'generating' }));

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response stream');

        const decoder = new TextDecoder();
        let fullContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            fullContent += decoder.decode(value, { stream: true });
        }

        const { summary, html } = parseResponse(fullContent);
        return { summary, html, raw: fullContent };
    }, [designStylePrompt, projectContext]);

    /** Handle multi-section generation (e.g. "build a landing page") */
    const handleMultiSectionGeneration = useCallback(async (prompt: string) => {
        setLoadingStatus({ phase: 'planning' });

        // Step 1: Plan the sections
        const apiKey = getApiKey();
        const model = getModel();
        const planResponse = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: abortControllerRef.current?.signal,
            body: JSON.stringify({
                prompt,
                mode: 'plan',
                apiKey,
                model,
                designStylePrompt,
                projectContext,
            }),
        });

        if (!planResponse.ok) {
            const error = await planResponse.json();
            throw new Error(error.error || 'Failed to plan page');
        }

        const planReader = planResponse.body?.getReader();
        if (!planReader) throw new Error('No plan response');
        const planDecoder = new TextDecoder();
        let planContent = '';
        while (true) {
            const { done, value } = await planReader.read();
            if (done) break;
            planContent += planDecoder.decode(value, { stream: true });
        }

        const sections = parsePlanResponse(planContent);
        logger.info('Multi-section plan', { sections });

        // Message 1: Plan completed — show what was planned
        const planSummary = sections.map((s, i) => `${i + 1}. ${s}`).join('\n');
        const planMsg: Message = {
            id: uuidv4(),
            role: 'assistant',
            content: '',
            summary: `📋 **Planning complete!** I've planned ${sections.length} sections:\n${planSummary}`,
        };
        setMessages((prev) => [...prev, planMsg]);

        // Small pause so user can read the plan
        await new Promise(resolve => setTimeout(resolve, 600));

        // Message 2: Starting implementation
        const implMsg: Message = {
            id: uuidv4(),
            role: 'assistant',
            content: '',
            summary: `🚀 **Now implementing!** Building all ${sections.length} sections one by one…`,
        };
        setMessages((prev) => [...prev, implMsg]);

        // Step 2: Build each section one by one
        const results: { summary: string; html: string }[] = [];
        for (let i = 0; i < sections.length; i++) {
            const sectionDesc = sections[i];
            setLoadingStatus({
                phase: 'building',
                model: getModelLabel(model || 'auto:free'),
                currentSection: sectionDesc,
                sectionIndex: i + 1,
                totalSections: sections.length,
            });

            const result = await generateSection(
                `Create a ${sectionDesc} section for a landing page. This is section ${i + 1} of ${sections.length}.`,
                'new',
            );

            const newBlock = createBlock(result.html);
            onAddBlock(newBlock);
            results.push(result);

            // Per-section completion message
            const sectionMsg: Message = {
                id: uuidv4(),
                role: 'assistant',
                content: '',
                summary: `✅ Section ${i + 1}/${sections.length} done: ${result.summary}`,
            };
            setMessages((prev) => [...prev, sectionMsg]);

            // Small delay between sections
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        return results;
    }, [designStylePrompt, projectContext, generateSection, onAddBlock]);

    const handleSubmit = async (overridePrompt?: string) => {
        const trimmed = (overridePrompt || input).trim();
        if (!trimmed || isLoading) return;

        // Retry intent detection — re-run last user prompt
        if (/^(try\s*again|retry|redo|re-?run)$/i.test(trimmed) && !overridePrompt) {
            const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
            if (lastUserMsg) {
                setInput('');
                handleSubmit(lastUserMsg.content);
                return;
            }
        }

        // Intent detection
        let effectiveBlockId = selectedBlockId;
        if (!selectedBlockId && blocks.length > 0 && isEditIntent(trimmed, true)) {
            const lastBlock = blocks[blocks.length - 1];
            logger.action('Intent detection: auto-selecting last block', { autoSelectedBlock: lastBlock.label });
            effectiveBlockId = lastBlock.id;
            onSelectBlock(lastBlock.id);
        }

        // Smart block matching: find ALL blocks referenced in the prompt
        // Uses fuzzy bidirectional matching (prompt word matches label word or vice versa)
        const matchedBlocks: { block: Block; score: number }[] = [];
        if (blocks.length > 1) {
            const words = trimmed.toLowerCase().split(/\s+/).filter(w => w.length >= 3);

            for (const block of blocks) {
                const label = (block.label || '').toLowerCase();
                const labelWords = label.split(/[\s\-_]+/).filter(w => w.length >= 3);
                const blockIdMatch = block.html?.match(/data-block-id="([^"]+)"/)?.[1]?.toLowerCase() || '';
                const blockIdWords = blockIdMatch.split(/[\s\-_]+/).filter(w => w.length >= 3);
                const sectionId = block.html?.match(/id="([^"]+)"/)?.[1]?.toLowerCase() || '';
                const sectionIdWords = sectionId.split(/[\s\-_]+/).filter(w => w.length >= 3);

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
        const isMultiEdit = !selectedBlockId && matchedBlocks.length >= 2 && isEditIntent(trimmed, true);

        // Single block redirect (only if not multi-edit)
        if (!isMultiEdit && matchedBlocks.length > 0) {
            const best = matchedBlocks[0];
            if (best.block.id !== effectiveBlockId) {
                logger.action('Smart block redirect', {
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
        const mode = currentSelectedBlock ? 'edit' : 'new';
        const isMultiSection = !currentSelectedBlock && !isMultiEdit && isMultiSectionIntent(trimmed);

        const userMessage: Message = {
            id: uuidv4(),
            role: 'user',
            content: trimmed,
            blockId: currentSelectedBlock?.id || undefined,
            blocksSnapshot: blocks.map(b => ({ ...b })),
        };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        abortControllerRef.current = new AbortController();

        const assistantMessage: Message = {
            id: uuidv4(),
            role: 'assistant',
            content: '',
            blockId: currentSelectedBlock?.id || undefined,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        try {
            if (isMultiEdit) {
                // Multi-section edit — edit all matched blocks
                const editBlocks = matchedBlocks.map(m => m.block);
                const sectionNames = editBlocks.map(b => b.label || 'section').join(', ');
                logger.action('Multi-section edit', { sections: sectionNames, count: editBlocks.length });

                // Notify user which sections we're editing
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantMessage.id
                            ? { ...m, summary: `✏️ Editing ${editBlocks.length} sections: ${sectionNames}` }
                            : m
                    )
                );

                const results: string[] = [];
                for (let i = 0; i < editBlocks.length; i++) {
                    const block = editBlocks[i];
                    setLoadingStatus({
                        phase: 'building',
                        model: getModelLabel(getModel() || 'auto:free'),
                        currentSection: block.label || 'section',
                        sectionIndex: i + 1,
                        totalSections: editBlocks.length,
                    });

                    // Give the AI context about the multi-edit
                    const multiEditContext = `This is a multi-section edit. The user wants to change ${editBlocks.length} sections together. You are editing the "${block.label}" section (${i + 1} of ${editBlocks.length}). Other sections being edited: ${editBlocks.filter(b => b.id !== block.id).map(b => b.label).join(', ')}. Apply only the changes relevant to THIS section.`;

                    const result = await generateSection(
                        `${multiEditContext}\n\nUser request: ${trimmed}`,
                        'edit',
                        block,
                    );

                    onUpdateBlock(block.id, result.html);
                    results.push(`${block.label}: ${result.summary}`);

                    // Per-section progress message
                    const progressMsg: Message = {
                        id: uuidv4(),
                        role: 'assistant',
                        content: '',
                        summary: `✅ Updated ${block.label} (${i + 1}/${editBlocks.length}): ${result.summary}`,
                    };
                    setMessages((prev) => [...prev, progressMsg]);

                    await new Promise(resolve => setTimeout(resolve, 300));
                }

                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantMessage.id
                            ? { ...m, content: `Edited ${editBlocks.length} sections`, summary: `✅ Multi-edit complete — updated ${editBlocks.length} sections:\n${results.map((r, i) => `${i + 1}. ${r}`).join('\n')}` }
                            : m
                    )
                );
                onVersionCreated(trimmed);
            } else if (isMultiSection) {
                // Multi-section generation
                const results = await handleMultiSectionGeneration(trimmed);
                const summaries = results.map((r, i) => `${i + 1}. ${r.summary}`).join('\n');

                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantMessage.id
                            ? { ...m, content: `Built ${results.length} sections`, summary: `Generated ${results.length} sections:\n${summaries}` }
                            : m
                    )
                );
                onVersionCreated(trimmed);
            } else {
                // Single section generation/edit
                setLoadingStatus({ phase: 'requesting', model: getModelLabel(getModel() || 'auto:free') });

                // Build cross-section context so the AI knows about other sections on the page
                let editPrompt = trimmed;
                if (mode === 'edit' && blocks.length > 1) {
                    const sectionMap = blocks
                        .filter(b => b.id !== currentSelectedBlock?.id)
                        .map(b => {
                            const sid = b.html?.match(/id="([^"]+)"/)?.[1] || '';
                            return `- "${b.label}"${sid ? ` (id="${sid}")` : ''}`;
                        })
                        .join('\n');
                    editPrompt = `${trimmed}\n\n[Page context — other sections on this page:\n${sectionMap}\nUse these section IDs for any anchor links or scroll references.]`;
                }

                const response = await fetch('/api/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
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
                    throw new Error(error.error || 'Failed to generate');
                }

                setLoadingStatus(prev => ({ ...prev, phase: 'generating' }));

                const reader = response.body?.getReader();
                if (!reader) throw new Error('No response stream');

                const decoder = new TextDecoder();
                let fullContent = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    fullContent += chunk;
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === assistantMessage.id ? { ...m, content: fullContent } : m
                        )
                    );
                }

                const { summary, html: htmlContent } = parseResponse(fullContent);
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantMessage.id ? { ...m, content: fullContent, summary } : m
                    )
                );

                if (mode === 'edit' && currentSelectedBlock) {
                    onUpdateBlock(currentSelectedBlock.id, htmlContent);
                } else {
                    const newBlock = createBlock(htmlContent);
                    onAddBlock(newBlock);
                }
                onVersionCreated(trimmed);
            }
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                logger.action('Request cancelled by user');
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantMessage.id
                            ? { ...m, content: '', summary: '⏹️ Request cancelled' }
                            : m
                    )
                );
            } else {
                const errorMsg = error instanceof Error ? error.message : 'Something went wrong';
                logger.error('ChatPanel', error);
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantMessage.id
                            ? { ...m, content: `Error: ${errorMsg}`, summary: `Error: ${errorMsg}` }
                            : m
                    )
                );
            }
        } finally {
            setIsLoading(false);
            setLoadingStatus({ phase: 'idle' });
            abortControllerRef.current = null;
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
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
            case 'requesting':
                return (
                    <div className="result-status streaming">
                        <Loader2 size={14} className="spin" />
                        <span><Link2 size={12} className="inline-icon" /> Connecting to {loadingStatus.model} — preparing your prompt…</span>
                    </div>
                );
            case 'generating':
                return (
                    <div className="result-status streaming">
                        <Loader2 size={14} className="spin" />
                        <span><Zap size={12} className="inline-icon" /> {loadingStatus.model} is writing code — generating HTML…</span>
                    </div>
                );
            case 'planning':
                return (
                    <div className="result-status streaming">
                        <Loader2 size={14} className="spin" />
                        <span><ClipboardList size={12} className="inline-icon" /> Analyzing your request — planning page sections…</span>
                    </div>
                );
            case 'building':
                return (
                    <div className="result-status streaming">
                        <Loader2 size={14} className="spin" />
                        <span><Hammer size={12} className="inline-icon" /> Building section {loadingStatus.sectionIndex}/{loadingStatus.totalSections}: {loadingStatus.currentSection}…</span>
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

    if (setupPhase === 'design' && blocks.length === 0) {
        return (
            <div className={`chat-panel ${isFullScreen ? 'full-screen' : ''}`}>
                <div className="chat-messages">
                    <div className="chat-empty">
                        <Sparkles size={32} strokeWidth={1.5} />
                        <h3>Choose a Design Style</h3>
                        <p>Pick a visual direction for your project.</p>
                        <div className="design-style-grid">
                            {DESIGN_STYLES.map((style) => (
                                <button key={style.id} onClick={() => handleDesignStyleSelect(style.id)} className="design-style-option">
                                    <span className="design-style-emoji">{style.emoji}</span>
                                    <span className="design-style-label">{style.label}</span>
                                    <span className="design-style-desc">{style.description}</span>
                                </button>
                            ))}
                        </div>
                        <button onClick={() => handleDesignStyleSelect('professional')} className="skip-design-btn">
                            Skip — use Professional defaults
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (setupPhase === 'details' && blocks.length === 0) {
        const selectedStyle = DESIGN_STYLES.find(s => s.id === designStyle);
        return (
            <div className={`chat-panel ${isFullScreen ? 'full-screen' : ''}`}>
                <div className="chat-messages">
                    <div className="chat-empty setup-form">
                        <div className="design-style-badge">{selectedStyle?.emoji} {selectedStyle?.label} style</div>
                        <h3>Project Details <span className="optional-tag">all optional</span></h3>
                        <p>Provide some context to help the AI generate better content.</p>
                        <div className="setup-fields">
                            <div className="setup-field">
                                <label>Brand / Company Name</label>
                                <input value={setupDetails.brandName || ''} onChange={(e) => setSetupDetails(prev => ({ ...prev, brandName: e.target.value }))} placeholder="e.g. Acme Inc." />
                            </div>
                            <div className="setup-field">
                                <label>Hero Title</label>
                                <input value={setupDetails.title || ''} onChange={(e) => setSetupDetails(prev => ({ ...prev, title: e.target.value }))} placeholder="e.g. Build Faster, Ship Smarter" />
                            </div>
                            <div className="setup-field">
                                <label>Subtitle / Description</label>
                                <input value={setupDetails.subtitle || ''} onChange={(e) => setSetupDetails(prev => ({ ...prev, subtitle: e.target.value }))} placeholder="e.g. The AI-powered platform for..." />
                            </div>
                            <div className="setup-field">
                                <label>Primary CTA Button Text</label>
                                <input value={setupDetails.ctaText || ''} onChange={(e) => setSetupDetails(prev => ({ ...prev, ctaText: e.target.value }))} placeholder="e.g. Get Started Free" />
                            </div>
                        </div>
                        <div className="setup-actions">
                            <button onClick={() => setSetupPhase('design')} className="skip-design-btn">← Back</button>
                            <button onClick={handleSetupComplete} className="setup-continue-btn">Start Building →</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // === MAIN CHAT VIEW ===
    return (
        <div className={`chat-panel ${isFullScreen ? 'full-screen' : ''}`}>
            <div className="chat-header">
                <Sparkles size={18} />
                <span>AI Builder</span>
                <div className="chat-header-actions">
                    {canUndo && (
                        <button onClick={() => {
                            const label = onUndo();
                            if (label) {
                                const undoMsg: Message = {
                                    id: uuidv4(),
                                    role: 'assistant',
                                    content: '',
                                    summary: `↩️ Undo: ${label}`,
                                };
                                setMessages((prev) => [...prev, undoMsg]);
                            }
                        }} className="header-action-btn undo-btn" title="Undo last change">
                            <Undo2 size={16} />
                        </button>
                    )}
                    <button onClick={onToggleMobilePreview} className="header-action-btn" title="Mobile Preview">
                        <Smartphone size={16} />
                    </button>
                    <button onClick={onOpenVersions} className="header-action-btn" title="Versions">
                        <History size={16} />
                    </button>
                    {!isFullScreen && (
                        <button onClick={onHide} className="header-action-btn" title="Hide Panel">
                            <PanelLeftClose size={16} />
                        </button>
                    )}
                </div>
            </div>

            <div className="chat-messages">
                {messages.length === 0 && (
                    <div className="chat-empty">
                        <Sparkles size={32} strokeWidth={1.5} />
                        <h3>Welcome to Crushable</h3>
                        <p>Describe a section to create, or select one to edit it.</p>
                        {designStyle && (
                            <div className="design-style-badge">
                                {DESIGN_STYLES.find(s => s.id === designStyle)?.emoji} {DESIGN_STYLES.find(s => s.id === designStyle)?.label} style
                            </div>
                        )}

                        {/* Generate Landing Page button */}
                        <button
                            onClick={() => {
                                setInput('Build a complete landing page with navbar, hero section, features, testimonials, pricing, and footer');
                                setTimeout(() => handleSubmit(), 100);
                            }}
                            className="generate-landing-btn"
                            disabled={isLoading}
                        >
                            <Zap size={18} />
                            Generate Landing Page
                        </button>

                        <div className="chat-suggestions">
                            <button onClick={() => setInput('Create a modern hero section with a gradient background, headline, subtext, and CTA button')}>
                                🎨 Hero Section
                            </button>
                            <button onClick={() => setInput('Create a features grid with 3 cards, each with an icon, title, and description')}>
                                ✨ Features Grid
                            </button>
                            <button onClick={() => setInput('Create a pricing section with 3 tiers: Basic, Pro, and Enterprise')}>
                                💰 Pricing Table
                            </button>
                        </div>
                    </div>
                )}

                {messages.map((message) => {
                    const isExpanded = expandedMessages.has(message.id);
                    const isCurrentlyStreaming = isLoading && messages[messages.length - 1]?.id === message.id;

                    return (
                        <div key={message.id} className={`chat-message ${message.role}`}>
                            <div className="message-content">
                                {message.role === 'user' ? (
                                    <>
                                        {message.blockId && (
                                            <span className="message-block-tag">✏️ {blocks.find(b => b.id === message.blockId)?.label || message.blockId}</span>
                                        )}
                                        <p>{message.content}</p>
                                        {message.blocksSnapshot && !isLoading && (
                                            <button
                                                className="checkpoint-restore-btn"
                                                title="Restore to this checkpoint"
                                                onClick={() => {
                                                    if (message.blocksSnapshot) {
                                                        onRestoreBlocks(message.blocksSnapshot);
                                                        const restoreMsg: Message = {
                                                            id: uuidv4(),
                                                            role: 'assistant',
                                                            content: '',
                                                            summary: `⏪ Restored to checkpoint: "${message.content.slice(0, 50)}${message.content.length > 50 ? '…' : ''}"`,
                                                        };
                                                        setMessages((prev) => [...prev, restoreMsg]);
                                                    }
                                                }}
                                            >
                                                <RotateCcw size={12} />
                                                Restore
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <div className="assistant-response">
                                        {message.content ? (
                                            <div className="assistant-result">
                                                <div className="result-summary">
                                                    {isCurrentlyStreaming ? (
                                                        renderLoadingStatus() || (
                                                            <div className="result-status streaming">
                                                                <Loader2 size={14} className="spin" />
                                                                <span>Generating... ({message.content.length} chars)</span>
                                                            </div>
                                                        )
                                                    ) : (
                                                        <div className="result-status done">
                                                            <CheckCircle2 size={14} className="done-icon" />
                                                            <span style={{ whiteSpace: 'pre-line' }}>{message.summary || 'Generated section'}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {!isCurrentlyStreaming && message.content.length > 20 && (
                                                    <button onClick={() => toggleMessageExpanded(message.id)} className="code-toggle-btn">
                                                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                        <Code size={14} />
                                                        <span>{message.content.length} chars generated</span>
                                                    </button>
                                                )}

                                                {isExpanded && !isCurrentlyStreaming && (
                                                    <pre className="code-preview"><code>{message.content}</code></pre>
                                                )}
                                            </div>
                                        ) : message.summary ? (
                                            <div className="result-status done">
                                                <span style={{ whiteSpace: 'pre-line' }}>{message.summary}</span>
                                            </div>
                                        ) : isCurrentlyStreaming ? (
                                            <div className="typing-indicator">
                                                {renderLoadingStatus() || (
                                                    <div className="result-status streaming">
                                                        <Loader2 size={14} className="spin" />
                                                        <span>Reading your prompt and setting up the generation pipeline…</span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : null}
                                    </div>
                                )}
                                {/* Try Again button for error messages */}
                                {message.role === 'assistant' && message.content.startsWith('Error:') && !isLoading && (
                                    <button
                                        onClick={() => {
                                            const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
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
                        placeholder={selectedBlock ? `Describe changes to "${selectedBlock.label}"...` : 'Describe a section to create...'}
                        rows={2}
                        disabled={isLoading}
                    />
                    <div className="input-actions">
                        <div className="select-block-wrapper" ref={selectDropdownRef}>
                            <button
                                onClick={() => setShowSelectDropdown(!showSelectDropdown)}
                                className={`select-block-btn ${selectedBlockId ? 'has-selection' : ''}`}
                                title="Select block to edit"
                                disabled={blocks.length === 0}
                            >
                                {selectedBlock ? (
                                    <span className="selected-label">{selectedBlock.label}</span>
                                ) : (
                                    <span>Select</span>
                                )}
                                <ChevronDown size={14} />
                            </button>
                            {showSelectDropdown && (
                                <div className="select-dropdown">
                                    <button
                                        onClick={() => { onClearSelection(); setShowSelectDropdown(false); }}
                                        className={`select-dropdown-item ${!selectedBlockId ? 'active' : ''}`}
                                    >
                                        ✨ Create New Section
                                    </button>
                                    {selectedBlockId && (
                                        <button
                                            onClick={() => { onClearSelection(); setShowSelectDropdown(false); }}
                                            className="select-dropdown-item"
                                        >
                                            🚫 No Selection
                                        </button>
                                    )}
                                    {blocks.map((block) => (
                                        <button
                                            key={block.id}
                                            onClick={() => handleSelectBlock(block.id)}
                                            className={`select-dropdown-item ${selectedBlockId === block.id ? 'active' : ''}`}
                                        >
                                            ✏️ {block.label}
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
                            className={`send-button ${isLoading ? 'cancel' : ''}`}
                            title={isLoading ? 'Cancel request' : 'Send'}
                        >
                            {isLoading ? <Square size={16} /> : <Send size={18} />}
                        </button>
                    </div>
                </div>
            </div>
        </div >
    );
}
