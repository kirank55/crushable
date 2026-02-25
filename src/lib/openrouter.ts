import { FREE_MODEL } from '@/types';

interface OpenRouterRequest {
    prompt: string;
    systemPrompt: string;
    apiKey?: string;
    model?: string;
}

export async function streamFromOpenRouter({
    prompt,
    systemPrompt,
    apiKey,
    model,
}: OpenRouterRequest): Promise<ReadableStream<Uint8Array>> {
    const selectedModel = model || (apiKey ? 'anthropic/claude-sonnet-4' : FREE_MODEL);

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://crushable.dev',
        'X-Title': 'Crushable',
    };

    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            model: selectedModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ],
            stream: true,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenRouter API error (${response.status}): ${error}`);
    }

    if (!response.body) {
        throw new Error('No response body from OpenRouter');
    }

    return response.body;
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
