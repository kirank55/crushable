import { NextRequest, NextResponse } from 'next/server';
import { resolveOpenRouterApiKey } from '@/lib/openrouter';
import { runModificationEngine } from '@/lib/modification-engine';
import { ModificationEngineRequest } from '@/types';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json() as ModificationEngineRequest;
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Request body is required.' }, { status: 400 });
        }

        const resolvedApiKey = resolveOpenRouterApiKey(body.apiKey);

        logger.api('/api/modification-engine', {
            requestKind: body.requestKind,
            model: body.model,
            hasApiKey: !!body.apiKey,
            blockCount: Array.isArray(body.blocks) ? body.blocks.length : 0,
            selectedBlockId: body.selectedBlockId || null,
        });

        if (!body.prompt || typeof body.prompt !== 'string') {
            return NextResponse.json({ error: 'Prompt is required.' }, { status: 400 });
        }

        if (!Array.isArray(body.blocks)) {
            return NextResponse.json({ error: 'Blocks are required.' }, { status: 400 });
        }

        if (!resolvedApiKey) {
            logger.error('/api/modification-engine', 'No API key configured');
            return NextResponse.json(
                { error: 'No API key configured. Add your OpenRouter key in Settings (âš™ï¸) or set OPENROUTER_API_KEY in .env.local' },
                { status: 401 },
            );
        }

        const response = await runModificationEngine(body, {
            apiKey: resolvedApiKey.resolvedKey,
            model: body.model || undefined,
        });

        return NextResponse.json(response);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('/api/modification-engine', error);
        const status = /required|unsupported|selected/i.test(message) ? 400 : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
