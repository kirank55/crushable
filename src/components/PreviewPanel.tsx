'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Copy, Check, Save, X, Pencil } from 'lucide-react';
import { usePageStateContext } from '@/context/PageStateContext';
import { generateFullHTML } from '@/lib/export';
import { parseImportedHtml } from '@/lib/import';
import { Block } from '@/types';

// ─── Prism.js loader ─────────────────────────────────────────────

type PrismAPI = {
  highlight: (code: string, grammar: unknown, language: string) => string;
  highlightElement: (el: Element) => void;
  languages: Record<string, unknown>;
};

function loadPrism(): Promise<PrismAPI> {
  return new Promise((resolve) => {
    if ((window as unknown as Record<string, unknown>).Prism) {
      resolve((window as unknown as Record<string, PrismAPI>).Prism);
      return;
    }

    // Load Prism CSS theme
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';
    document.head.appendChild(link);

    // Load Prism JS
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js';
    script.onload = () => {
      // Load HTML/markup language component
      const langScript = document.createElement('script');
      langScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-markup.min.js';
      langScript.onload = () => {
        resolve((window as unknown as Record<string, PrismAPI>).Prism);
      };
      document.head.appendChild(langScript);
    };
    document.head.appendChild(script);
  });
}

// ─── Empty state HTML ────────────────────────────────────────────

const EMPTY_STATE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; margin: 0; }
    .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 100vh; color: #64748b;
      background: radial-gradient(circle at top, rgba(56, 189, 248, 0.08), transparent 24%),
        linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
      font-size: 1.1rem; gap: 10px;
    }
    .empty-state svg { width: 52px; height: 52px; stroke: #94a3b8; }
  </style>
</head>
<body>
  <div class="empty-state">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
    <span>Start chatting to build your page</span>
    <span style="font-size:0.85rem;color:#64748b;">Sections will appear here as you create them</span>
  </div>
</body>
</html>`;

// ─── Preview HTML builder ────────────────────────────────────────

function buildPreviewHtml(blocks: Block[]): string {
  const visibleBlocks = blocks.filter((b) => b.visible !== false);
  if (visibleBlocks.length === 0) return EMPTY_STATE_HTML;
  const body = visibleBlocks.map((b) => b.html).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <base target="_blank" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    html { scroll-behavior: smooth; font-family: 'Inter', system-ui, sans-serif; }
  </style>
</head>
<body>
  ${body}
  <script>
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
    document.addEventListener('click', function(e) {
      var link = e.target.closest('a[href^="#"]');
      if (link) {
        e.preventDefault();
        var targetId = link.getAttribute('href').substring(1);
        var target = document.getElementById(targetId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }, true);
  </script>
</body>
</html>`;
}

// ─── Component ───────────────────────────────────────────────────

