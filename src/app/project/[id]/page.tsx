'use client';

import { use, useState } from 'react';
import { usePageState } from '@/hooks/usePageState';
import Toolbar from '@/components/Toolbar';
import ChatPanel from '@/components/ChatPanel';
import PreviewPanel from '@/components/PreviewPanel';
import VersionsPanel from '@/components/VersionsPanel';

export const runtime = 'edge';

export default function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [versionsOpen, setVersionsOpen] = useState(false);

  const state = usePageState(id);
  const isChatFullScreen = state.blocks.length === 0;

  return (
    <div className="builder-layout">
      <Toolbar
        projectName={state.projectName}
        isDirty={state.isDirty}
        onSave={state.handleSave}
        onRename={state.handleRename}
        onVersionsOpen={() => setVersionsOpen(!versionsOpen)}
      />

      <div className="builder-main">
        <ChatPanel
          isFullScreen={isChatFullScreen}
          messages={state.savedMessages}
          onMessagesChange={state.setSavedMessages}
        />
        {!isChatFullScreen && <PreviewPanel blocks={state.blocks} />}
      </div>

      <VersionsPanel
        isOpen={versionsOpen}
        onClose={() => setVersionsOpen(false)}
        versions={state.versions}
        currentVersionIndex={state.currentVersionIndex}
        onLoadVersion={state.loadVersion}
        onRestoreCurrent={state.restoreCurrentBlocks}
      />
    </div>
  );
}
