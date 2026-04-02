'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Download,
  Save,
  Settings,
  ArrowLeft,
  Check,
  Upload,
  History,
  PanelLeftClose,
  MessageSquare,
  Eye,
  Code,
  Terminal,
  ExternalLink,
  Monitor,
  Smartphone,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { usePageStateContext } from '@/context/PageStateContext';
import { downloadHTML, generateFullHTML } from '@/lib/export';
import { readFileAsText, parseImportedHtml } from '@/lib/import';
import { logger } from '@/lib/logger';

// ─── Helpers ────────────────────────────────────────────────────

function formatSavedTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getSaveStateCopy(
  isDirty: boolean,
  showSaved: boolean,
  lastSavedAt: number | null,
): { label: string } {
  if (isDirty) return { label: 'Unsaved changes' };
  if (showSaved) return { label: 'Saved ✓' };
  if (lastSavedAt) return { label: `Saved at ${formatSavedTime(lastSavedAt)}` };
  return { label: 'All changes saved' };
}

// ─── Component ──────────────────────────────────────────────────

export default function Toolbar() {
  const router = useRouter();
  const {
    blocks,
    projectName,
    isDirty,
    handleSave: onSave,
    handleRename: onRename,
    toggleVersions,
    replaceAllBlocks,
    viewMode,
    setViewMode,
    mobilePreview,
    setMobilePreview,
  } = usePageStateContext();

  // ── Local state ─────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(projectName);
  const [showSaved, setShowSaved] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [chatVisible, setChatVisible] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync editName when projectName changes externally
  useEffect(() => {
    setEditName(projectName);
  }, [projectName]);

  // ── Handlers ──────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    logger.action('Toolbar save');
    onSave();
    setLastSavedAt(Date.now());
    setShowSaved(true);
    setTimeout(() => setShowSaved(false), 2000);
  }, [onSave]);

  const handleRename = useCallback(() => {
    if (editName.trim()) {
      onRename(editName.trim());
    }
    setIsEditing(false);
  }, [editName, onRename]);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    logger.action('Toolbar import', { fileName: file.name });

    const confirmed = window.confirm(
      'Only import code generated with Crushable.\n\nImporting code from other sources may not work correctly. Continue?',
    );

    if (!confirmed) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      const html = await readFileAsText(file);
      const importedBlocks = parseImportedHtml(html);

      if (importedBlocks.length === 0) {
        alert(
          'No Crushable sections found in this file. Make sure the file contains <section data-block-id="..."> elements.',
        );
        return;
      }

      replaceAllBlocks(importedBlocks);
      logger.action('Import successful', { blocksImported: importedBlocks.length });
    } catch (err) {
      logger.error('Import', err);
      alert('Failed to import file.');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [replaceAllBlocks]);

  const handleOpenInNewTab = useCallback(() => {
    const html = generateFullHTML(blocks, projectName);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, [blocks, projectName]);

  const saveState = getSaveStateCopy(isDirty, showSaved, lastSavedAt);

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button
          className="toolbar-btn"
          title="Back to Projects"
          onClick={() => router.push('/')}
        >
          <ArrowLeft size={18} />
          <span className="btn-label">Projects</span>
        </button>

        <div className="toolbar-divider" />
        <div className="project-identity">
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
              onClick={() => {
                setEditName(projectName);
                setIsEditing(true);
              }}
              className="project-name-btn"
            >
              {projectName}
            </button>
          )}
          <div className={`save-state ${isDirty ? 'dirty' : 'clean'}`}>
            <span className="save-state-label">{saveState.label}</span>
          </div>
        </div>

        <div className="toolbar-actions toolbar-actions-inline">
          <button className="header-action-btn" title="Versions" onClick={toggleVersions}>
            <History size={16} />
          </button>
          {/*
          {chatVisible ? (
            <button
              className="header-action-btn"
              title="Hide Chat"
              onClick={() => setChatVisible(false)}
            >
              <PanelLeftClose size={16} />
            </button>
          ) : (
            <button
              className="header-action-btn"
              title="Show Chat"
              onClick={() => setChatVisible(true)}
            >
              <MessageSquare size={16} />
            </button>
          )}
          */}
        </div>
      </div>

      <div className="toolbar-center">
        <div className="preview-tabs">
          <button
            onClick={() => setViewMode('preview')}
            className={`preview-tab ${viewMode === 'preview' ? 'active' : ''}`}
          >
            <Eye size={14} />
            Preview
          </button>
          <button
            onClick={() => setViewMode('code')}
            className={`preview-tab ${viewMode === 'code' ? 'active' : ''}`}
          >
            <Code size={14} />
            Code
          </button>
          <button
            onClick={() => setViewMode('console')}
            className={`preview-tab ${viewMode === 'console' ? 'active' : ''}`}
          >
            <Terminal size={14} />
            Console
          </button>
        </div>
      </div>

      <div className="toolbar-right">
        <div className="toolbar-utility-group">
          {viewMode === 'preview' && (
            <>
              <button
                onClick={() => setMobilePreview(false)}
                className={`toolbar-btn ${!mobilePreview ? 'active-toolbar-btn' : ''}`}
                title="Desktop preview"
              >
                <Monitor size={16} />
                <span className="btn-label">Desktop</span>
              </button>
              <button
                onClick={() => setMobilePreview(true)}
                className={`toolbar-btn ${mobilePreview ? 'active-toolbar-btn' : ''}`}
                title="Mobile preview"
              >
                <Smartphone size={16} />
                <span className="btn-label">Mobile</span>
              </button>
            </>
          )}
          <button
            onClick={handleOpenInNewTab}
            className="toolbar-btn"
            title="Open Preview in New Tab"
            disabled={blocks.length === 0}
          >
            <ExternalLink size={16} />
            <span className="btn-label">Preview in new tab</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm"
            onChange={handleImport}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="toolbar-btn"
            title="Import HTML"
          >
            <Upload size={18} />
            <span className="btn-label">Import</span>
          </button>
          <button
            onClick={() => downloadHTML(blocks, projectName)}
            className="toolbar-btn download-btn"
            disabled={blocks.length === 0}
            title="Download HTML"
          >
            <Download size={18} />
            <span className="btn-label">Export</span>
          </button>
        </div>

        <div className="toolbar-primary-group">
          {/*
          <button className="toolbar-btn settings-btn" title="Model Settings">
            <Settings size={18} />
            <span className="btn-label">Model</span>
          </button>
          */}
          <button
            onClick={handleSave}
            className="toolbar-btn save-btn"
            title="Save"
          >
            {showSaved ? <Check size={18} /> : <Save size={18} />}
            <span className="btn-label">{showSaved ? 'Saved!' : 'Save now'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
