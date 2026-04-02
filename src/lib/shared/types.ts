// Shared request/response shapes used by both engines

export interface AnalyzedRequest {
    mode: string;
    systemPrompt: string;
    userPrompt: string;
}

export class RequestValidationError extends Error {
    constructor(
        public readonly message: string,
        public readonly statusCode: number = 400,
    ) {
        super(message);
        this.name = 'RequestValidationError';
    }
}
