import { NextRequest, NextResponse } from 'next/server';
import { streamFromOpenRouter, parseSSEStream } from '@/lib/openrouter';
import { getSystemPrompt, buildEditPrompt, buildNewPrompt } from '@/lib/prompt';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { prompt, currentHtml, blockId, mode, apiKey, model } = body;

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        // Use client-provided key, fall back to server env key
        const resolvedKey = apiKey || process.env.OPENROUTER_API_KEY || '';

        if (!resolvedKey) {
            return NextResponse.json(
                { error: 'No API key configured. Add your OpenRouter key in Settings (⚙️) or set OPENROUTER_API_KEY in .env.local' },
                { status: 401 }
            );
        }

        const systemPrompt = getSystemPrompt();
        let userPrompt: string;

        if (mode === 'edit' && currentHtml && blockId) {
            userPrompt = buildEditPrompt(currentHtml, prompt, blockId);
        } else {
            userPrompt = buildNewPrompt(prompt);
        }

        const rawStream = await streamFromOpenRouter({
            prompt: userPrompt,
            systemPrompt,
            apiKey: resolvedKey,
            model: model || undefined,
        });

        const textStream = parseSSEStream(rawStream);
        const reader = textStream.getReader();
        const encoder = new TextEncoder();

        const responseStream = new ReadableStream({
            async pull(controller) {
                const { done, value } = await reader.read();
                if (done) {
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
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
