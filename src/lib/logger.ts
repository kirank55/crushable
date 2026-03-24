const PREFIX = '[Crushable]';

function timestamp(): string {
    return new Date().toISOString();
}

export const logger = {
    action: (action: string, data?: unknown) => {
        console.log(`${PREFIX} [${timestamp()}] ACTION: ${action}`, data !== undefined ? data : '');
    },
    api: (endpoint: string, data?: unknown) => {
        console.log(`${PREFIX} [${timestamp()}] API: ${endpoint}`, data !== undefined ? data : '');
    },
    prompt: (type: 'system' | 'user', content: string) => {
        console.log(`${PREFIX} [${timestamp()}] PROMPT [${type.toUpperCase()}]:`, content);
    },
    stream: (event: string, data?: unknown) => {
        console.log(`${PREFIX} [${timestamp()}] STREAM: ${event}`, data !== undefined ? data : '');
    },
    storage: (op: string, data?: unknown) => {
        console.log(`${PREFIX} [${timestamp()}] STORAGE: ${op}`, data !== undefined ? data : '');
    },
    error: (context: string, err: unknown) => {
        console.error(`${PREFIX} [${timestamp()}] ERROR [${context}]:`, err);
    },
    info: (message: string, data?: unknown) => {
        console.log(`${PREFIX} [${timestamp()}] INFO: ${message}`, data !== undefined ? data : '');
    },
};
