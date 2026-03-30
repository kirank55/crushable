import { useCallback, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';

// ─── Constants ──────────────────────────────────────────────────

const MAX_TEXTAREA_HEIGHT = 160;

// ─── Component ──────────────────────────────────────────────────

export default function ChatInputArea() {
  const { input, setInput, isLoading, handleSend, handleStop, hasBlocks } = useChatContext();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow textarea to fit content up to MAX_TEXTAREA_HEIGHT
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [input]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    [setInput],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const canSend = input.trim().length > 0;

  const placeholder = hasBlocks
    ? 'Ask to add or change a section…'
    : 'Describe your app or product to generate a full landing page…';

  return (
    <div className="chat-input-area">
      <div className="input-row">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={isLoading}
        />
        <div className="input-actions">
          {isLoading ? (
            <button className="stop-button" title="Stop generation" onClick={handleStop}>
              <span className="stop-square" />
            </button>
          ) : (
            <button
              className="send-button"
              disabled={!canSend}
              title="Send message"
              onClick={handleSend}
            >
              <Send size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
