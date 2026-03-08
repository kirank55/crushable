'use client';


import { useState, useMemo, useCallback, useEffect, use, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePageState } from '@/hooks/usePageState';
import { DESIGN_STYLES } from '@/types';
import { MessageSquare } from 'lucide-react';
import PreviewPanel from '@/components/PreviewPanel';
import ChatPanel, { ProjectDetails } from '@/components/ChatPanel';
import SectionPanel from '@/components/SectionPanel';
import Toolbar from '@/components/Toolbar';
import SettingsModal from '@/components/SettingsModal';
import VersionsPanel from '@/components/VersionsPanel';
import HelpModal from '@/components/HelpModal';
import { createBlock } from '@/lib/blocks';
import { parseImportedHtml } from '@/lib/import';
import { logger } from '@/lib/logger';
import { getTemplateById } from '@/lib/templates';

export default function BuilderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const templateId = searchParams.get('template');
    const templateAppliedRef = useRef(false);

    const {
        blocks,
        selectedBlockId,
        currentProjectId,
        currentVersionIndex,
        isDirty,
        isReady,
        projectName,
        versions,
        designStyle,
        canUndo,
        addBlockSmart,
        updateBlock,
        duplicateBlock,
        removeBlock,
        selectBlock,
        clearSelection,
        reorderBlocks,
        toggleBlockVisibility,
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

    const isEditableTarget = useCallback((target: EventTarget | null) => {
        const element = target as HTMLElement | null;
        if (!element) return false;

        const tagName = element.tagName;
        return element.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
    }, []);

    // Redirect /project/new to /project/[actual-id] once ID is assigned
    useEffect(() => {
        if (
            id === 'new' &&
            currentProjectId &&
            currentProjectId !== 'new' &&
            (!templateId || templateAppliedRef.current || blocks.length > 0)
        ) {
            router.replace(`/project/${currentProjectId}`);
        }
    }, [blocks.length, currentProjectId, id, router, templateId]);

    const [settingsOpen, setSettingsOpen] = useState(false);
    const [versionsOpen, setVersionsOpen] = useState(false);
    const [chatVisible, setChatVisible] = useState(true);
    const [mobilePreview, setMobilePreview] = useState(false);
    const [chatResetKey, setChatResetKey] = useState(0);
    const [viewMode, setViewMode] = useState<'preview' | 'code' | 'console'>('preview');
    const [helpOpen, setHelpOpen] = useState(false);
    const [sectionsVisible, setSectionsVisible] = useState(true);

    const handlePreviewSelect = useCallback((blockId: string) => {
        setChatVisible(true);
        selectBlock(blockId);
    }, [selectBlock]);

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
        if (isDirty) {
            const shouldSave = window.confirm('You have unsaved changes. Press OK to save before leaving.');
            if (shouldSave) {
                handleSave();
            } else {
                const shouldDiscard = window.confirm('Leave this project without saving?');
                if (!shouldDiscard) return;
            }
        }
        router.push('/');
    }, [handleSave, isDirty, router]);

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!isDirty) return;
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    useEffect(() => {
        const handleGlobalKeyDown = (event: KeyboardEvent) => {
            const isSaveShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's';
            const isUndoShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z';

            if (isSaveShortcut) {
                event.preventDefault();
                handleSave();
                return;
            }

            if (event.key === 'Escape') {
                clearSelection();
                return;
            }

            if (isUndoShortcut && !isEditableTarget(event.target) && canUndo) {
                event.preventDefault();
                undo();
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [canUndo, clearSelection, handleSave, isEditableTarget, undo]);

    const handleSetProjectDetails = useCallback((details: ProjectDetails) => {
        logger.action('Project details set', details);
        setProjectDetails(details);
        if (details.brandName) {
            handleRename(details.brandName);
        }
    }, [handleRename]);

    useEffect(() => {
        if (!isReady || id !== 'new' || !templateId || templateAppliedRef.current || blocks.length > 0) {
            return;
        }

        const template = getTemplateById(templateId);
        if (!template) {
            templateAppliedRef.current = true;
            return;
        }

        logger.action('Apply template', { templateId: template.id, templateName: template.name });
        importBlocks(template.buildBlocks());
        handleRename(template.name);
        if (!designStyle) {
            setDesignStyle(template.designStyle);
        }
        templateAppliedRef.current = true;
    }, [blocks.length, designStyle, handleRename, id, importBlocks, isReady, setDesignStyle, templateId]);

    if (!isReady) {
        return (
            <div className="builder-loading">
                <div className="builder-loading-card">
                    <span className="builder-loading-spinner" />
                    <p>Loading project…</p>
                </div>
            </div>
        );
    }

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
                onOpenHelp={() => setHelpOpen(true)}
                onToggleSectionsPanel={() => setSectionsVisible((prev) => !prev)}
                chatVisible={chatVisible}
                sectionsVisible={sectionsVisible}
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
                        onVersionCreated={(prompt) => createVersionSnapshot(prompt)}
                        onSetDesignStyle={setDesignStyle}
                        onSetProjectDetails={handleSetProjectDetails}
                        onOpenSettings={() => setSettingsOpen(true)}
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
                    <>
                        {sectionsVisible && (
                            <SectionPanel
                                blocks={blocks}
                                selectedBlockId={selectedBlockId}
                                onSelectBlock={handlePreviewSelect}
                                onReorderBlocks={reorderBlocks}
                                onDuplicateBlock={duplicateBlock}
                                onRemoveBlock={removeBlock}
                                onToggleVisibility={toggleBlockVisibility}
                            />
                        )}

                    <PreviewPanel
                        blocks={blocks}
                        mobilePreview={mobilePreview}
                        designStyle={designStyle}
                        selectedBlockId={selectedBlockId}
                        viewMode={viewMode}
                        onSelectBlock={handlePreviewSelect}
                        onCodeSave={(editedHtml) => {
                            // Parse the edited HTML back into individual section blocks
                            const parsed = parseImportedHtml(`<body>${editedHtml}</body>`);
                            if (parsed.length > 0) {
                                clearAll();
                                parsed.forEach(block => addBlockSmart(block));
                            } else {
                                // Fallback: treat as single block if no sections found
                                clearAll();
                                addBlockSmart(createBlock(editedHtml));
                            }
                            createVersionSnapshot('Manual code edit');
                        }}
                    />
                    </>
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
                currentVersionIndex={currentVersionIndex}
                onLoadVersion={loadVersion}
                onRestoreCurrent={restoreCurrentBlocks}
            />

            <HelpModal
                isOpen={helpOpen}
                onClose={() => setHelpOpen(false)}
            />
        </div>
    );
}
