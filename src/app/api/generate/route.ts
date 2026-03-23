import { NextRequest, NextResponse } from 'next/server';
import { streamFromOpenRouter, parseSSEStream, resolveOpenRouterApiKey } from '@/lib/openrouter';
import {
    getSystemPrompt,
    getElementEditSystemPrompt,
    buildEditPrompt,
    buildNewPrompt,
    buildPlanPrompt,
    buildDetailedPlanPrompt,
    buildElementEditPrompt,
    buildTemplateFillPrompt,
    buildTemplateSelectionPrompt,
    buildCompositionPrompt,
    buildPatchEditPrompt,
    buildCritiquePrompt,
    buildValidationPrompt,
    buildStyleSelectPrompt,
} from '@/lib/prompt';
import { logger } from '@/lib/logger';


export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            prompt,
            currentHtml,
            blockId,
            mode,
            apiKey,
            model,
            designStylePrompt,
            projectContext,
            planDetails,
            fullHtml,
            templateSkeleton,
            sectionRole,
            templateCatalog,
            sections,
            componentCatalog,
            sectionPlan,
            designStyle,
        } = body;

        logger.api('/api/generate', { mode, model, hasApiKey: !!apiKey, blockId: blockId || null, hasDesignStyle: !!designStylePrompt, hasProjectContext: !!projectContext });

        if (!prompt && !['detailed-plan', 'validate', 'fill-template', 'select-templates', 'compose', 'patch-edit', 'critique'].includes(mode || '')) {
            logger.error('/api/generate', 'Missing prompt');
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

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
        } else if (mode === 'fill-template' && templateSkeleton && sectionRole) {
            systemPrompt = 'You are a conversion copywriter. Return only JSON placeholder values for the provided landing page template. Do not return HTML or markdown.';
            userPrompt = buildTemplateFillPrompt(templateSkeleton, projectContext || prompt || '', sectionRole);
            logger.info('Template fill mode', { sectionRole });
        } else if (mode === 'select-templates' && Array.isArray(sections) && templateCatalog) {
            systemPrompt = 'You map landing page sections to the best template IDs. Return only JSON.';
            userPrompt = buildTemplateSelectionPrompt(sections, templateCatalog, designStyle || undefined);
            logger.info('Template selection mode', { sectionCount: sections.length });
        } else if (mode === 'compose' && componentCatalog && Array.isArray(sectionPlan)) {
            systemPrompt = 'You compose landing pages from a component library. Return only JSON array data.';
            userPrompt = buildCompositionPrompt(componentCatalog, projectContext || prompt || '', sectionPlan);
            logger.info('Component composition mode', { sectionCount: sectionPlan.length });
        } else if (mode === 'patch-edit' && currentHtml) {
            systemPrompt = 'You generate precise JSON patches for a landing page section. Return only JSON with valid patch operations.';
            userPrompt = buildPatchEditPrompt(currentHtml, prompt || 'Apply the requested edit.');
            logger.info('Patch edit mode', { blockId, currentHtmlLength: currentHtml.length });
        } else if (mode === 'critique' && currentHtml && sectionRole) {
            systemPrompt = 'You critique landing page sections and return only JSON scores and improvement guidance.';
            userPrompt = buildCritiquePrompt(currentHtml, sectionRole, designStyle || 'professional');
            logger.info('Critique mode', { blockId, sectionRole });
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
            apiKey: resolvedApiKey.resolvedKey,
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
