import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

function extractAttribute(tag: string, name: string): string {
    const match = tag.match(new RegExp(`${name}="([^"]*)"`, 'i'));
    return match ? match[1].trim() : '';
}

function normalizeKeyword(input: string): string {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9\s-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildImageQuery(tag: string, blockId?: string): string {
    const alt = normalizeKeyword(extractAttribute(tag, 'alt'));
    const candidates = [alt, normalizeKeyword(blockId || '')]
        .join(' ')
        .split(' ')
        .filter((token) => token.length >= 3 && !['image', 'photo', 'picture', 'section', 'block'].includes(token));

    const keywords = Array.from(new Set(candidates)).slice(0, 3);
    return keywords.length > 0 ? keywords.join(',') : 'technology,product';
}

function buildReplacementSrc(tag: string, blockId?: string): string {
    const query = buildImageQuery(tag, blockId);
    const lockSeed = encodeURIComponent((blockId || query).replace(/\s+/g, '-').toLowerCase());
    return `https://loremflickr.com/1200/800/${encodeURIComponent(query)}?lock=${lockSeed}`;
}

function needsReplacement(src: string): boolean {
    if (!src) return true;
    const trimmed = src.trim();
    if (!trimmed) return true;
    if (/placeholder|example\.com|via\.placeholder|dummyimage|your-image|image-url/i.test(trimmed)) {
        return true;
    }
    if (/^(data:|blob:|https?:\/\/|\/|\.\/|\.\.\/)/i.test(trimmed)) {
        if (/^https?:\/\//i.test(trimmed)) {
            try {
                const parsed = new URL(trimmed);
                return !parsed.hostname;
            } catch {
                return true;
            }
        }
        return false;
    }
    return true;
}

function repairImageSources(html: string, blockId?: string): { html: string; replacedCount: number } {
    let replacedCount = 0;

    const nextHtml = html.replace(/<img\b[^>]*>/gi, (tag) => {
        const src = extractAttribute(tag, 'src');
        if (!needsReplacement(src)) {
            return tag;
        }

        const replacementSrc = buildReplacementSrc(tag, blockId);
        replacedCount += 1;

        if (/\ssrc="[^"]*"/i.test(tag)) {
            return tag.replace(/\ssrc="[^"]*"/i, ` src="${replacementSrc}"`);
        }

        return tag.replace(/<img/i, `<img src="${replacementSrc}"`);
    });

    return { html: nextHtml, replacedCount };
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const html = typeof body.html === 'string' ? body.html : '';
        const blockId = typeof body.blockId === 'string' ? body.blockId : undefined;

        if (!html.trim()) {
            return NextResponse.json({ error: 'HTML is required' }, { status: 400 });
        }

        const repaired = repairImageSources(html, blockId);
        return NextResponse.json(repaired);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}