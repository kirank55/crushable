import { Block } from '@/types';

export function generateFullHTML(blocks: Block[]): string {
  const sectionsHtml = blocks.map((b) => b.html).join('\n\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Built with Crushable</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; margin: 0; }
  </style>
</head>
<body>
${sectionsHtml}
<script>lucide.createIcons();</script>
</body>
</html>`;
}

export function downloadHTML(blocks: Block[]): void {
  const html = generateFullHTML(blocks);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'index.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
