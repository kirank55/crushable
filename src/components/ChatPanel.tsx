'use client';

import { useState, useRef, useEffect } from 'react';
import { Block, Message } from '@/types';
import { createBlock } from '@/lib/blocks';
import { getApiKey, getModel } from '@/lib/storage';
import { Send, Loader2, Sparkles, PanelLeftClose, Smartphone, History, ChevronDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

interface ChatPanelProps {
    blocks: Block[];
    selectedBlockId: string | null;
    onAddBlock: (block: Block) => void;
    onUpdateBlock: (id: string, html: string) => void;
    onSelectBlock: (id: string | null) => void;
    onClearSelection: () => void;
    onHide: () => void;
    onToggleMobilePreview: () => void;
    onOpenVersions: () => void;
    onVersionCreated: (prompt: string) => void;
}

export default function ChatPanel({
    blocks,
    selectedBlockId,
    onAddBlock,
    onUpdateBlock,
    onSelectBlock,
    onClearSelection,
    onHide,
    onToggleMobilePreview,
    onOpenVersions,
    onVersionCreated,
}: ChatPanelProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSelectDropdown, setShowSelectDropdown] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const selectDropdownRef = useRef<HTMLDivElement>(null);

    const selectedBlock = blocks.find((b) => b.id === selectedBlockId);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (selectDropdownRef.current && !selectDropdownRef.current.contains(e.target as Node)) {
                setShowSelectDropdown(false);
            }
        };
        if (showSelectDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showSelectDropdown]);

    const handleSubmit = async () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading) return;

        logger.action('ChatPanel submit', { prompt: trimmed, mode: selectedBlock ? 'edit' : 'new', selectedBlockId });

        // Check if user is saying "add section" while a block is selected
        const isAddIntent = /\b(add|create|new)\b.*\b(section|block|component)\b/i.test(trimmed);
        if (isAddIntent && selectedBlock) {
            const confirmed = window.confirm(
                `You have "${selectedBlock.label}" selected. Do you want to:\n\n• OK = Add a new standalone section\n• Cancel = Modify the selected section instead`
            );
            if (!confirmed) {
                // User wants to modify instead, continue with edit mode
                logger.action('User chose to modify selected section instead of adding new');
            } else {
                // User wants a new section, clear selection
                logger.action('User chose to add new standalone section');
                onClearSelection();
            }
        }

        const currentSelectedBlock = selectedBlock && !isAddIntent ? selectedBlock : blocks.find((b) => b.id === selectedBlockId);
        const mode = currentSelectedBlock ? 'edit' : 'new';

        const userMessage: Message = {
            id: uuidv4(),
            role: 'user',
            content: trimmed,
            blockId: currentSelectedBlock?.id || undefined,
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        const assistantMessage: Message = {
            id: uuidv4(),
            role: 'assistant',
            content: '',
            blockId: currentSelectedBlock?.id || undefined,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        try {
            const apiKey = getApiKey();
            const model = getModel();

            logger.api('ChatPanel -> /api/generate', { mode, model, hasApiKey: !!apiKey });

            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: trimmed,
                    currentHtml: currentSelectedBlock?.html,
                    blockId: currentSelectedBlock?.id,
                    mode,
                    apiKey,
                    model,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to generate');
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response stream');

            const decoder = new TextDecoder();
            let fullContent = '';

            logger.stream('ChatPanel stream start');

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

            logger.stream('ChatPanel stream complete', { contentLength: fullContent.length });

            // Process the HTML result
            const htmlContent = fullContent.trim();

            if (mode === 'edit' && currentSelectedBlock) {
                onUpdateBlock(currentSelectedBlock.id, htmlContent);
            } else {
                const newBlock = createBlock(htmlContent);
                onAddBlock(newBlock);
            }

            // Create version snapshot
            onVersionCreated(trimmed);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Something went wrong';
            logger.error('ChatPanel', error);
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === assistantMessage.id
                        ? { ...m, content: `❌ Error: ${errorMsg}` }
                        : m
                )
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handleSelectBlock = (blockId: string) => {
        logger.action('ChatPanel selectBlock via dropdown', { blockId });
        onSelectBlock(blockId);
        setShowSelectDropdown(false);
    };

    return (
        <div className="chat-panel">
            <div className="chat-header">
                <Sparkles size={18} />
                <span>AI Builder</span>
                <div className="chat-header-actions">
                    <button onClick={onToggleMobilePreview} className="header-action-btn" title="Mobile Preview">
                        <Smartphone size={16} />
                    </button>
                    <button onClick={onOpenVersions} className="header-action-btn" title="Versions">
                        <History size={16} />
                    </button>
                    <button onClick={onHide} className="header-action-btn" title="Hide Panel">
                        <PanelLeftClose size={16} />
                    </button>
                </div>
            </div>

            <div className="chat-messages">
                {messages.length === 0 && (
                    <div className="chat-empty">
                        <Sparkles size={32} strokeWidth={1.5} />
                        <h3>Welcome to Crushable</h3>
                        <p>Describe a section to create, or select one to edit it.</p>
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

                {messages.map((message) => (
                    <div key={message.id} className={`chat-message ${message.role}`}>
                        <div className="message-content">
                            {message.role === 'user' ? (
                                <>
                                    {message.blockId && (
                                        <span className="message-block-tag">✏️ {blocks.find(b => b.id === message.blockId)?.label || message.blockId}</span>
                                    )}
                                    <p>{message.content}</p>
                                </>
                            ) : (
                                <div className="assistant-response">
                                    {message.content ? (
                                        <div className="assistant-progress">
                                            <div className="progress-header">
                                                {isLoading && messages[messages.length - 1]?.id === message.id ? (
                                                    <>
                                                        <Loader2 size={14} className="spin" />
                                                        <span>Generating... ({message.content.length} chars)</span>
                                                    </>
                                                ) : (
                                                    <span>✅ Generated ({message.content.length} chars)</span>
                                                )}
                                            </div>
                                            <pre><code>{message.content}</code></pre>
                                        </div>
                                    ) : (
                                        <div className="typing-indicator">
                                            <span></span><span></span><span></span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
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
                                        ✨ New Section
                                    </button>
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
                            onClick={handleSubmit}
                            disabled={!input.trim() || isLoading}
                            className="send-button"
                        >
                            {isLoading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
