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
  mobilePreview: boolean;
  designStyle?: string;
  selectedBlockId?: string | null;
  viewMode: 'preview' | 'code' | 'console';
  onSelectBlock?: (blockId: string) => void;
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

export default function PreviewPanel({
  blocks,
  mobilePreview,
  designStyle,
  selectedBlockId,
  viewMode,
  onSelectBlock,
  onCodeSave,
}: PreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLine[]>([]);
  const [iframeLoadTick, setIframeLoadTick] = useState(0);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const editRef = useRef<HTMLTextAreaElement>(null);
  const editHighlightRef = useRef<HTMLPreElement>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const lastAppliedSelectionRef = useRef<string | null>(null);
  const visibleBlocks = useMemo(
    () => blocks.filter((block) => block.visible !== false),
    [blocks]
  );

  const selectedBlockHtml = useMemo(
    () => blocks.find((block) => block.id === selectedBlockId)?.html ?? '',
    [blocks, selectedBlockId]
  );

  const postPreviewCommand = useCallback(
    (
      command:
        | { type: 'focus-block'; blockId: string; flash?: boolean; scroll?: boolean }
        | { type: 'clear-selection' }
    ) => {
      iframeRef.current?.contentWindow?.postMessage(
        { __crushable_preview_command: true, ...command },
        '*'
      );
    },
    []
  );

  // Listen for console messages from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (iframeWindow && event.source !== iframeWindow) return;

      if (event.data && event.data.__crushable_console) {
        const { type, args } = event.data;
        setConsoleLogs((prev) => [
          ...prev,
          { type, args, timestamp: Date.now() },
        ]);
        return;
      }

      if (
        event.data &&
        event.data.__crushable_preview &&
        event.data.type === 'select-block' &&
        typeof event.data.blockId === 'string'
      ) {
        onSelectBlock?.(event.data.blockId);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSelectBlock]);

  // Auto-scroll console
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLogs]);

  // Clear console when blocks change
  const clearConsole = useCallback(() => setConsoleLogs([]), []);

  const htmlContent = useMemo(() => {
    const sectionsHtml = visibleBlocks.map((block) => block.html).join('\n\n');

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

    const previewInteractionScript = `
      (function() {
        var flashTimer = null;
        var hoveredBlock = null;
        var selectedBlock = null;

        function createOverlay(kind) {
          var overlay = document.createElement('div');
          overlay.className = 'crushable-block-overlay ' + kind;

          var badge = document.createElement('div');
          badge.className = 'crushable-block-badge';
          overlay.appendChild(badge);

          document.body.appendChild(overlay);
          return overlay;
        }

        function getBadge(overlay) {
          return overlay.firstChild;
        }

        function getBlockId(block) {
          return block ? block.getAttribute('data-block-id') || '' : '';
        }

        function findBlock(target) {
          return target && target.closest ? target.closest('[data-block-id]') : null;
        }

        function hideOverlay(overlay) {
          overlay.style.opacity = '0';
          overlay.style.width = '0px';
          overlay.style.height = '0px';
        }

        function positionOverlay(overlay, block) {
          if (!block || !document.body.contains(block)) {
            hideOverlay(overlay);
            return;
          }

          var rect = block.getBoundingClientRect();
          overlay.style.opacity = '1';
          overlay.style.left = window.scrollX + rect.left + 'px';
          overlay.style.top = window.scrollY + rect.top + 'px';
          overlay.style.width = Math.max(rect.width, 0) + 'px';
          overlay.style.height = Math.max(rect.height, 0) + 'px';
          getBadge(overlay).textContent = getBlockId(block) || 'section';
        }

        var hoverOverlay = createOverlay('hover');
        var selectedOverlay = createOverlay('selected');

        function syncOverlays() {
          positionOverlay(hoverOverlay, hoveredBlock && hoveredBlock !== selectedBlock ? hoveredBlock : null);
          positionOverlay(selectedOverlay, selectedBlock);
        }

        function setHovered(block) {
          hoveredBlock = block === selectedBlock ? null : block;
          syncOverlays();
        }

        function setSelected(block, shouldFlash) {
          selectedBlock = block;
          if (hoveredBlock === block) hoveredBlock = null;
          syncOverlays();

          if (shouldFlash && block) {
            selectedOverlay.classList.remove('flash');
            void selectedOverlay.offsetWidth;
            selectedOverlay.classList.add('flash');
            window.clearTimeout(flashTimer);
            flashTimer = window.setTimeout(function() {
              selectedOverlay.classList.remove('flash');
            }, 900);
          }
        }

        document.addEventListener('mouseover', function(event) {
          var block = findBlock(event.target);
          if (block !== hoveredBlock) {
            setHovered(block);
          }
        });

        document.addEventListener('mouseout', function(event) {
          if (!hoveredBlock) return;
          var nextTarget = event.relatedTarget;
          if (nextTarget && hoveredBlock.contains(nextTarget)) return;
          setHovered(null);
        });

        document.addEventListener('click', function(event) {
          var block = findBlock(event.target);
          if (!block) return;

          event.preventDefault();
          event.stopPropagation();

          setSelected(block, true);
          window.parent.postMessage(
            {
              __crushable_preview: true,
              type: 'select-block',
              blockId: getBlockId(block),
            },
            '*'
          );
        }, true);

        window.addEventListener('message', function(event) {
          var data = event.data;
          if (!data || !data.__crushable_preview_command) return;

          if (data.type === 'clear-selection') {
            selectedBlock = null;
            syncOverlays();
            return;
          }

          if (data.type !== 'focus-block' || !data.blockId) return;

          var block = Array.prototype.slice
            .call(document.querySelectorAll('[data-block-id]'))
            .find(function(candidate) {
              return candidate.getAttribute('data-block-id') === data.blockId;
            });

          if (!block) return;

          setSelected(block, data.flash !== false);
          if (data.scroll !== false) {
            block.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            window.setTimeout(syncOverlays, 250);
          }
        });

        window.addEventListener('scroll', syncOverlays, { passive: true });
        window.addEventListener('resize', syncOverlays);
      })();
    `;

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
    body { font-family: 'Inter', system-ui, sans-serif; margin: 0; cursor: default; background:
      radial-gradient(circle at top, rgba(56, 189, 248, 0.08), transparent 24%),
      ${STYLE_BODY_BG[designStyle || ''] || '#ffffff'}; }
    [data-block-id] { cursor: pointer; }
    .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      min-height: 100vh; color: #64748b; background:
      radial-gradient(circle at top, rgba(56, 189, 248, 0.08), transparent 24%),
      linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
      font-size: 1.1rem; gap: 10px;
    }
    .empty-state svg { width: 52px; height: 52px; stroke: #94a3b8; }
    .crushable-block-overlay {
      position: absolute;
      pointer-events: none;
      border-radius: 18px;
      opacity: 0;
      z-index: 2147483647;
      transition: opacity 0.16s ease, transform 0.16s ease;
    }
    .crushable-block-overlay.hover {
      border: 2px dashed rgba(59, 130, 246, 0.52);
      background: rgba(59, 130, 246, 0.08);
    }
    .crushable-block-overlay.selected {
      border: 2px solid rgba(139, 92, 246, 0.95);
      background: rgba(139, 92, 246, 0.12);
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.5), 0 18px 32px rgba(76, 29, 149, 0.2);
    }
    .crushable-block-badge {
      position: absolute;
      top: -14px;
      left: 12px;
      padding: 4px 8px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.94);
      color: #eff6ff;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.01em;
      text-transform: capitalize;
      box-shadow: 0 8px 16px rgba(15, 23, 42, 0.28);
    }
    .crushable-block-overlay.flash {
      animation: crushable-preview-pulse 0.9s ease;
    }
    @keyframes crushable-preview-pulse {
      0% { transform: scale(0.995); }
      35% { transform: scale(1.006); }
      100% { transform: scale(1); }
    }
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
` : visibleBlocks.length === 0 ? `
<div class="empty-state">
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c1.955 0 3.832-.533 5.449-1.473M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.774 3.162 10.066 7.5a10.522 10.522 0 0 1-4.293 5.568M6.228 6.228 3 3m3.228 3.228 11.544 11.544" />
  </svg>
  <span>All sections are hidden in preview</span>
  <span style="font-size:0.85rem;color:#64748b;">Use the Sections panel to show them again</span>
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
${previewInteractionScript}
${'<'}/script>
</body>
</html>`;
  }, [blocks.length, designStyle, visibleBlocks]);

  const previewDocKey = useMemo(
    () => visibleBlocks.map((block) => `${block.id}:${block.visible !== false}:${block.html}`).join('|||'),
    [visibleBlocks]
  );

  useEffect(() => {
    lastAppliedSelectionRef.current = null;
  }, [iframeLoadTick]);

  useEffect(() => {
    if (viewMode !== 'preview' || iframeLoadTick === 0) return;

    const nextSelectionSignature = selectedBlockId
      ? `${selectedBlockId}:${selectedBlockHtml}`
      : 'none';

    if (nextSelectionSignature === lastAppliedSelectionRef.current) return;

    const timer = window.setTimeout(() => {
      if (selectedBlockId) {
        postPreviewCommand({
          type: 'focus-block',
          blockId: selectedBlockId,
          flash: true,
          scroll: true,
        });
      } else {
        postPreviewCommand({ type: 'clear-selection' });
      }

      lastAppliedSelectionRef.current = nextSelectionSignature;
    }, 60);

    return () => window.clearTimeout(timer);
  }, [iframeLoadTick, postPreviewCommand, selectedBlockHtml, selectedBlockId, viewMode]);

  // Full HTML document for code view
  const fullDocumentCode = useMemo(() => {
    if (blocks.length === 0) return '<!-- No sections yet. Start chatting to build your page. -->';
    if (visibleBlocks.length === 0) return '<!-- All sections are hidden in preview. -->';

    const sectionsHtml = visibleBlocks.map((block) => block.html).join('\n\n');

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
  }, [blocks.length, visibleBlocks]);

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

  return (
    <div className="preview-panel">

      {viewMode === 'preview' ? (
        <div className={`preview-container ${mobilePreview ? 'mobile' : ''}`}>
          <div className={`preview-stage ${mobilePreview ? 'mobile' : 'desktop'}`}>
            <div className="preview-stage-header">
              <div>
                <span className="preview-stage-eyebrow">{mobilePreview ? 'Mobile canvas' : 'Desktop canvas'}</span>
                <strong>{visibleBlocks.length > 0 ? `${visibleBlocks.length} visible sections` : 'Awaiting content'}</strong>
              </div>
              <span className="preview-stage-pill">{mobilePreview ? '390px viewport' : 'Fluid viewport'}</span>
            </div>
            <div className={`preview-frame ${mobilePreview ? 'mobile' : ''}`}>
              {mobilePreview && (
                <div className="preview-device-chrome" aria-hidden="true">
                  <span className="preview-device-notch" />
                  <span className="preview-device-speaker" />
                </div>
              )}
              <iframe
                ref={iframeRef}
                key={previewDocKey}
                srcDoc={htmlContent}
                title="Page Preview"
                sandbox="allow-scripts allow-same-origin"
                className="preview-iframe"
                onLoad={() => setIframeLoadTick((prev) => prev + 1)}
              />
            </div>
          </div>
        </div>
      ) : viewMode === 'code' ? (
        <div className="code-view">
          <div className="code-toolbar">
            <div className="code-toolbar-meta">
              <span className="code-lang-badge">HTML</span>
              <span className="code-toolbar-hint">Edit visible sections directly and save to rebuild the block list.</span>
            </div>
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
            <span className="console-toolbar-label">Runtime console</span>
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
