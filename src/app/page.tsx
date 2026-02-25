'use client';

import { useState } from 'react';
import { usePageState } from '@/hooks/usePageState';
import PreviewPanel from '@/components/PreviewPanel';
import ChatPanel from '@/components/ChatPanel';
import Toolbar from '@/components/Toolbar';
import SettingsModal from '@/components/SettingsModal';
import ProjectSidebar from '@/components/ProjectSidebar';

export default function BuilderPage() {
  const {
    blocks,
    selectedBlockId,
    currentProjectId,
    isDirty,
    projectName,
    addBlock,
    updateBlock,
    selectBlock,
    clearSelection,
    handleSave,
    handleLoad,
    handleNew,
    handleRename,
    clearAll,
  } = usePageState();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);

  return (
    <div className="builder-layout">
      <Toolbar
        blocks={blocks}
        projectName={projectName}
        isDirty={isDirty}
        onSave={handleSave}
        onRename={handleRename}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenProjects={() => setProjectsOpen(true)}
        onNewProject={handleNew}
        onClearAll={clearAll}
      />

      <div className="builder-main">
        <ChatPanel
          blocks={blocks}
          selectedBlockId={selectedBlockId}
          onAddBlock={addBlock}
          onUpdateBlock={updateBlock}
          onClearSelection={clearSelection}
        />

        <PreviewPanel
          blocks={blocks}
          selectedBlockId={selectedBlockId}
          onSelectBlock={selectBlock}
        />
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <ProjectSidebar
        isOpen={projectsOpen}
        onClose={() => setProjectsOpen(false)}
        currentProjectId={currentProjectId}
        onLoadProject={handleLoad}
        onNewProject={handleNew}
      />
    </div>
  );
}
