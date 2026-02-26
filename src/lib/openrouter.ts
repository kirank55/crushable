import { FREE_AUTO_MODEL, getAvailableModels } from '@/types';
import { logger } from '@/lib/logger';

interface OpenRouterRequest {
    prompt: string;
    systemPrompt: string;
    apiKey?: string;
    model?: string;
}

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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crushable.dev';
    const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Crushable';

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'HTTP-Referer': appUrl,
        'X-Title': appName,
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
 * Get the list of free model IDs to try (excluding the auto:free entry).
 */
function getFreeModelIds(): string[] {
    return getAvailableModels()
        .filter(m => m.free && m.id !== FREE_AUTO_MODEL)
        .map(m => m.id);
}

export async function streamFromOpenRouter({
    prompt,
    systemPrompt,
    apiKey,
    model,
}: OpenRouterRequest): Promise<ReadableStream<Uint8Array>> {
    const isAutoMode = !model || model === FREE_AUTO_MODEL;
    const resolvedModel = isAutoMode ? undefined : model;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crushable.dev';
    const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Crushable';

    logger.api('OpenRouter request', { model: resolvedModel || 'auto:free', appUrl, appName, hasApiKey: !!apiKey });
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
    const freeModels = getFreeModelIds();
    logger.info('Free Auto mode — will try models in order', { models: freeModels });

    const errors: string[] = [];

    for (const freeModel of freeModels) {
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
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data: ')) continue;

                    const data = trimmed.slice(6);
                    if (data === '[DONE]') {
                        controller.close();
                        return;
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
                }
            }
        },
    });
}
