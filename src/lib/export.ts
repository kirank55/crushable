import { Block } from '@/types';

export function generateFullHTML(blocks: Block[], projectName?: string): string {
  const sectionsHtml = blocks
    .filter((block) => block.visible !== false)
    .map((block) => block.html)
    .join('\n\n');
  const title = projectName?.trim() || 'Landing Page';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="generator" content="Crushable — AI Landing Page Builder" />
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://unpkg.com/lucide@latest"><\/script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; margin: 0; }
  </style>
</head>
<body>
${sectionsHtml}
<script>lucide.createIcons();<\/script>
</body>
</html>`;
}

export function downloadHTML(blocks: Block[], projectName?: string): void {
  const html = generateFullHTML(blocks, projectName);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // Generate slug from project name for filename
  const slug = projectName?.trim()
    ? projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    : 'index';
  a.download = `${slug}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
