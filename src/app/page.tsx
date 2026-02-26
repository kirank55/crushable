'use client';

import { useState, useMemo, useCallback } from 'react';
import { usePageState } from '@/hooks/usePageState';
import { DESIGN_STYLES } from '@/types';
import PreviewPanel from '@/components/PreviewPanel';
import ChatPanel, { ProjectDetails } from '@/components/ChatPanel';
import Toolbar from '@/components/Toolbar';
import SettingsModal from '@/components/SettingsModal';
import ProjectSidebar from '@/components/ProjectSidebar';
import VersionsPanel from '@/components/VersionsPanel';
import { logger } from '@/lib/logger';

export default function BuilderPage() {
  const {
    blocks,
    selectedBlockId,
    currentProjectId,
    isDirty,
    projectName,
    versions,
    designStyle,
    canUndo,
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
    setDesignStyle,
    undo,
  } = usePageState();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(true); // Open initially
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [chatResetKey, setChatResetKey] = useState(0);

  const designStylePrompt = useMemo(() => {
    if (!designStyle) return undefined;
    return DESIGN_STYLES.find(s => s.id === designStyle)?.prompt;
  }, [designStyle]);

  // Chat is full screen when no blocks have been generated yet
  const isChatFullScreen = blocks.length === 0;

  const [projectDetails, setProjectDetails] = useState<ProjectDetails>({});

  // Build a context string from project details for the LLM
  const projectContext = useMemo(() => {
    const parts: string[] = [];
    if (projectDetails.brandName) parts.push(`Brand/Company Name: ${projectDetails.brandName}`);
    if (projectDetails.title) parts.push(`Hero Title: ${projectDetails.title}`);
    if (projectDetails.subtitle) parts.push(`Subtitle/Description: ${projectDetails.subtitle}`);
    if (projectDetails.ctaText) parts.push(`Primary CTA Button Text: ${projectDetails.ctaText}`);
    return parts.length > 0 ? parts.join('\n') : undefined;
  }, [projectDetails]);

  const handleNewProject = useCallback(() => {
    handleNew();
    setChatResetKey(prev => prev + 1);
    setChatVisible(true);
    setProjectDetails({});
    logger.action('New project + chat reset');
  }, [handleNew]);

  const handleLoadProject = useCallback((project: Parameters<typeof handleLoad>[0]) => {
    handleLoad(project);
    setChatResetKey(prev => prev + 1);
    setChatVisible(true);
    setProjectDetails({});
    logger.action('Load project + chat reset');
  }, [handleLoad]);

  const handleSetProjectDetails = useCallback((details: ProjectDetails) => {
    logger.action('Project details set', details);
    setProjectDetails(details);
    if (details.brandName) {
      handleRename(details.brandName);
    }
  }, [handleRename]);

  return (
    <div className="builder-layout">
      {!projectsOpen && (
        <>
          <Toolbar
            blocks={blocks}
            projectName={projectName}
            isDirty={isDirty}
            onSave={handleSave}
            onRename={handleRename}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenProjects={() => setProjectsOpen(true)}
            onNewProject={handleNewProject}
            onClearAll={clearAll}
            onImportBlocks={importBlocks}
          />

          <div className="builder-main">
            {chatVisible && (
              <ChatPanel
                blocks={blocks}
                selectedBlockId={selectedBlockId}
                designStyle={designStyle}
                isFullScreen={isChatFullScreen}
                resetKey={chatResetKey}
                onAddBlock={addBlock}
                onUpdateBlock={updateBlock}
                onSelectBlock={selectBlock}
                onClearSelection={clearSelection}
                onHide={() => setChatVisible(false)}
                onToggleMobilePreview={() => setMobilePreview(!mobilePreview)}
                onOpenVersions={() => setVersionsOpen(true)}
                onVersionCreated={(prompt) => createVersionSnapshot(prompt)}
                onSetDesignStyle={setDesignStyle}
                onSetProjectDetails={handleSetProjectDetails}
                onUndo={undo}
                canUndo={canUndo}
                designStylePrompt={designStylePrompt}
                projectContext={projectContext}
              />
            )}

            {!chatVisible && !isChatFullScreen && (
              <button
                className="chat-show-btn"
                onClick={() => setChatVisible(true)}
                title="Show Chat Panel"
              >
                💬
              </button>
            )}

            {!isChatFullScreen && (
              <PreviewPanel
                blocks={blocks}
                selectedBlockId={selectedBlockId}
                mobilePreview={mobilePreview}
              />
            )}
          </div>
        </>
      )}

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <ProjectSidebar
        isOpen={projectsOpen}
        isFullScreen={true}
        onClose={() => setProjectsOpen(false)}
        currentProjectId={currentProjectId}
        onLoadProject={handleLoadProject}
        onNewProject={handleNewProject}
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
