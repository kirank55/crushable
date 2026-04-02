/**
 * POST /api/generate — handles initial generation only.
 *
 * All modification paths have been moved to /api/modify.
 * This route handles: describe, plan, detailed-plan, style-select, validate, new.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveOpenRouterApiKey } from '@/lib/openrouter';
import { analyzeInitialRequest } from '@/lib/initial-generation/analyzer';
import { createGenerationStream } from '@/lib/stream-generation';
import { RequestValidationError } from '@/lib/shared/types';
import { logger } from '@/lib/logger';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { apiKey, mode, model } = body;

        logger.api('/api/generate', {
            mode,
            model,
            hasApiKey: !!apiKey,
            hasProductDescription: !!body.productDescription,
            hasDesignStyleLabel: !!body.designStyle,
            hasDesignStyle: !!body.designStylePrompt,
            hasProjectContext: !!body.projectContext,
        });

        // ── 1. Resolve API key ───────────────────────────────────────────────
        const resolvedApiKey = resolveOpenRouterApiKey(apiKey);

        logger.info('API key resolution', {
            clientKeyProvided: !!apiKey,
            clientKeyValid: !!(typeof apiKey === 'string' && apiKey.startsWith('sk-')),
            envKeyPresent: !!process.env.OPENROUTER_API_KEY,
            usingSource: resolvedApiKey?.source || 'none',
        });

        if (!resolvedApiKey) {
            logger.error('/api/generate', 'No API key configured');
            return NextResponse.json(
                { error: 'No API key configured. Add your OpenRouter key in Settings or set OPENROUTER_API_KEY in .env.local' },
                { status: 401 },
            );
        }

        // ── 2. Analyse the request — validate inputs & build prompts ─────────
        const analyzed = analyzeInitialRequest(body);

        logger.info('Mode resolved', {
            requestedMode: mode ?? null,
            resolvedMode: analyzed.mode,
        });

        // ── 3. Stream the generation ─────────────────────────────────────────
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
            },
        });

    } catch (error) {
        if (error instanceof RequestValidationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('/api/generate', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
