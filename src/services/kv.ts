import { Message } from '../types';

export const getSessionMessages = async (participantId: string, scenarioName: string): Promise<Message[]> => {
    const key = `session:${participantId}:${scenarioName}`;
    try {
        const response = await fetch(`/api/kv?key=${key}`);
        const data = await response.json();
        return data || [];
    } catch (error) {
        console.error("Error loading session via API:", error);
        return [];
    }
};

export const saveSessionMessages = async (participantId: string, scenarioName: string, messages: Message[]) => {
    const key = `session:${participantId}:${scenarioName}`;
    try {
        await fetch('/api/kv', {
            method: 'POST',
            body: JSON.stringify({ key, value: messages }),
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("Error saving session via API:", error);
    }
};

export const getAllSessionKeys = async (): Promise<string[]> => {
    try {
        const response = await fetch('/api/kv?all=true');
        const data = await response.json();
        return data || [];
    } catch (error) {
        console.error("Error getting all keys via API:", error);
        return [];
    }
};
