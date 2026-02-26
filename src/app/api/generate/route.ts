import { NextRequest, NextResponse } from 'next/server';
import { streamFromOpenRouter, parseSSEStream } from '@/lib/openrouter';
import { getSystemPrompt, buildEditPrompt, buildNewPrompt, buildPlanPrompt } from '@/lib/prompt';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { prompt, currentHtml, blockId, mode, apiKey, model, designStylePrompt, projectContext } = body;

        logger.api('/api/generate', { mode, model, hasApiKey: !!apiKey, blockId: blockId || null, hasDesignStyle: !!designStylePrompt, hasProjectContext: !!projectContext });

        if (!prompt) {
            logger.error('/api/generate', 'Missing prompt');
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        // Use client-provided key if valid, fall back to server env key
        const envKey = process.env.OPENROUTER_API_KEY || '';
        const clientKey = apiKey && typeof apiKey === 'string' && apiKey.startsWith('sk-') ? apiKey : '';
        const resolvedKey = clientKey || envKey;

        logger.info('API key resolution', {
            clientKeyProvided: !!apiKey,
            clientKeyValid: !!clientKey,
            envKeyPresent: !!envKey,
            usingSource: clientKey ? 'client' : envKey ? 'env' : 'none',
        });

        if (!resolvedKey) {
            logger.error('/api/generate', 'No API key configured');
            return NextResponse.json(
                { error: 'No API key configured. Add your OpenRouter key in Settings (⚙️) or set OPENROUTER_API_KEY in .env.local' },
                { status: 401 }
            );
        }

        let systemPrompt: string;
        let userPrompt: string;

        if (mode === 'plan') {
            // Planning mode: ask LLM which sections to build
            systemPrompt = 'You are a landing page planner. Given a user request, return a JSON array of section names to build.';
            userPrompt = buildPlanPrompt(prompt);
            logger.info('Plan mode');
        } else if (mode === 'edit' && currentHtml && blockId) {
            systemPrompt = getSystemPrompt(designStylePrompt || undefined, projectContext || undefined);
            userPrompt = buildEditPrompt(currentHtml, prompt, blockId);
            logger.info('Edit mode', { blockId, currentHtmlLength: currentHtml.length });
        } else {
            systemPrompt = getSystemPrompt(designStylePrompt || undefined, projectContext || undefined);
            userPrompt = buildNewPrompt(prompt);
            logger.info('New block mode');
        }

        logger.prompt('system', systemPrompt);
        logger.prompt('user', userPrompt);

        const rawStream = await streamFromOpenRouter({
            prompt: userPrompt,
            systemPrompt,
            apiKey: resolvedKey,
            model: model || undefined,
        });

        const textStream = parseSSEStream(rawStream);
        const reader = textStream.getReader();
        const encoder = new TextEncoder();

        logger.stream('Starting response stream');

        const responseStream = new ReadableStream({
            async pull(controller) {
                const { done, value } = await reader.read();
                if (done) {
                    logger.stream('Response stream complete');
                    controller.close();
                    return;
                }
                controller.enqueue(encoder.encode(value));
            },
        });

        return new Response(responseStream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Transfer-Encoding': 'chunked',
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('/api/generate', error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
