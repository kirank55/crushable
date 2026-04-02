import { Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { Message } from '@/types';
import { formatRelativeDate } from '@/lib/date';

// ─── Sub-components ─────────────────────────────────────────────

function SectionStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'done': return <CheckCircle2 size={12} className="done-icon" />;
    case 'error': return <AlertCircle size={12} className="error-icon" />;
    default: return <span className="pending-dot" />;
  }
}

function PersistedProgress({ message }: { message: Message }) {
  if (!message.sectionProgress || message.sectionProgress.length === 0) return null;

  const doneCount = message.sectionProgress.filter((s) => s.status === 'done').length;
  const totalCount = message.sectionProgress.length;

  return (
    <div className="generation-progress persisted">
      <div className="generation-progress-header">
        <CheckCircle2 size={13} className="done-icon" />
        <span>Built {doneCount} of {totalCount} section{totalCount !== 1 ? 's' : ''}</span>
      </div>
      <ul className="section-progress-list">
        {message.sectionProgress.map((s) => (
          <li key={s.id} className={`section-progress-item ${s.status}`}>
            <SectionStatusIcon status={s.status} />
            <span className="section-progress-label">{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────

export default function AssistantMessage({ message }: { message: Message }) {
  return (
    <div className="chat-message assistant">
      <div className="message-content" style={{ background: 'transparent' }}>

        {/* Persisted plan + progress */}
        <PersistedProgress message={message} />

        {/* Text content */}
        <div className="chat-message-content">{message.content}</div>

        {message.timestamp && (
          <div className="message-time">{formatRelativeDate(message.timestamp)}</div>
        )}
      </div>
    </div>
  );
}
