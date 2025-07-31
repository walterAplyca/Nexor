export interface Chat {
    role: 'system' | 'user' | 'assistant';
    content: string;
}