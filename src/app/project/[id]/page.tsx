'use client';

import { use, useState, useCallback } from 'react';
import { usePageState } from '@/hooks/usePageState';
import { PageStateProvider, PageStateContextValue } from '@/context/PageStateContext';
import Toolbar from '@/components/Toolbar';
import ChatPanel from '@/components/ChatPanel';
import PreviewPanel from '@/components/PreviewPanel';
import VersionsPanel from '@/components/VersionsPanel';

export const runtime = 'edge';

export default function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const state = usePageState(id);
  const [versionsOpen, setVersionsOpen] = useState(false);

  const toggleVersions = useCallback(() => setVersionsOpen((prev) => !prev), []);
  const closeVersions = useCallback(() => setVersionsOpen(false), []);

  const isChatFullScreen = state.blocks.length === 0;

  // All callbacks from usePageState are already useCallback-wrapped,
  // so no useMemo needed — the object reference changes only when state changes.
  // contextValue is a new object based on id parameter, so can't move it outside the component.
  const contextValue: PageStateContextValue = {
    versionsOpen,
    toggleVersions,
    closeVersions,
    blocks: state.blocks,
    savedMessages: state.savedMessages,
    versions: state.versions,
    isDirty: state.isDirty,
    projectName: state.projectName,
    currentVersionIndex: state.currentVersionIndex,
    addBlockSmart: state.addBlockSmart,
    replaceAllBlocks: state.replaceAllBlocks,
    setSavedMessages: state.setSavedMessages,
    createVersionSnapshot: state.createVersionSnapshot,
    loadVersion: state.loadVersion,
    restoreCurrentBlocks: state.restoreCurrentBlocks,
    handleSave: state.handleSave,
    handleRename: state.handleRename,
  };

  return (
    <PageStateProvider value={contextValue}>
      <div className="builder-layout">
        <Toolbar />

        <div className="builder-main">
          <ChatPanel isFullScreen={isChatFullScreen} />
          {!isChatFullScreen && (
            <div className="preview-with-sections">
              <PreviewPanel />
            </div>
          )}
        </div>

        <VersionsPanel />
      </div>
    </PageStateProvider>
  );
}
