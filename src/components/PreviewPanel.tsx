'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Block } from '@/types';
import { Eye, Code } from 'lucide-react';

interface PreviewPanelProps {
  blocks: Block[];
  selectedBlockId: string | null;
  mobilePreview: boolean;
}

export default function PreviewPanel({ blocks, selectedBlockId, mobilePreview }: PreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');

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
<\/script>
</body>
</html>`;
  }, [blocks]);

  const codeContent = useMemo(() => {
    return blocks.map((b) => b.html).join('\n\n');
  }, [blocks]);

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
      </div>

      {viewMode === 'preview' ? (
        <div className={`preview-container ${mobilePreview ? 'mobile' : ''}`}>
          <iframe
            ref={iframeRef}
            srcDoc={htmlContent}
            title="Page Preview"
            sandbox="allow-scripts"
            className="preview-iframe"
          />
        </div>
      ) : (
        <div className="code-view">
          <pre><code>{codeContent || '// No sections yet. Start chatting to build your page.'}</code></pre>
        </div>
      )}
    </div>
  );
}
