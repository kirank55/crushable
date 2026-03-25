'use client';

import { X, History } from 'lucide-react';

interface VersionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VersionsPanel({ isOpen, onClose }: VersionsPanelProps) {
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
          <div className="no-versions">
            <p>No versions yet</p>
            <p className="hint">Generate or edit a section and Crushable will snapshot the page automatically.</p>
          </div>
        </div>
      </div>
    </>
  );
}
