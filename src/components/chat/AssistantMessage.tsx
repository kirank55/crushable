import { Sparkles } from 'lucide-react';
import { Message } from '@/types';
import { formatRelativeDate } from '@/lib/date';

// ─── Component ──────────────────────────────────────────────────

export default function AssistantMessage({ message }: { message: Message }) {
  return (
    <div className="chat-message assistant">
      <div className="message-content">
        <div className="assistant-message-header">
          <Sparkles size={12} className="assistant-icon" />
        </div>
        <div className="chat-message-content">{message.content}</div>
        {message.timestamp && (
          <div className="message-time">{formatRelativeDate(message.timestamp)}</div>
        )}
      </div>
    </div>
  );
}
