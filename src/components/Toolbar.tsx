'use client';

import { useState, useEffect, useRef } from 'react';
import { Download, Save, Settings, ArrowLeft, Plus, Trash2, Check, Upload, Smartphone, History, PanelLeftClose, Eye, Code, Terminal } from 'lucide-react';
import { downloadHTML } from '@/lib/export';
import { getApiKey, getModel } from '@/lib/storage';
import { Block, getAvailableModels } from '@/types';
import { readFileAsText, parseImportedHtml } from '@/lib/import';
import { logger } from '@/lib/logger';

interface ToolbarProps {
    blocks: Block[];
    projectName: string;
    isDirty: boolean;
    onSave: () => void;
    onRename: (name: string) => void;
    onOpenSettings: () => void;
    onOpenProjects: () => void;
    onNewProject: () => void;
    onClearAll: () => void;
    onImportBlocks: (blocks: Block[]) => void;
    onToggleMobilePreview?: () => void;
    onOpenVersions?: () => void;
    onHideChat?: () => void;
    chatVisible?: boolean;
    viewMode?: 'preview' | 'code' | 'console';
    onViewModeChange?: (mode: 'preview' | 'code' | 'console') => void;
}

export default function Toolbar({
    blocks,
    projectName,
    isDirty,
    onSave,
    onRename,
    onOpenSettings,
    onOpenProjects,
    onNewProject,
    onClearAll,
    onImportBlocks,
    onToggleMobilePreview,
    onOpenVersions,
    onHideChat,
    chatVisible,
    viewMode,
    onViewModeChange,
}: ToolbarProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(projectName);
    const [modelLabel, setModelLabel] = useState('');
    const [showSaved, setShowSaved] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const model = getModel();
        const models = getAvailableModels();
        const info = models.find((m) => m.id === model);
        setModelLabel(info?.label || model);
    }, []);

    const handleSave = () => {
        logger.action('Toolbar save');
        onSave();
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 2000);
    };

    const handleRename = () => {
        if (editName.trim()) {
            onRename(editName.trim());
        }
        setIsEditing(false);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        logger.action('Toolbar import', { fileName: file.name });

        const confirmed = window.confirm(
            'Only import code generated with Crushable.\n\nImporting code from other sources may not work correctly. Continue?'
        );

        if (!confirmed) {
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        try {
            const html = await readFileAsText(file);
            const importedBlocks = parseImportedHtml(html);

            if (importedBlocks.length === 0) {
                alert('No Crushable sections found in this file. Make sure the file contains <section data-block-id="..."> elements.');
                return;
            }

            onImportBlocks(importedBlocks);
            logger.action('Import successful', { blocksImported: importedBlocks.length });
        } catch (err) {
            logger.error('Import', err);
            alert('Failed to import file.');
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="toolbar">
            <div className="toolbar-left">
                <button onClick={onOpenProjects} className="toolbar-btn" title="Back to Projects">
                    <ArrowLeft size={18} />
                    <span className="btn-label">Projects</span>
                </button>

                <div className="toolbar-divider" />


                <div className="toolbar-actions">

                    {onOpenVersions && (
                        <button onClick={onOpenVersions} className="header-action-btn" title="Versions">
                            <History size={16} />
                        </button>
                    )}
                    {onHideChat && chatVisible && (
                        <button onClick={onHideChat} className="header-action-btn" title="Hide Chat">
                            <PanelLeftClose size={16} />
                        </button>
                    )}
                </div>
            </div>

            <div className="toolbar-center">
                {isEditing ? (
                    <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleRename}
                        onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                        className="project-name-input"
                        autoFocus
                    />
                ) : (
                    <button
                        onClick={() => { setEditName(projectName); setIsEditing(true); }}
                        className="project-name-btn"
                    >
                        {projectName}
                        {isDirty && <span className="unsaved-dot" title="Unsaved changes" />}
                    </button>
                )}
            </div>


            <div className="toolbar-right">

                {onToggleMobilePreview && (
                    <button onClick={onToggleMobilePreview} className="header-action-btn" title="Mobile Preview">
                        <Smartphone size={16} />
                    </button>
                )}

                {viewMode && onViewModeChange && (
                    <div className="preview-tabs">
                        <button
                            onClick={() => onViewModeChange('preview')}
                            className={`preview-tab ${viewMode === 'preview' ? 'active' : ''}`}
                        >
                            <Eye size={14} />
                            Preview
                        </button>
                        <button
                            onClick={() => onViewModeChange('code')}
                            className={`preview-tab ${viewMode === 'code' ? 'active' : ''}`}
                        >
                            <Code size={14} />
                            Code
                        </button>
                        <button
                            onClick={() => onViewModeChange('console')}
                            className={`preview-tab ${viewMode === 'console' ? 'active' : ''}`}
                        >
                            <Terminal size={14} />
                            Console
                        </button>
                    </div>
                )}

                <div className="toolbar-divider" />

                <button onClick={handleSave} className="toolbar-btn save-btn" title="Save">
                    {showSaved ? <Check size={18} /> : <Save size={18} />}
                    <span className="btn-label">{showSaved ? 'Saved!' : 'Save'}</span>
                </button>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".html,.htm"
                    onChange={handleImport}
                    style={{ display: 'none' }}
                />
                <button onClick={() => fileInputRef.current?.click()} className="toolbar-btn" title="Import HTML">
                    <Upload size={18} />
                    <span className="btn-label">Import</span>
                </button>


                <button
                    onClick={() => downloadHTML(blocks)}
                    className="toolbar-btn download-btn"
                    disabled={blocks.length === 0}
                    title="Download HTML"
                >
                    <Download size={18} />
                    <span className="btn-label">Export</span>
                </button>

                <div className="toolbar-divider" />

            </div>
        </div>
    );
}
