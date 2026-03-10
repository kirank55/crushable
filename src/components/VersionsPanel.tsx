'use client';

import { Version } from '@/types';
import { X, Clock, History, RotateCcw, Sparkles } from 'lucide-react';
import { formatRelativeDate } from '@/lib/date';

interface VersionsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    versions: Version[];
    currentVersionIndex: number | null;
    onLoadVersion: (version: Version, index?: number) => void;
    onRestoreCurrent?: () => void;
}

export default function VersionsPanel({
    isOpen,
    onClose,
    versions,
    currentVersionIndex,
    onLoadVersion,
    onRestoreCurrent,
}: VersionsPanelProps) {
    return (
        <>
            {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
            <div className={`versions-sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-title">
                        <History size={18} />
                        <div>
                            <span>Versions</span>
                            <p className="sidebar-subtitle">Jump between snapshots with clear live-versus-history context.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="sidebar-close">
                        <X size={18} />
                    </button>
                </div>

                <div className="versions-list">
                    {versions.length === 0 ? (
                        <div className="no-versions">
                            <Sparkles size={26} strokeWidth={1.5} />
                            <p>No versions yet</p>
                            <p className="hint">Generate or edit a section and Crushable will snapshot the page automatically.</p>
                        </div>
                    ) : (
                        <>
                            {/* Current working state button */}
                            {onRestoreCurrent && (
                                <button
                                    onClick={() => { onRestoreCurrent(); onClose(); }}
                                    className={`version-item current ${currentVersionIndex === null ? 'active' : ''}`}
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
                                        className={`version-item ${revIndex === 0 ? 'latest' : ''} ${currentVersionIndex === actualIndex ? 'active' : ''}`}
                                    >
                                        <div className="version-info">
                                            <span className="version-label">
                                                {version.label}
                                                {revIndex === 0 && <span className="version-badge">Latest</span>}
                                            </span>
                                            <span className="version-meta">
                                                <Clock size={12} />
                                                {formatRelativeDate(version.timestamp)}
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
