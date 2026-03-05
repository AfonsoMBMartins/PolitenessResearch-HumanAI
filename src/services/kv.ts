import { createClient } from '@vercel/kv';
import { Message } from '../types';

// Using process.env since it's defined in vite.config.ts
export const kv = createClient({
    url: process.env.KV_REST_API_URL || '',
    token: process.env.KV_REST_API_TOKEN || '',
});

export const getSessionKey = (participantId: string, scenarioName: string) => `session:${participantId}:${scenarioName}`;

export const getSessionMessages = async (participantId: string, scenarioName: string): Promise<Message[]> => {
    const key = getSessionKey(participantId, scenarioName);
    try {
        const data = await kv.get<Message[]>(key);
        return data || [];
    } catch (error) {
        console.error("KV Error loading session:", error);
        return [];
    }
};

export const saveSessionMessages = async (participantId: string, scenarioName: string, messages: Message[]) => {
    const key = getSessionKey(participantId, scenarioName);
    try {
        await kv.set(key, messages);
    } catch (error) {
        console.error("KV Error saving session:", error);
    }
};

export const getAllSessionKeys = async (): Promise<string[]> => {
    try {
        const keys = await kv.keys('session:*');
        return keys || [];
    } catch (error) {
        console.error("KV Error getting all sessions:", error);
        return [];
    }
};
