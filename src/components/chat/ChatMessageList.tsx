import { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { Message } from '@/types';
import { formatRelativeDate } from '@/lib/date';
import { useChatContext } from '@/context/ChatContext';
import GenerationProgress from './GenerationProgress';

// ─── Sub-components ─────────────────────────────────────────────

function ChatMessage({ message }: { message: Message }) {
  return (
    <div className={`chat-message ${message.role}`}>
      <div className="message-content">
        <div className="chat-message-content">{message.content}</div>
        {message.timestamp && (
          <div className="message-time">{formatRelativeDate(message.timestamp)}</div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="chat-empty">
      <Sparkles size={28} />
      <h3>What are we building?</h3>
      <p>Describe your project and the AI will generate a landing page for you.</p>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────

export default function ChatMessageList() {
  const { messages, isLoading, sectionProgress } = useChatContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sectionProgress]);

  const hasMessages = messages.length > 0 || isLoading;

  return (
    <div className="chat-messages">
      {!hasMessages ? (
        <EmptyState />
      ) : (
        <>
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <GenerationProgress />
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
