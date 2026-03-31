import { Message } from '@/types';
import { formatRelativeDate } from '@/lib/date';

// ─── Component ──────────────────────────────────────────────────

export default function UserMessage({ message }: { message: Message }) {
  return (
    <div className="chat-message user">
      <div className="message-content">
        <div className="chat-message-content">{message.content}</div>
        {message.timestamp && (
          <div className="message-time">{formatRelativeDate(message.timestamp)}</div>
        )}
      </div>
    </div>
  );
}
