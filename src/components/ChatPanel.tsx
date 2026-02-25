'use client';

import { useState, useRef, useEffect } from 'react';
import { Block, Message } from '@/types';
import { createBlock } from '@/lib/blocks';
import { getApiKey, getModel } from '@/lib/storage';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface ChatPanelProps {
    blocks: Block[];
    selectedBlockId: string | null;
    onAddBlock: (block: Block) => void;
    onUpdateBlock: (id: string, html: string) => void;
    onClearSelection: () => void;
}

export default function ChatPanel({
    blocks,
    selectedBlockId,
    onAddBlock,
    onUpdateBlock,
    onClearSelection,
}: ChatPanelProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const selectedBlock = blocks.find((b) => b.id === selectedBlockId);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSubmit = async () => {
        const trimmed = input.trim();
        if (!trimmed || isLoading) return;

        const userMessage: Message = {
            id: uuidv4(),
            role: 'user',
            content: trimmed,
            blockId: selectedBlockId || undefined,
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        const assistantMessage: Message = {
            id: uuidv4(),
            role: 'assistant',
            content: '',
            blockId: selectedBlockId || undefined,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        try {
            const apiKey = getApiKey();
            const model = getModel();
            const mode = selectedBlock ? 'edit' : 'new';

            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: trimmed,
                    currentHtml: selectedBlock?.html,
                    blockId: selectedBlock?.id,
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

            // Process the HTML result
            const htmlContent = fullContent.trim();

            if (mode === 'edit' && selectedBlock) {
                onUpdateBlock(selectedBlock.id, htmlContent);
            } else {
                const newBlock = createBlock(htmlContent);
                onAddBlock(newBlock);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Something went wrong';
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

    return (
        <div className="chat-panel">
            <div className="chat-header">
                <Sparkles size={18} />
                <span>AI Builder</span>
                {selectedBlock && (
                    <div className="editing-badge" onClick={onClearSelection}>
                        Editing: {selectedBlock.label}
                        <span className="badge-close">×</span>
                    </div>
                )}
            </div>

            <div className="chat-messages">
                {messages.length === 0 && (
                    <div className="chat-empty">
                        <Sparkles size={32} strokeWidth={1.5} />
                        <h3>Welcome to Crushable</h3>
                        <p>Describe a section to create, or click one in the preview to edit it.</p>
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
                                        <pre><code>{message.content.slice(0, 200)}{message.content.length > 200 ? '...' : ''}</code></pre>
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
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedBlock ? `Describe changes to "${selectedBlock.label}"...` : 'Describe a section to create...'}
                    rows={2}
                    disabled={isLoading}
                />
                <button
                    onClick={handleSubmit}
                    disabled={!input.trim() || isLoading}
                    className="send-button"
                >
                    {isLoading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                </button>
            </div>
        </div>
    );
}
