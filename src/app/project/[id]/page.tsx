'use client';


import { useState, useMemo, useCallback, useEffect, use, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePageState } from '@/hooks/usePageState';
import { DESIGN_STYLES, ModificationEngineOperation, ModificationEngineResponse } from '@/types';
import PreviewPanel from '@/components/PreviewPanel';
import ChatPanel, { ProjectDetails } from '@/components/ChatPanel';
import Toolbar from '@/components/Toolbar';
import SettingsModal from '@/components/SettingsModal';
import VersionsPanel from '@/components/VersionsPanel';
import HelpModal from '@/components/HelpModal';
import { createBlock } from '@/lib/blocks';
import { generateFullHTML } from '@/lib/export';
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
        insertBlockAfter,
        removeBlock,
        selectBlock,
        clearSelection,
        reorderBlocks,
        handleSave,
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
    const chatResetKey = 0;
    const [viewMode, setViewMode] = useState<'preview' | 'code' | 'console'>('preview');
    const [helpOpen, setHelpOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [editMode, setEditMode] = useState(false);
    const lastAutoProjectNameRef = useRef<string | null>(null);

    const deriveProjectName = useCallback((details: ProjectDetails) => {
        const brandName = details.brandName?.trim();
        if (brandName) return brandName;

        const heroTitle = details.title?.trim();
        if (heroTitle) return heroTitle;

        const description = details.productDescription?.trim();
        if (!description) return '';

        const stopWords = new Set([
            'a', 'an', 'and', 'are', 'as', 'at', 'be', 'build', 'for', 'from',
            'in', 'into', 'is', 'of', 'on', 'or', 'platform', 'product', 'that',
            'the', 'this', 'to', 'tool', 'with', 'your',
        ]);

        const tokens = description
            .toLowerCase()
            .replace(/[^a-z0-9\s-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .split(' ')
            .filter((token) => token.length > 2 && !stopWords.has(token));

        const uniqueTokens = Array.from(new Set(tokens));
        const coreName = uniqueTokens.slice(0, 3);

        if (coreName.length === 0) {
            return 'Untitled Project';
        }

        return coreName
            .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
            .join(' ');
    }, []);

    const extractProjectNameFromBlocks = useCallback((nextBlocks: typeof blocks) => {
        if (typeof window === 'undefined') return null;

        const navigationLikeBlocks = nextBlocks.filter((block) =>
            /home|nav|navigation|header/i.test(block.id) ||
            /nav|navigation|header/i.test(block.label),
        );
        const candidateBlocks = navigationLikeBlocks.length > 0 ? navigationLikeBlocks : nextBlocks;
        const ignoredLabels = new Set([
            'home',
            'features',
            'pricing',
            'testimonials',
            'faq',
            'contact',
            'about',
            'login',
            'sign in',
            'sign up',
            'get started',
            'start free',
            'book demo',
            'docs',
        ]);

        for (const block of candidateBlocks) {
            const documentFragment = new DOMParser().parseFromString(block.html, 'text/html');
            const candidates = Array.from(
                documentFragment.body.querySelectorAll('a, strong, span, div, p'),
            );

            for (const node of candidates) {
                const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
                if (!text || text.length < 2 || text.length > 32) continue;
                if (ignoredLabels.has(text.toLowerCase())) continue;
                if (/[#/]/.test(text)) continue;
                if (text.split(' ').length > 4) continue;
                return text;
            }
        }

        return null;
    }, []);

    const handlePreviewSelect = useCallback((blockId: string) => {
        setChatVisible(true);
        selectBlock(blockId);
    }, [selectBlock]);

    const handleOpenInNewTab = useCallback(() => {
        if (blocks.length === 0) return;

        const html = generateFullHTML(blocks, projectName);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);

        window.open(url, '_blank', 'noopener,noreferrer');
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }, [blocks, projectName]);

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

    const applyModificationOperations = useCallback((operations: ModificationEngineOperation[]) => {
        operations.forEach((operation) => {
            switch (operation.type) {
                case 'update-block':
                    updateBlock(operation.blockId, operation.html);
                    break;
                case 'insert-block':
                    insertBlockAfter(operation.afterBlockId, operation.block);
                    break;
                case 'remove-block':
                    removeBlock(operation.blockId);
                    break;
                case 'select-block':
                    selectBlock(operation.blockId);
                    break;
                case 'set-design-style':
                    setDesignStyle(operation.designStyle);
                    break;
                default:
                    break;
            }
        });
    }, [insertBlockAfter, removeBlock, selectBlock, setDesignStyle, updateBlock]);

    const handleElementEdit = useCallback(async (blockId: string, elementSelector: string, instruction: string) => {
        const block = blocks.find((entry) => entry.id === blockId);
        if (!block) {
            throw new Error('Selected block was not found.');
        }

        const parser = new DOMParser();
        const documentFragment = parser.parseFromString(block.html, 'text/html');
        const section = documentFragment.body.querySelector('section');
        const targetElement = elementSelector === '__section_root__'
            ? section
            : section?.querySelector(elementSelector);

        if (!section || !targetElement) {
            throw new Error('Selected element could not be resolved.');
        }

        const response = await fetch('/api/modification-engine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: instruction,
                requestKind: 'element-edit',
                selectedBlockId: blockId,
                selectedElementSelector: elementSelector,
                selectedElementHtml: elementSelector === '__section_root__' ? block.html : targetElement.outerHTML,
                blocks,
                designStyle,
                designStylePrompt,
                projectContext,
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => null);
            throw new Error(error?.error || 'Failed to update the selected element.');
        }

        const result = await response.json() as ModificationEngineResponse;
        applyModificationOperations(result.operations);
        createVersionSnapshot(`Element edit: ${instruction}`);
    }, [applyModificationOperations, blocks, createVersionSnapshot, designStyle, designStylePrompt, projectContext]);

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
        const nextProjectName = deriveProjectName(details);
        if (nextProjectName) {
            lastAutoProjectNameRef.current = nextProjectName;
            handleRename(nextProjectName);
        }
    }, [deriveProjectName, handleRename]);

    useEffect(() => {
        if (blocks.length === 0) return;

        const generatedProjectName = extractProjectNameFromBlocks(blocks);
        if (!generatedProjectName) return;

        const canAutoRename =
            projectName === 'Untitled Project' ||
            projectName === lastAutoProjectNameRef.current;

        if (!canAutoRename || projectName === generatedProjectName) return;

        lastAutoProjectNameRef.current = generatedProjectName;
        handleRename(generatedProjectName);
    }, [blocks, extractProjectNameFromBlocks, handleRename, projectName]);

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
                onImportBlocks={importBlocks}
                onOpenVersions={() => setVersionsOpen(true)}
                onHideChat={() => setChatVisible(false)}
                onShowChat={() => setChatVisible(true)}
                onOpenHelp={() => setHelpOpen(true)}
                onOpenInNewTab={handleOpenInNewTab}
                chatVisible={chatVisible}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                mobilePreview={mobilePreview}
                editMode={editMode}
                onEditModeChange={setEditMode}
                onRefreshPreview={() => setRefreshKey((value) => value + 1)}
                onPreviewModeChange={setMobilePreview}
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
                        onInsertBlockAfter={insertBlockAfter}
                        onUpdateBlock={updateBlock}
                        onRemoveBlock={removeBlock}
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
                {!isChatFullScreen && (
                    <PreviewPanel
                        blocks={blocks}
                        mobilePreview={mobilePreview}
                        designStyle={designStyle}
                        selectedBlockId={selectedBlockId}
                        viewMode={viewMode}
                        refreshKey={refreshKey}
                        editMode={editMode}
                        onSelectBlock={handlePreviewSelect}
                        onElementEdit={handleElementEdit}
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
