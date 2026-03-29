import { streamFromOpenRouter, parseSSEStream } from '@/lib/openrouter';
import { logger } from '@/lib/logger';

export interface StreamGenerationParams {
    systemPrompt: string;
    userPrompt: string;
    apiKey: string;
    model?: string;
}

/**
 * Call the LLM via OpenRouter and return a `ReadableStream<Uint8Array>` that
 * streams the decoded text chunks.  Pass the stream directly to `new Response()`.
 */
export async function createGenerationStream(
    params: StreamGenerationParams,
): Promise<ReadableStream<Uint8Array>> {
    const { systemPrompt, userPrompt, apiKey, model } = params;

    const rawStream = await streamFromOpenRouter({
        prompt: userPrompt,
        systemPrompt,
        apiKey,
        model: model || undefined,
    });

    const textStream = parseSSEStream(rawStream);
    const reader = textStream.getReader();
    const encoder = new TextEncoder();

    logger.stream('createGenerationStream: starting response stream');

    return new ReadableStream<Uint8Array>({
        async pull(controller) {
            const { done, value } = await reader.read();
            if (done) {
                logger.stream('createGenerationStream: response stream complete');
                controller.close();
                return;
            }
            controller.enqueue(encoder.encode(value));
        },
    });
}
