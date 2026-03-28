'use client';

import { X, History } from 'lucide-react';
import { Version } from '@/types';
import { formatRelativeDate } from '@/lib/date';

interface VersionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  versions: Version[];
  currentVersionIndex: number | null;
  onLoadVersion: (version: Version, index: number) => void;
  onRestoreCurrent: () => void;
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
      {isOpen && (
        <>

          <div
            className="sidebar-overlay"
            onClick={onClose}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') onClose(); }}
            aria-label="Close versions panel"
          />
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
                  <p>No versions yet</p>
                  <p className="hint">Generate or edit a section and Crushable will snapshot the page automatically.</p>
                </div>
              ) : (
                <>
                  {currentVersionIndex !== null && (
                    <button className="restore-current-btn" onClick={onRestoreCurrent}>
                      ↩ Back to current version
                    </button>
                  )}
                  {[...versions].reverse().map((version, reversedIndex) => {
                    const index = versions.length - 1 - reversedIndex;
                    const isActive = currentVersionIndex === index;
                    return (
                      <button
                        key={version.id}
                        className={`version-item ${isActive ? 'active' : ''}`}
                        onClick={() => onLoadVersion(version, index)}
                      >
                        <span className="version-label">{version.label}</span>
                        <span className="version-time">{formatRelativeDate(version.timestamp)}</span>
                        {version.prompt && (
                          <span className="version-prompt">{version.prompt.slice(0, 60)}…</span>
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>

        </>
      )}

    </>
  );
}
