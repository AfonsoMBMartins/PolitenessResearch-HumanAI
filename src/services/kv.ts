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
        // Only return session keys, not metadata or config
        return (data || []).filter((k: string) => k.startsWith('session:'));
    } catch (error) {
        console.error("Error getting all keys via API:", error);
        return [];
    }
};

export const deleteSession = async (key: string): Promise<boolean> => {
    try {
        // Delete the session data
        const response = await fetch(`/api/kv?key=${encodeURIComponent(key)}`, {
            method: 'DELETE'
        });

        // Also attempt to delete metadata if it exists
        const metadataKey = key.replace('session:', 'metadata:');
        await fetch(`/api/kv?key=${encodeURIComponent(metadataKey)}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        return data.success === true;
    } catch (error) {
        console.error("Error deleting session via API:", error);
        return false;
    }
};

export const getSessionMetadata = async (participantId: string, scenarioName: string): Promise<any> => {
    const key = `metadata:${participantId}:${scenarioName}`;
    try {
        const response = await fetch(`/api/kv?key=${key}`);
        const data = await response.json();
        // If data is an empty array (default from API), return null
        return (Array.isArray(data) && data.length === 0) ? null : data;
    } catch (error) {
        console.error("Error loading metadata via API:", error);
        return null;
    }
};

export const saveSessionMetadata = async (participantId: string, scenarioName: string, metadata: any) => {
    const key = `metadata:${participantId}:${scenarioName}`;
    try {
        await fetch('/api/kv', {
            method: 'POST',
            body: JSON.stringify({ key, value: metadata }),
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error("Error saving metadata via API:", error);
    }
};

export const deleteAllSessions = async (): Promise<boolean> => {
    try {
        const response = await fetch('/api/kv?all=true', {
            method: 'DELETE'
        });
        const data = await response.json();
        return data.success === true;
    } catch (error) {
        console.error("Error deleting all sessions via API:", error);
        return false;
    }
};

export const getSystemPrompt = async (): Promise<string | null> => {
    try {
        const response = await fetch('/api/kv?key=config:system_prompt');
        const data = await response.json();
        return data || null;
    } catch (error) {
        console.error("Error loading system prompt:", error);
        return null;
    }
};

export const saveSystemPrompt = async (prompt: string): Promise<boolean> => {
    try {
        const response = await fetch('/api/kv', {
            method: 'POST',
            body: JSON.stringify({ key: 'config:system_prompt', value: prompt }),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        return data.success === true;
    } catch (error) {
        console.error("Error saving system prompt:", error);
        return false;
    }
};
