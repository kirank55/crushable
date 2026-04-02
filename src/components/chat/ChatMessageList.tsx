import { useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';
import UserMessage from './UserMessage';
import AssistantMessage from './AssistantMessage';
import GenerationProgress from './GenerationProgress';

// ─── Sub-components ─────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="chat-empty">
      <h3>What are we building?</h3>
      <p>Describe your project and the AI will generate a landing page for you.</p>
    </div>
  );
}

// ─── Resume Banner ──────────────────────────────────────────────

function ResumeBanner({ onResume }: { onResume: () => void }) {
  return (
    <div className="resume-banner">
      <div className="resume-banner-text">
        <RefreshCw size={14} className="resume-banner-icon" />
        <span>Generation was interrupted. Resume from where you left off?</span>
      </div>
      <button className="resume-banner-btn" onClick={onResume}>
        Resume
      </button>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────

export default function ChatMessageList() {
  const { messages, isLoading, sectionProgress, hasBlocks, handleResume } = useChatContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sectionProgress]);

  const hasMessages = messages.length > 0 || isLoading;

  // Show resume banner when generation was interrupted:
  // messages exist but no blocks were produced and we're not currently generating
  const firstUserMessage = messages.find((m) => m.role === 'user');
  const showResumeBanner =
    !hasBlocks &&
    !isLoading &&
    messages.length > 1 &&
    !!firstUserMessage &&
    !!handleResume;

  return (
    <div className="chat-messages">
      {showResumeBanner && <ResumeBanner onResume={handleResume!} />}
      {!hasMessages ? (
        <EmptyState />
      ) : (
        <>
          {messages.map((msg) =>
            msg.role === 'user' ? (
              <UserMessage key={msg.id} message={msg} />
            ) : (
              <AssistantMessage key={msg.id} message={msg} />
            ),
          )}
          <GenerationProgress />
        </>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
