'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Block } from '@/types';
import { Copy, Check, Pencil, Save, X } from 'lucide-react';

interface ConsoleLine {
  type: 'log' | 'warn' | 'error' | 'info';
  args: string;
  timestamp: number;
}

interface PreviewPanelProps {
  blocks: Block[];
  selectedBlockId: string | null;
  mobilePreview: boolean;
  designStyle?: string;
  viewMode: 'preview' | 'code' | 'console';
  onCodeSave?: (sectionsHtml: string) => void;
}

// Map design style to body background color
const STYLE_BODY_BG: Record<string, string> = {
  professional: '#f8fafc',
  playful: '#fefce8',
  minimal: '#ffffff',
  bold: '#0a0a0a',
  elegant: '#1e293b',
};

export default function PreviewPanel({ blocks, selectedBlockId, mobilePreview, designStyle, viewMode, onCodeSave }: PreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLine[]>([]);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const editRef = useRef<HTMLTextAreaElement>(null);
  const editHighlightRef = useRef<HTMLPreElement>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen for console messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.__crushable_console) {
        const { type, args } = event.data;
        setConsoleLogs((prev) => [
          ...prev,
          { type, args, timestamp: Date.now() },
        ]);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Auto-scroll console
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLogs]);

  // Clear console when blocks change
  const clearConsole = useCallback(() => setConsoleLogs([]), []);

  const htmlContent = useMemo(() => {
    const sectionsHtml = blocks.map((b) => b.html).join('\n\n');

    // Console interceptor script
    const consoleInterceptor = `
    <script>
      (function() {
        var origConsole = {};
        ['log', 'warn', 'error', 'info'].forEach(function(method) {
          origConsole[method] = console[method];
          console[method] = function() {
            var args = Array.prototype.slice.call(arguments).map(function(a) {
              try { return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); }
              catch(e) { return String(a); }
            }).join(' ');
            origConsole[method].apply(console, arguments);
            window.parent.postMessage({ __crushable_console: true, type: method, args: args }, '*');
          };
        });
        window.onerror = function(msg, url, line, col, error) {
          window.parent.postMessage({ __crushable_console: true, type: 'error', args: msg + ' (line ' + line + ')' }, '*');
        };
      })();
    ${'<'}/script>`;

    return `<!DOCTYPE html>
<html lang="en" style="scroll-behavior: smooth;">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <base target="_blank" />
  <script src="https://cdn.tailwindcss.com">${'<'}/script>
  <script src="https://unpkg.com/lucide@latest">${'<'}/script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
  ${consoleInterceptor}
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; margin: 0; cursor: default; background: ${STYLE_BODY_BG[designStyle || ''] || '#ffffff'}; }
    .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 100vh; color: #94a3b8; background: #f8fafc;
      font-size: 1.1rem; gap: 8px;
    }
    .empty-state svg { width: 48px; height: 48px; stroke: #cbd5e1; }
  </style>
</head>
<body>
${blocks.length === 0 ? `
<div class="empty-state">
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
  <span>Start chatting to build your page</span>
  <span style="font-size:0.85rem;color:#64748b;">Sections will appear here as you create them</span>
</div>
` : sectionsHtml}
<script>
  lucide.createIcons();
  // Intercept anchor link clicks so they scroll within the iframe
  // (base target="_blank" would otherwise open them in a new tab)
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
  });
${'<'}/script>
</body>
</html>`;
  }, [blocks]);

  const previewDocKey = useMemo(
    () => blocks.map((block) => `${block.id}:${block.html}`).join('|||'),
    [blocks]
  );

  // Full HTML document for code view
  const fullDocumentCode = useMemo(() => {
    if (blocks.length === 0) return '<!-- No sections yet. Start chatting to build your page. -->';

    const sectionsHtml = blocks.map((b) => b.html).join('\n\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Landing Page</title>
  <script src="https://cdn.tailwindcss.com">${'<'}/script>
  <script src="https://unpkg.com/lucide@latest">${'<'}/script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; margin: 0; }
  </style>
</head>
<body>
${sectionsHtml}
<script>
  lucide.createIcons();
${'<'}/script>
</body>
</html>`;
  }, [blocks]);

  // Load Prism.js
  const loadPrism = useCallback(async () => {
    if (!(window as unknown as Record<string, unknown>).Prism) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';
      document.head.appendChild(link);

      await new Promise<void>((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js';
        script.onload = () => resolve();
        document.head.appendChild(script);
      });

      await new Promise<void>((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-markup.min.js';
        script.onload = () => resolve();
        document.head.appendChild(script);
      });
    }
    return (window as unknown as Record<string, unknown>).Prism as { highlightElement: (el: HTMLElement) => void; highlight: (code: string, grammar: unknown, language: string) => string; languages: Record<string, unknown> };
  }, []);

  // Highlight read-only code view
  useEffect(() => {
    if (viewMode !== 'code' || isEditing || !codeRef.current) return;
    loadPrism().then(Prism => {
      if (Prism && codeRef.current) Prism.highlightElement(codeRef.current);
    });
  }, [viewMode, fullDocumentCode, isEditing, loadPrism]);

  // Highlight edit view (update the backdrop)
  useEffect(() => {
    if (!isEditing || viewMode !== 'code' || !editHighlightRef.current) return;
    loadPrism().then(Prism => {
      if (Prism && editHighlightRef.current) {
        const highlighted = Prism.highlight(editContent + '\n', Prism.languages['markup'], 'markup');
        const codeEl = editHighlightRef.current.querySelector('code');
        if (codeEl) codeEl.innerHTML = highlighted;
      }
    });
  }, [isEditing, editContent, viewMode, loadPrism]);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(fullDocumentCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }, [fullDocumentCode]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  if (!mounted) {
    return (
      <div className="preview-panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
          Loading preview...
        </div>
      </div>
    );
  }

  return (
    <div className="preview-panel">

      {viewMode === 'preview' ? (
        <div className={`preview-container ${mobilePreview ? 'mobile' : ''}`}>
          <iframe
            ref={iframeRef}
            key={previewDocKey}
            srcDoc={htmlContent}
            title="Page Preview"
            sandbox="allow-scripts allow-same-origin"
            className="preview-iframe"
          />
        </div>
      ) : viewMode === 'code' ? (
        <div className="code-view">
          <div className="code-toolbar">
            <span className="code-lang-badge">HTML</span>
            <div className="code-toolbar-actions">
              {isEditing ? (
                <>
                  <button onClick={() => {
                    if (onCodeSave) onCodeSave(editContent);
                    setIsEditing(false);
                  }} className="code-save-btn">
                    <Save size={14} /> Save
                  </button>
                  <button onClick={() => setIsEditing(false)} className="code-discard-btn">
                    <X size={14} /> Discard
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => {
                    const sectionsHtml = blocks.map(b => b.html).join('\n\n');
                    setEditContent(sectionsHtml);
                    setIsEditing(true);
                    setTimeout(() => editRef.current?.focus(), 50);
                  }} className="code-copy-btn">
                    <Pencil size={14} /> Edit
                  </button>
                  <button onClick={handleCopyCode} className="code-copy-btn">
                    {codeCopied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                  </button>
                </>
              )}
            </div>
          </div>
          {isEditing ? (
            <div className="code-editor-wrapper">
              <pre ref={editHighlightRef} className="code-editor-highlight" aria-hidden="true">
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
            <pre className="code-highlighted"><code ref={codeRef} className="language-markup">{fullDocumentCode}</code></pre>
          )}
        </div>
      ) : (
        <div className="console-view">
          <div className="console-toolbar">
            <button onClick={clearConsole} className="console-clear-btn">Clear</button>
          </div>
          <div className="console-logs">
            {consoleLogs.length === 0 ? (
              <div className="console-empty">No console output yet. Logs from your generated code will appear here.</div>
            ) : (
              consoleLogs.map((log, i) => (
                <div key={i} className={`console-line console-${log.type}`}>
                  <span className="console-time">{formatTime(log.timestamp)}</span>
                  <span className={`console-type-badge ${log.type}`}>{log.type.toUpperCase()}</span>
                  <span className="console-text">{log.args}</span>
                </div>
              ))
            )}
            <div ref={consoleEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
