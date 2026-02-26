'use client';

import { useState } from 'react';
import { usePageState } from '@/hooks/usePageState';
import PreviewPanel from '@/components/PreviewPanel';
import ChatPanel from '@/components/ChatPanel';
import Toolbar from '@/components/Toolbar';
import SettingsModal from '@/components/SettingsModal';
import ProjectSidebar from '@/components/ProjectSidebar';
import VersionsPanel from '@/components/VersionsPanel';

export default function BuilderPage() {
  const {
    blocks,
    selectedBlockId,
    currentProjectId,
    isDirty,
    projectName,
    versions,
    addBlock,
    updateBlock,
    selectBlock,
    clearSelection,
    handleSave,
    handleLoad,
    handleNew,
    handleRename,
    clearAll,
    createVersionSnapshot,
    loadVersion,
    importBlocks,
  } = usePageState();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);
  const [mobilePreview, setMobilePreview] = useState(false);

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
        onImportBlocks={importBlocks}
      />

      <div className="builder-main">
        {chatVisible && (
          <ChatPanel
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            onAddBlock={addBlock}
            onUpdateBlock={updateBlock}
            onSelectBlock={selectBlock}
            onClearSelection={clearSelection}
            onHide={() => setChatVisible(false)}
            onToggleMobilePreview={() => setMobilePreview(!mobilePreview)}
            onOpenVersions={() => setVersionsOpen(true)}
            onVersionCreated={(prompt) => createVersionSnapshot(prompt)}
          />
        )}

        {!chatVisible && (
          <button
            className="chat-show-btn"
            onClick={() => setChatVisible(true)}
            title="Show Chat Panel"
          >
            💬
          </button>
        )}

        <PreviewPanel
          blocks={blocks}
          selectedBlockId={selectedBlockId}
          mobilePreview={mobilePreview}
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

      <VersionsPanel
        isOpen={versionsOpen}
        onClose={() => setVersionsOpen(false)}
        versions={versions}
        onLoadVersion={loadVersion}
      />
    </div>
  );
}
