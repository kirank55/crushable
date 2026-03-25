'use client';

import { useState } from 'react';
import { Send, Sparkles } from 'lucide-react';

interface ChatPanelProps {
  isFullScreen: boolean;
}

export default function ChatPanel({ isFullScreen }: ChatPanelProps) {
  const [input, setInput] = useState('');

  return (
    <div className={`chat-panel ${isFullScreen ? 'full-screen' : ''}`}>
      <div className="chat-header">
        <Sparkles size={16} />
        <span>Chat</span>
      </div>

      <div className="chat-messages">
        <div className="chat-empty">
          <Sparkles size={28} />
          <h3>What are we building?</h3>
          <p>Describe your project and the AI will generate a landing page for you.</p>
        </div>
      </div>

      <div className="chat-input-area">
        <div className="input-row">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe what you want to build..."
            rows={2}
          />
          <div className="input-actions">
            <button
              className="send-button"
              disabled={!input.trim()}
              title="Send"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
