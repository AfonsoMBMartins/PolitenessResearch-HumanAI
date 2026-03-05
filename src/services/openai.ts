import OpenAI from 'openai';
import { Message } from '../types';

const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY || API_KEY.startsWith('your_openai') || API_KEY === 'MY_OPENAI_API_KEY') {
    console.warn('[OpenAI] OPENAI_API_KEY is not set. Please update your .env file.');
}

const openai = new OpenAI({
    apiKey: API_KEY || '',
    dangerouslyAllowBrowser: true
});

export async function sendMessageToOpenAI(messages: Message[], onChunk: (text: string) => void) {
    const formattedMessages = messages.map(m => ({
        role: m.role as any,
        content: m.content
    }));

    const stream = await openai.chat.completions.create({
        model: 'gpt-4.1-nano',
        messages: formattedMessages,
        stream: true,
    });

    let fullResponse = '';
    for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        fullResponse += text;
        onChunk(fullResponse);
    }

    return fullResponse;
}
