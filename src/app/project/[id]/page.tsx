'use client';

import { useState, use } from 'react';
import Toolbar from '@/components/Toolbar';
import ChatPanel from '@/components/ChatPanel';
import PreviewPanel from '@/components/PreviewPanel';
import VersionsPanel from '@/components/VersionsPanel';

 export const runtime = 'edge';

export default function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [versionsOpen, setVersionsOpen] = useState(false);

  // Chat is full screen when no blocks have been generated yet (always true in Phase 2)
  const isChatFullScreen = true;

  return (
    <div className="builder-layout">
      <Toolbar projectName="Untitled Project" />

      <div className="builder-main">
        <ChatPanel isFullScreen={isChatFullScreen} />
        {!isChatFullScreen && <PreviewPanel />}
      </div>

      <VersionsPanel
        isOpen={versionsOpen}
        onClose={() => setVersionsOpen(false)}
      />
    </div>
  );
}
