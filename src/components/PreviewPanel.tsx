'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Block } from '@/types';

interface PreviewPanelProps {
  blocks: Block[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
}

export default function PreviewPanel({ blocks, selectedBlockId, onSelectBlock }: PreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const htmlContent = useMemo(() => {
    const sectionsHtml = blocks.map((b) => b.html).join('\n\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://unpkg.com/lucide@latest"><\/script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; margin: 0; cursor: default; }
    [data-block-id] { position: relative; transition: outline 0.15s ease; cursor: pointer; }
    [data-block-id]:hover { outline: 2px dashed rgba(99, 102, 241, 0.5); outline-offset: -2px; }
    [data-block-id].selected { outline: 2px solid rgb(99, 102, 241); outline-offset: -2px; }
    [data-block-id].selected::after {
      content: attr(data-block-id);
      position: absolute; top: 4px; right: 4px;
      background: rgb(99, 102, 241); color: white;
      padding: 2px 8px; border-radius: 4px;
      font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.5px;
      z-index: 9999; pointer-events: none;
    }
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

  var SELECTED_ID = ${JSON.stringify(selectedBlockId)};

  document.querySelectorAll('[data-block-id]').forEach(function(el) {
    if (el.dataset.blockId === SELECTED_ID) {
      el.classList.add('selected');
    }

    el.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();

      document.querySelectorAll('[data-block-id]').forEach(function(s) { s.classList.remove('selected'); });
      el.classList.add('selected');

      window.parent.postMessage({
        type: 'block-selected',
        blockId: el.dataset.blockId
      }, '*');
    });
  });

  document.body.addEventListener('click', function(e) {
    if (!e.target.closest('[data-block-id]')) {
      document.querySelectorAll('[data-block-id]').forEach(function(s) { s.classList.remove('selected'); });
      window.parent.postMessage({ type: 'block-deselected' }, '*');
    }
  });
<\/script>
</body>
</html>`;
  }, [blocks, selectedBlockId]);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data?.type === 'block-selected') {
      onSelectBlock(event.data.blockId);
    } else if (event.data?.type === 'block-deselected') {
      onSelectBlock(null);
    }
  }, [onSelectBlock]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

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
      <iframe
        ref={iframeRef}
        srcDoc={htmlContent}
        title="Page Preview"
        sandbox="allow-scripts"
        className="preview-iframe"
      />
    </div>
  );
}
