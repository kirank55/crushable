import { FREE_MODEL } from '@/types';
import { logger } from '@/lib/logger';

// --- Constants & Types --- //

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://crushable.dev';
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Crushable';

/**
 * Free models to try in order when auto:free is selected.
 */
const FREE_MODELS_FALLBACK = [
    'stepfun/step-3.5-flash:free',
    'z-ai/glm-4.5-air:free',
    'nvidia/nemotron-3-nano-30b-a3b:free',
    'google/gemma-3-27b-it:free',
];

interface OpenRouterRequest {
    prompt: string;
    systemPrompt: string;
    apiKey?: string;
    model?: string;
}

interface ResolvedApiKey {
    resolvedKey: string;
    source: 'client' | 'env';
}

// --- Key Resolution --- //

export function resolveOpenRouterApiKey(apiKey: unknown): ResolvedApiKey | null {
    if (typeof apiKey === 'string' && apiKey.startsWith('sk-')) {
        return { resolvedKey: apiKey, source: 'client' };
    }

    const envKey = process.env.OPENROUTER_API_KEY;
    if (envKey) {
        return { resolvedKey: envKey, source: 'env' };
    }

    return null;
}

// --- API Calling --- //

/**
 * Make a single OpenRouter API call for a specific model.
 * Returns the response body stream on success, throws on error.
 */
async function callOpenRouter(
    model: string,
    systemPrompt: string,
    prompt: string,
    apiKey: string | undefined,
): Promise<ReadableStream<Uint8Array>> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'HTTP-Referer': APP_URL,
        'X-Title': APP_NAME,
    };

    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ],
            stream: true,
        }),
    });

    logger.api('OpenRouter response', { model, status: response.status, ok: response.ok });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter API error (${response.status}): ${error}`);
    }

    if (!response.body) {
        throw new Error('No response body from OpenRouter');
    }

    return response.body;
}

/**
 * Fallback handler: tries free models sequentially until one succeeds.
 */
async function tryFreeModelsFallback(
    systemPrompt: string, 
    prompt: string, 
    apiKey: string | undefined
): Promise<ReadableStream<Uint8Array>> {
    logger.info('Free Auto mode — will try models in order', { models: FREE_MODELS_FALLBACK });

    const errors: string[] = [];

    for (const freeModel of FREE_MODELS_FALLBACK) {
        try {
            logger.info(`Free Auto: trying ${freeModel}`);
            const stream = await callOpenRouter(freeModel, systemPrompt, prompt, apiKey);
            logger.info(`Free Auto: success with ${freeModel}`);
            return stream;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error(`Free Auto: ${freeModel} failed`, msg);
            errors.push(`${freeModel}: ${msg}`);
        }
    }

    // All models failed
    throw new Error(`All free models failed:\n${errors.join('\n')}`);
}

export async function streamFromOpenRouter({
    prompt,
    systemPrompt,
    apiKey,
    model,
}: OpenRouterRequest): Promise<ReadableStream<Uint8Array>> {
    const isAutoMode = !model || model === FREE_MODEL;
    const resolvedModel = isAutoMode ? undefined : model;

    logger.api('OpenRouter request', { model: resolvedModel || 'auto:free', appUrl: APP_URL, appName: APP_NAME, hasApiKey: !!apiKey });
    logger.prompt('system', systemPrompt);
    logger.prompt('user', prompt);

    if (apiKey) {
        logger.info('Authorization header set', { keyPrefix: apiKey.slice(0, 10) + '...' });
    } else {
        logger.error('OpenRouter', 'No API key available — Authorization header NOT set');
    }

    // If a specific model is selected (not auto), try it directly
    if (resolvedModel) {
        logger.info('Using specific model', { model: resolvedModel });
        return callOpenRouter(resolvedModel, systemPrompt, prompt, apiKey);
    }

    // Auto mode: try free models in order, fall back on error
    return tryFreeModelsFallback(systemPrompt, prompt, apiKey);
}

// --- Text Processing --- //

export async function textFromOpenRouter({
    prompt,
    systemPrompt,
    apiKey,
    model,
}: OpenRouterRequest): Promise<string> {
    const stream = await streamFromOpenRouter({ prompt, systemPrompt, apiKey, model });
    const textStream = parseSSEStream(stream);
    const reader = textStream.getReader();
    let fullText = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += value;
    }

    return fullText;
}

/**
 * Extracts and enqueues text content from a single SSE data line.
 */
function parseSSELine(line: string, controller: ReadableStreamDefaultController<string>): boolean {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('data: ')) return false;

    const data = trimmed.slice(6);
    if (data === '[DONE]') {
        controller.close();
        return true; // signals done
    }

    try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
            controller.enqueue(content);
        }
    } catch {
        // skip malformed JSON
    }
    
    return false;
}

export function parseSSEStream(stream: ReadableStream<Uint8Array>): ReadableStream<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    return new ReadableStream<string>({
        async pull(controller) {
            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    logger.stream('SSE stream ended');
                    controller.close();
                    return;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const isDone = parseSSELine(line, controller);
                    if (isDone) return;
                }
            }
        },
    });
}
