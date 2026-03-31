import { NextRequest, NextResponse } from 'next/server';
import { resolveOpenRouterApiKey } from '@/lib/openrouter';
import { analyzeRequest, RequestValidationError } from '@/lib/prompt-analysis';
import { createGenerationStream } from '@/lib/stream-generation';
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
            blockId: body.blockId || null,
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
        // Pass the API key so analyzeRequest can call the LLM to infer the mode
        // when body.mode is absent.
        const analyzed = await analyzeRequest(body, resolvedApiKey.resolvedKey);

        logger.info('Mode resolved', {
            requestedMode: mode ?? null,
            resolvedMode: analyzed.mode,
            inferred: !mode,
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
