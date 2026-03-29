'use client';

import { Block } from '@/types';

interface PreviewPanelProps {
  blocks: Block[];
}

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

function buildPreviewHtml(blocks: Block[]): string {
  const visibleBlocks = blocks.filter((b) => b.visible !== false);
  if (visibleBlocks.length === 0) return EMPTY_STATE_HTML;
  const body = visibleBlocks.map((b) => b.html).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    /* Ensure smooth scrolling works correctly */
    html { scroll-behavior: smooth; font-family: 'Inter', system-ui, sans-serif; }
  </style>
</head>
<body>
  ${body}
  <script>
    // Initialize icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  </script>
</body>
</html>`;
}

export default function PreviewPanel({ blocks }: PreviewPanelProps) {
  const srcDoc = buildPreviewHtml(blocks);

  return (
    <div className="preview-panel">
      <div className="preview-container">
        <div className="preview-stage desktop">
          <div className="preview-frame">
            <iframe
              srcDoc={srcDoc}
              title="Page Preview"
              sandbox="allow-scripts allow-same-origin"
              className="preview-iframe"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
