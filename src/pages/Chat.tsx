import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, Loader2 } from 'lucide-react';
import { SYSTEM_PROMPT } from '../config/prompt';
import { getSessionMessages, saveSessionMessages } from '../services/kv';
import { sendMessageToOpenAI } from '../services/openai';
import { Message } from '../types';

export function Chat() {
    const [searchParams] = useSearchParams();
    const participant = searchParams.get('participant');
    const scenario = searchParams.get('scenario');

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!participant || !scenario) return;

        const loadSession = async () => {
            const msgs = await getSessionMessages(participant, scenario);
            if (msgs.length === 0) {
                // Initialize with system prompt
                const initialMessages: Message[] = [{
                    id: Date.now().toString(),
                    role: 'system',
                    content: SYSTEM_PROMPT,
                    timestamp: new Date().toISOString()
                }];
                await saveSessionMessages(participant, scenario, initialMessages);
                setMessages(initialMessages);
            } else {
                setMessages(msgs);
            }
        };
        loadSession();
    }, [participant, scenario]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
    }, [input]);

    if (!participant || !scenario) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 text-gray-500 font-sans">
                Missing participant or scenario parameters in URL. Example: /chat?participant=P01&scenario=scenario_1
            </div>
        );
    }

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: input.trim(),
            timestamp: new Date().toISOString()
        };

        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        // Save user message to KV immediately
        await saveSessionMessages(participant, scenario, newMessages);

        try {
            const assistantMsgId = (Date.now() + 1).toString();
            let assistantContent = '';

            // Add a placeholder message for streaming response
            setMessages(prev => [...prev, {
                id: assistantMsgId,
                role: 'assistant',
                content: '',
                timestamp: new Date().toISOString()
            }]);

            const finalResponse = await sendMessageToOpenAI(newMessages, (text) => {
                assistantContent = text;
                setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: text } : m));
            });

            // Save complete conversation (includes full assistant response) to KV
            const finalAssistantMsg: Message = {
                id: assistantMsgId,
                role: 'assistant',
                content: finalResponse,
                timestamp: new Date().toISOString()
            };

            await saveSessionMessages(participant, scenario, [...newMessages, finalAssistantMsg]);

        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: '[Error: Could not process request. Please check API key or network connection.]',
                timestamp: new Date().toISOString()
            }]);
        } finally {
            setIsLoading(false);
            setTimeout(() => textareaRef.current?.focus(), 10);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans">
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth">
                <div className="max-w-2xl mx-auto space-y-6 pb-20 pt-4">
                    {messages.length <= 1 && (
                        <div className="text-center text-gray-400 text-sm mt-10">
                            Session started. System prompt is active but hidden.
                        </div>
                    )}
                    {messages.filter(m => m.role !== 'system').map(msg => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className={`px-5 py-3.5 max-w-[85%] sm:max-w-[75%] shadow-sm ${msg.role === 'user'
                                        ? 'bg-black text-white rounded-2xl rounded-br-sm'
                                        : 'bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-bl-sm'
                                    }`}
                            >
                                <p className="whitespace-pre-wrap leading-relaxed text-sm sm:text-base">
                                    {msg.content || '...'}
                                </p>
                                <div className={`text-[10px] mt-1.5 select-none font-medium text-right ${msg.role === 'user' ? 'text-gray-400' : 'text-gray-300'}`}>
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} className="h-4" />
                </div>
            </main>

            <footer className="p-4 sm:p-6 shrink-0 max-w-2xl mx-auto w-full absolute bottom-0 md:static bg-gradient-to-t from-gray-50 via-gray-50 to-transparent">
                <div className="relative flex items-end shadow-sm rounded-3xl bg-white border border-gray-200 focus-within:ring-2 focus-within:ring-black focus-within:border-transparent transition-all">
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Type your message..."
                        className="w-full bg-transparent border-none rounded-3xl pl-5 pr-14 py-4 min-h-[56px] resize-none focus:outline-none focus:ring-0  text-sm sm:text-base"
                        rows={1}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 bottom-2 p-2 bg-black text-white rounded-full hover:bg-gray-800 disabled:opacity-50 h-10 w-10 flex items-center justify-center transition"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4 mr-0.5" />}
                    </button>
                </div>
            </footer>
        </div>
    );
}
