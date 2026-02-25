'use client';

import { useState, useEffect } from 'react';
import { Download, Save, Settings, FolderOpen, Plus, Trash2, Zap, Check } from 'lucide-react';
import { downloadHTML } from '@/lib/export';
import { getApiKey, getModel } from '@/lib/storage';
import { Block, AVAILABLE_MODELS } from '@/types';

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
}: ToolbarProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(projectName);
    const [modelLabel, setModelLabel] = useState('');
    const [hasKey, setHasKey] = useState(false);
    const [showSaved, setShowSaved] = useState(false);

    useEffect(() => {
        const model = getModel();
        const info = AVAILABLE_MODELS.find((m) => m.id === model);
        setModelLabel(info?.label || model);
        setHasKey(!!getApiKey());
    }, []);

    const handleSave = () => {
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

    return (
        <div className="toolbar">
            <div className="toolbar-left">
                <button onClick={onOpenProjects} className="toolbar-btn" title="Projects">
                    <FolderOpen size={18} />
                </button>

                <div className="toolbar-divider" />

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

            <div className="toolbar-center">
                <div className={`model-badge ${hasKey ? 'premium' : 'free'}`}>
                    <Zap size={12} />
                    {hasKey ? modelLabel : 'Free Mode'}
                </div>
            </div>

            <div className="toolbar-right">
                <button onClick={onNewProject} className="toolbar-btn" title="New Project">
                    <Plus size={18} />
                </button>

                <button onClick={handleSave} className="toolbar-btn save-btn" title="Save">
                    {showSaved ? <Check size={18} /> : <Save size={18} />}
                    <span className="btn-label">{showSaved ? 'Saved!' : 'Save'}</span>
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

                {blocks.length > 0 && (
                    <button onClick={onClearAll} className="toolbar-btn" title="Clear All">
                        <Trash2 size={18} />
                    </button>
                )}

                <div className="toolbar-divider" />

                <button onClick={onOpenSettings} className="toolbar-btn settings-btn" title="Settings">
                    <Settings size={18} />
                </button>
            </div>
        </div>
    );
}
