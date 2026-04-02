'use client';

import { ChatProvider } from '@/context/ChatContext';
import ChatMessageList from './chat/ChatMessageList';
import ChatInputArea from './chat/ChatInputArea';

// ─── Component ──────────────────────────────────────────────────

interface ChatPanelProps {
  isFullScreen: boolean;
}

export default function ChatPanel({ isFullScreen }: ChatPanelProps) {
  return (
    <ChatProvider>
      <div className={`chat-panel ${isFullScreen ? 'full-screen' : ''}`}>
        <div className="chat-header">
          <span>Chat</span>
        </div>

        <ChatMessageList />
        <ChatInputArea />
      </div>
    </ChatProvider>
  );
}
