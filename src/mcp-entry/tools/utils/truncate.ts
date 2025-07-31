import { encoding_for_model } from '@dqbd/tiktoken';
import { Chat } from '../../../common/interfaces/chat.interface';



export function truncateMessages(messages: Chat[], maxTokens = 3000): Chat[] {
    const encoding = encoding_for_model('gpt-3.5-turbo');

    const systemMessage = messages.find(m => m.role === 'system');
    const reversed = [...messages].reverse();
    const truncated: Chat[] = [];
    let tokenCount = 0;

    for (const message of reversed) {
        if (message.role === 'system') continue;
        const tokens = encoding.encode(message.content).length;
        if (tokenCount + tokens > maxTokens) break;
        truncated.unshift(message);
        tokenCount += tokens;
    }

    return systemMessage ? [systemMessage, ...truncated] : truncated;
}