export default function PreviewPanel() {
  const { blocks, viewMode, mobilePreview, projectName, replaceAllBlocks } =
    usePageStateContext();

  const [codeCopied, setCodeCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  const codeRef = useRef<HTMLElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const editHighlightRef = useRef<HTMLPreElement>(null);

  const srcDoc = buildPreviewHtml(blocks);

  // Full HTML for code view (read-only display)
  const fullDocumentCode = useMemo(() => {
    if (blocks.length === 0) return '<!-- No sections yet. Start chatting to build your page. -->';
    const visibleBlocks = blocks.filter((b) => b.visible !== false);
    if (visibleBlocks.length === 0) return '<!-- All sections are hidden in preview. -->';
    return generateFullHTML(blocks, projectName);
  }, [blocks, projectName]);

  // Syntax highlight the read-only code view
  useEffect(() => {
    if (viewMode !== 'code' || isEditing || !codeRef.current) return;
    loadPrism().then((Prism) => {
      if (codeRef.current) {
        Prism.highlightElement(codeRef.current);
      }
    });
  }, [viewMode, fullDocumentCode, isEditing]);

  // Syntax highlight the edit backdrop
  useEffect(() => {
    if (!isEditing || viewMode !== 'code' || !editHighlightRef.current) return;
    loadPrism().then((Prism) => {
      if (editHighlightRef.current) {
        const highlighted = Prism.highlight(
          editContent + '\n',
          Prism.languages['markup'],
          'markup',
        );
        const codeEl = editHighlightRef.current.querySelector('code');
        if (codeEl) codeEl.innerHTML = highlighted;
      }
    });
  }, [isEditing, editContent, viewMode]);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(fullDocumentCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }, [fullDocumentCode]);

  const handleStartEditing = useCallback(() => {
    // Edit only the section HTML (not the full document wrapper)
    const sectionsHtml = blocks.map((b) => b.html).join('\n\n');
    setEditContent(sectionsHtml);
    setIsEditing(true);
    setTimeout(() => editRef.current?.focus(), 50);
  }, [blocks]);

  const handleSaveCode = useCallback(() => {
    const parsed = parseImportedHtml(editContent);
    if (parsed.length > 0) {
      replaceAllBlocks(parsed);
    }
    setIsEditing(false);
  }, [editContent, replaceAllBlocks]);

  const handleDiscardEdits = useCallback(() => {
    setIsEditing(false);
    setEditContent('');
  }, []);

  return (
    <div className="preview-panel">
      {viewMode === 'preview' ? (
        <div className={`preview-container ${mobilePreview ? 'mobile' : ''}`}>
          <div className={`preview-stage ${mobilePreview ? 'mobile' : 'desktop'}`}>
            <div className={`preview-frame ${mobilePreview ? 'mobile' : ''}`}>
              {mobilePreview && (
                <div className="preview-device-chrome" aria-hidden="true">
                  <span className="preview-device-notch" />
                </div>
              )}
              <iframe
                srcDoc={srcDoc}
                title="Page Preview"
                sandbox="allow-scripts allow-same-origin"
                className="preview-iframe"
              />
            </div>
          </div>
        </div>
      ) : viewMode === 'code' ? (
        <div className="code-view">
          <div className="code-toolbar">
            <div className="code-toolbar-meta">
              <span className="code-lang-badge">HTML</span>
              <span className="code-toolbar-hint">
                {isEditing
                  ? 'Edit sections directly and save to rebuild the block list.'
                  : 'Exportable HTML — click Edit to modify.'}
              </span>
            </div>
            <div className="code-toolbar-actions">
              {isEditing ? (
                <>
                  <button
                    onClick={handleSaveCode}
                    className="code-save-btn"
                  >
                    <Save size={14} /> Save
                  </button>
                  <button
                    onClick={handleDiscardEdits}
                    className="code-discard-btn"
                  >
                    <X size={14} /> Discard
                  </button>
                </>
              ) : (
                <>
                  <button onClick={handleStartEditing} className="code-copy-btn">
                    <Pencil size={14} /> Edit
                  </button>
                  <button onClick={handleCopyCode} className="code-copy-btn">
                    {codeCopied
                      ? <><Check size={14} /> Copied</>
                      : <><Copy size={14} /> Copy</>}
                  </button>
                </>
              )}
            </div>
          </div>
          {isEditing ? (
            <div className="code-editor-wrapper">
              <pre
                ref={editHighlightRef}
                className="code-editor-highlight"
                aria-hidden="true"
              >
                <code className="language-markup"></code>
              </pre>
              <textarea
                ref={editRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onScroll={(e) => {
                  if (editHighlightRef.current) {
                    editHighlightRef.current.scrollTop = e.currentTarget.scrollTop;
                    editHighlightRef.current.scrollLeft = e.currentTarget.scrollLeft;
                  }
                }}
                className="code-editor"
                spellCheck={false}
              />
            </div>
          ) : (
            <pre className="code-highlighted">
              <code ref={codeRef} className="language-markup">
                {fullDocumentCode}
              </code>
            </pre>
          )}
        </div>
      ) : (
        <div className="console-view">
          <div className="console-empty">Console output will appear here.</div>
        </div>
      )}
    </div>
  );
}
