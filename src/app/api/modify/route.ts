/**
 * POST /api/modify — handles all post-generation modifications.
 *
 * Resolves the user's intent via the modification engine analyzer,
 * then either returns JSON (remove-section) or streams HTML generation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveOpenRouterApiKey } from '@/lib/openrouter';
import { analyzeModificationRequest } from '@/lib/modification/analyzer';
import { createGenerationStream } from '@/lib/stream-generation';
import { RequestValidationError } from '@/lib/shared/types';
import { logger } from '@/lib/logger';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { apiKey, model } = body;

        logger.api('/api/modify', {
            model,
            hasApiKey: !!apiKey,
            blockCount: body.blocks?.length || 0,
            selectedBlockId: body.selectedBlockId || null,
        });

        // ── 1. Resolve API key ───────────────────────────────────────────────
        const resolvedApiKey = resolveOpenRouterApiKey(apiKey);

        if (!resolvedApiKey) {
            logger.error('/api/modify', 'No API key configured');
            return NextResponse.json(
                { error: 'No API key configured. Add your OpenRouter key in Settings or set OPENROUTER_API_KEY in .env.local' },
                { status: 401 },
            );
        }

        // ── 2. Analyse the modification request (includes intent resolution) ─
        const analyzed = await analyzeModificationRequest(body, resolvedApiKey.resolvedKey);

        logger.info('Modification resolved', {
            mode: analyzed.mode,
            intentKind: analyzed.intent.kind,
        });

        // ── 3. Handle non-streaming operations ───────────────────────────────
        if (analyzed.intent.kind === 'remove-section') {
            return NextResponse.json({
                intent: analyzed.intent,
                mode: 'remove-section',
            });
        }

        // ── 4. Stream the generation for edit/add/style operations ───────────
        const stream = await createGenerationStream({
            systemPrompt: analyzed.systemPrompt,
            userPrompt: analyzed.userPrompt,
            apiKey: resolvedApiKey.resolvedKey,
            model: model || undefined,
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'X-Resolved-Mode': analyzed.mode,
                'X-Intent': JSON.stringify(analyzed.intent),
            },
        });

    } catch (error) {
        if (error instanceof RequestValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('/api/modify', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
