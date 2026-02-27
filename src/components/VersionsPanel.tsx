'use client';

import { Version } from '@/types';
import { X, Clock, History, RotateCcw } from 'lucide-react';

interface VersionsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    versions: Version[];
    onLoadVersion: (version: Version, index?: number) => void;
    onRestoreCurrent?: () => void;
}

export default function VersionsPanel({
    isOpen,
    onClose,
    versions,
    onLoadVersion,
    onRestoreCurrent,
}: VersionsPanelProps) {
    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString();
    };

    return (
        <>
            {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
            <div className={`versions-sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-title">
                        <History size={18} />
                        <span>Versions</span>
                    </div>
                    <button onClick={onClose} className="sidebar-close">
                        <X size={18} />
                    </button>
                </div>

                <div className="versions-list">
                    {versions.length === 0 ? (
                        <div className="no-versions">
                            <p>No versions yet</p>
                            <p className="hint">Versions are created automatically after each generation.</p>
                        </div>
                    ) : (
                        <>
                            {/* Current working state button */}
                            {onRestoreCurrent && (
                                <button
                                    onClick={() => { onRestoreCurrent(); onClose(); }}
                                    className="version-item current"
                                >
                                    <div className="version-info">
                                        <span className="version-label">
                                            <RotateCcw size={14} />
                                            Current (working state)
                                            <span className="version-badge">Live</span>
                                        </span>
                                        <span className="version-meta">
                                            Restore the latest working blocks
                                        </span>
                                    </div>
                                </button>
                            )}
                            {versions.slice().reverse().map((version, revIndex) => {
                                const actualIndex = versions.length - 1 - revIndex;
                                return (
                                    <button
                                        key={version.id}
                                        onClick={() => { onLoadVersion(version, actualIndex); onClose(); }}
                                        className={`version-item ${revIndex === 0 ? 'latest' : ''}`}
                                    >
                                        <div className="version-info">
                                            <span className="version-label">
                                                {version.label}
                                                {revIndex === 0 && <span className="version-badge">Latest</span>}
                                            </span>
                                            <span className="version-meta">
                                                <Clock size={12} />
                                                {formatDate(version.timestamp)}
                                                <span className="version-blocks">{version.blocks.length} section{version.blocks.length !== 1 ? 's' : ''}</span>
                                            </span>
                                            {version.prompt && (
                                                <span className="version-prompt">&ldquo;{version.prompt.slice(0, 60)}{version.prompt.length > 60 ? '...' : ''}&rdquo;</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
