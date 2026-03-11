import { NextRequest, NextResponse } from 'next/server';
import { streamFromOpenRouter, parseSSEStream } from '@/lib/openrouter';
import {
    getSystemPrompt,
    getElementEditSystemPrompt,
    buildEditPrompt,
    buildNewPrompt,
    buildPlanPrompt,
    buildDetailedPlanPrompt,
    buildElementEditPrompt,
    buildValidationPrompt,
    buildStyleSelectPrompt,
} from '@/lib/prompt';
import { logger } from '@/lib/logger';


export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { prompt, currentHtml, blockId, mode, apiKey, model, designStylePrompt, projectContext, planDetails, fullHtml } = body;

        logger.api('/api/generate', { mode, model, hasApiKey: !!apiKey, blockId: blockId || null, hasDesignStyle: !!designStylePrompt, hasProjectContext: !!projectContext });

        if (!prompt && mode !== 'detailed-plan' && mode !== 'validate') {
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

        if (mode === 'detailed-plan') {
            // Detailed plan mode: ask LLM to generate a product-specific landing page plan
            const d = planDetails || {};
            systemPrompt = 'You are a landing page strategist. Generate a detailed, conversion-focused execution plan tailored to the specific product and brand. Return ONLY the plan text in the exact numbered format requested, with no markdown code blocks or extra commentary.';
            userPrompt = buildDetailedPlanPrompt(
                d.brandName || 'Your brand',
                d.productDescription || 'A product',
                d.designStyleLabel || 'Professional',
                d.heroTitle || 'A strong value-focused hero headline',
                d.subtitle || 'A concise supporting message that explains the offer and why it matters.',
                d.ctaText || 'Get Started',
            );
            logger.info('Detailed plan mode', { brandName: d.brandName });
        } else if (mode === 'plan') {
            // Planning mode: ask LLM which sections to build
            systemPrompt = 'You are a landing page planner. Given a user request, return a JSON array of section names to build.';
            userPrompt = buildPlanPrompt(prompt);
            logger.info('Plan mode');
        } else if (mode === 'style-select') {
            systemPrompt = 'You select the most appropriate design style ID for a product description. Return only one valid style ID.';
            userPrompt = buildStyleSelectPrompt(prompt);
            logger.info('Style selection mode');
        } else if (mode === 'validate') {
            systemPrompt = 'You review landing page HTML and identify structural and UX issues. Return concise plain text findings.';
            userPrompt = buildValidationPrompt(fullHtml || prompt || '');
            logger.info('Validate mode');
        } else if (mode === 'element-edit' && currentHtml && blockId) {
            systemPrompt = getElementEditSystemPrompt(designStylePrompt || undefined, projectContext || undefined);
            userPrompt = buildElementEditPrompt(currentHtml, prompt, blockId);
            logger.info('Element edit mode', { blockId, currentHtmlLength: currentHtml.length });
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
