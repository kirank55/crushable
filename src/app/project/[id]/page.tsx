'use client';


import { useState, useMemo, useCallback, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { usePageState } from '@/hooks/usePageState';
import { DESIGN_STYLES } from '@/types';
import { MessageSquare } from 'lucide-react';
import PreviewPanel from '@/components/PreviewPanel';
import ChatPanel, { ProjectDetails } from '@/components/ChatPanel';
import Toolbar from '@/components/Toolbar';
import SettingsModal from '@/components/SettingsModal';
import VersionsPanel from '@/components/VersionsPanel';
import { logger } from '@/lib/logger';

export default function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();

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
        addBlockSmart,
        updateBlock,
        selectBlock,
        clearSelection,
        reorderBlocks,
        handleSave,
        handleNew,
        handleRename,
        clearAll,
        createVersionSnapshot,
        loadVersion,
        restoreCurrentBlocks,
        importBlocks,
        setDesignStyle,
        undo,
        savedMessages,
        setSavedMessages,
    } = usePageState(id);

    // Redirect /project/new to /project/[actual-id] once ID is assigned
    useEffect(() => {
        if (id === 'new' && currentProjectId && currentProjectId !== 'new') {
            router.replace(`/project/${currentProjectId}`);
        }
    }, [id, currentProjectId, router]);

    const [settingsOpen, setSettingsOpen] = useState(false);
    const [versionsOpen, setVersionsOpen] = useState(false);
    const [chatVisible, setChatVisible] = useState(true);
    const [mobilePreview, setMobilePreview] = useState(false);
    const [chatResetKey, setChatResetKey] = useState(0);
    const [viewMode, setViewMode] = useState<'preview' | 'code' | 'console'>('preview');

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
        if (projectDetails.productDescription) parts.push(`Product Description: ${projectDetails.productDescription}`);
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
        router.push('/project/new');
    }, [handleNew, router]);

    const handleBackToProjects = useCallback(() => {
        handleSave();
        router.push('/');
    }, [handleSave, router]);

    const handleSetProjectDetails = useCallback((details: ProjectDetails) => {
        logger.action('Project details set', details);
        setProjectDetails(details);
        if (details.brandName) {
            handleRename(details.brandName);
        }
    }, [handleRename]);

    return (
        <div className="builder-layout">
            <Toolbar
                blocks={blocks}
                projectName={projectName}
                isDirty={isDirty}
                onSave={handleSave}
                onRename={handleRename}
                onOpenSettings={() => setSettingsOpen(true)}
                onOpenProjects={handleBackToProjects}
                onNewProject={handleNewProject}
                onClearAll={clearAll}
                onImportBlocks={importBlocks}
                onToggleMobilePreview={() => setMobilePreview(!mobilePreview)}
                onOpenVersions={() => setVersionsOpen(true)}
                onHideChat={() => setChatVisible(false)}
                chatVisible={chatVisible}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
            />

            <div className="builder-main">
                <div style={{ display: chatVisible ? 'contents' : 'none' }}>
                    <ChatPanel
                        blocks={blocks}
                        selectedBlockId={selectedBlockId}
                        designStyle={designStyle}
                        isFullScreen={isChatFullScreen}
                        resetKey={chatResetKey}
                        onAddBlock={addBlockSmart}
                        onUpdateBlock={updateBlock}
                        onSelectBlock={selectBlock}
                        onClearSelection={clearSelection}
                        onHide={() => setChatVisible(false)}
                        onToggleMobilePreview={() => setMobilePreview(!mobilePreview)}
                        onOpenVersions={() => setVersionsOpen(true)}
                        onVersionCreated={(prompt) => createVersionSnapshot(prompt)}
                        onSetDesignStyle={setDesignStyle}
                        onSetProjectDetails={handleSetProjectDetails}
                        onOpenSettings={() => setSettingsOpen(true)}
                        onUndo={undo}
                        canUndo={canUndo}
                        designStylePrompt={designStylePrompt}
                        projectContext={projectContext}
                        onRestoreBlocks={reorderBlocks}
                        initialMessages={savedMessages}
                        onMessagesChange={setSavedMessages}
                    />
                </div>

                {!chatVisible && !isChatFullScreen && (
                    <button
                        className="chat-show-btn"
                        onClick={() => setChatVisible(true)}
                        title="Show Chat Panel"
                    >
                        <MessageSquare size={18} />
                    </button>
                )}

                {!isChatFullScreen && (
                    <PreviewPanel
                        blocks={blocks}
                        selectedBlockId={selectedBlockId}
                        mobilePreview={mobilePreview}
                        designStyle={designStyle}
                        viewMode={viewMode}
                        onCodeSave={(editedHtml) => {
                            // Replace all blocks with the edited HTML as a single block
                            const { createBlock } = require('@/lib/blocks');
                            const newBlock = createBlock(editedHtml);
                            clearAll();
                            addBlockSmart(newBlock);
                            createVersionSnapshot('Manual code edit');
                        }}
                    />
                )}
            </div>

            <SettingsModal
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
            />

            <VersionsPanel
                isOpen={versionsOpen}
                onClose={() => setVersionsOpen(false)}
                versions={versions}
                onLoadVersion={loadVersion}
                onRestoreCurrent={restoreCurrentBlocks}
            />
        </div>
    );
}
