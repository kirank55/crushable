'use client';

import { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { Message } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { formatRelativeDate } from '@/lib/date';

interface ChatPanelProps {
  isFullScreen: boolean;
  messages: Message[];
  onMessagesChange: (messages: Message[]) => void;
}

export default function ChatPanel({ isFullScreen, messages, onMessagesChange }: ChatPanelProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    const trimmed = input.trim();
    //no response if input is empty
    if (!trimmed) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };

    // Echo locally for now — AI wiring comes in Phase 5
    const assistantMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: 'Got it! AI generation will be wired in Phase 5.',
      timestamp: Date.now(),
    };

    onMessagesChange([...messages, userMessage, assistantMessage]);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`chat-panel ${isFullScreen ? 'full-screen' : ''}`}>
      <div className="chat-header">
        <Sparkles size={16} />
        <span>Chat</span>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <Sparkles size={28} />
            <h3>What are we building?</h3>
            <p>Describe your project and the AI will generate a landing page for you.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`chat-message ${msg.role}`}>
              <div className="chat-message-content">{msg.content}</div>
              {msg.timestamp && (
                <div className="chat-message-time">{formatRelativeDate(msg.timestamp)}</div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="chat-input-area">
        <div className="input-row">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to build..."
            rows={2}
          />
          <div className="input-actions">
            <button
              className="send-button"
              disabled={!input.trim()}
              title="Send"
              onClick={handleSend}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
