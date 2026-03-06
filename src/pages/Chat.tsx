import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowUp, Loader2, ArrowLeft, Square, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SYSTEM_PROMPT as DEFAULT_PROMPT } from '../config/prompt';
import { getSessionMessages, saveSessionMessages, getSystemPrompt, getSessionMetadata, saveSessionMetadata } from '../services/kv';
import { sendMessageToOpenAI } from '../services/openai';
import { Message } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AnimatedEyes } from '../components/AnimatedEyes';

export function Chat() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const participant = searchParams.get('participant');
    const scenario = searchParams.get('scenario');
    const model = searchParams.get('model') || 'gpt-4o-mini';
    const temperature = parseFloat(searchParams.get('temperature') || '1.0');

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [isFeedbackSurprised, setIsFeedbackSurprised] = useState(false);
    const [loadingStep, setLoadingStep] = useState(0);
    const [timer, setTimer] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!participant || !scenario) return;

        const loadSession = async () => {
            setIsInitializing(true);
            setLoadingStep(1); // Connecting to database

            try {
                // Load messages and metadata in parallel
                const [msgs, metadata] = await Promise.all([
                    getSessionMessages(participant, scenario),
                    getSessionMetadata(participant, scenario)
                ]);

                setLoadingStep(2); // Initializing session

                let startTimeIso = metadata?.startTime;

                if (msgs.length === 0) {
                    // New session: create start time if it doesn't exist
                    if (!startTimeIso) {
                        startTimeIso = new Date().toISOString();
                        await saveSessionMetadata(participant, scenario, { startTime: startTimeIso });
                    }

                    // Fetch dynamic system prompt or use default
                    const customizedPrompt = await getSystemPrompt();
                    const activePrompt = customizedPrompt || DEFAULT_PROMPT;

                    // Initialize with system prompt
                    const initialMessages: Message[] = [{
                        id: Date.now().toString(),
                        role: 'system',
                        content: activePrompt,
                        timestamp: new Date().toISOString()
                    }];
                    await saveSessionMessages(participant, scenario, initialMessages);
                    setMessages(initialMessages);
                } else {
                    setMessages(msgs);
                }

                // Set initial timer based on startTime
                if (startTimeIso) {
                    const elapsed = Math.floor((Date.now() - new Date(startTimeIso).getTime()) / 1000);
                    setTimer(Math.max(0, elapsed));
                }

                setLoadingStep(3); // Ready
                setTimeout(() => setIsInitializing(false), 400);
            } catch (err) {
                console.error(err);
                setIsInitializing(false);
            }
        };
        loadSession();
    }, [participant, scenario]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (!isInitializing) {
            interval = setInterval(() => {
                setTimer(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isInitializing]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        const scrollContainer = messagesEndRef.current?.closest('main');
        if (scrollContainer) {
            const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop <= scrollContainer.clientHeight + 150;
            if (isAtBottom) {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, [messages]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
        }
    }, [input]);

    if (isInitializing) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50 font-sans">
                <div className="relative mb-8">
                    <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                            <div className={`w-2 h-2 rounded-full ${loadingStep >= 1 ? 'bg-indigo-600 animate-pulse' : 'bg-gray-200'}`} />
                        </div>
                    </div>
                </div>

                <div className="text-center space-y-2">
                    <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                        {loadingStep === 1 ? 'Connecting to database...' :
                            loadingStep === 2 ? 'Configuring AI system...' :
                                'Starting interaction...'}
                    </h2>
                    <p className="text-sm text-gray-400 font-medium">Please wait a moment</p>
                </div>

                <div className="mt-12 flex gap-1 items-center">
                    {[1, 2, 3].map(i => (
                        <div
                            key={i}
                            className={`h-1 rounded-full transition-all duration-500 ${loadingStep >= i ? 'w-8 bg-indigo-600' : 'w-4 bg-gray-200'
                                }`}
                        />
                    ))}
                </div>
            </div>
        );
    }

    if (!participant || !scenario) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 text-gray-500 font-sans">
                Missing participant or scenario parameters in URL. Example: /chat?participant=P01&scenario=scenario_1
            </div>
        );
    }

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    };

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
        setIsFeedbackSurprised(true);
        setTimeout(() => setIsFeedbackSurprised(false), 800);

        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Save user message to KV immediately
        await saveSessionMessages(participant, scenario, newMessages);

        let assistantMsgId = (Date.now() + 1).toString();
        let assistantContent = '';

        try {
            // Add a placeholder message for streaming response
            setMessages(prev => [...prev, {
                id: assistantMsgId,
                role: 'assistant',
                content: '',
                timestamp: new Date().toISOString()
            }]);

            const finalResponse = await sendMessageToOpenAI(
                newMessages,
                (text) => {
                    assistantContent = text;
                    setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: text } : m));
                },
                model,
                temperature,
                controller.signal
            );

            // If the response was null, it means it was aborted
            if (finalResponse === null) {
                // Keep the content received so far
                const abortedAssistantMsg: Message = {
                    id: assistantMsgId,
                    role: 'assistant',
                    content: assistantContent,
                    timestamp: new Date().toISOString()
                };
                await saveSessionMessages(participant, scenario, [...newMessages, abortedAssistantMsg]);
                return;
            }

            // Save complete conversation (includes full assistant response) to KV
            const finalAssistantMsg: Message = {
                id: assistantMsgId,
                role: 'assistant',
                content: finalResponse,
                timestamp: new Date().toISOString()
            };

            await saveSessionMessages(participant, scenario, [...newMessages, finalAssistantMsg]);

        } catch (err: any) {
            if (err.name === 'AbortError') return;

            console.error(err);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: '[Error: Could not process request. Please check API key or network connection.]',
                timestamp: new Date().toISOString()
            }]);
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
            setTimeout(() => textareaRef.current?.focus(), 10);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50 text-gray-900 font-sans relative">
            {/* Minimal Header */}
            <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between shrink-0 z-10">
                <button
                    onClick={() => navigate('/admin')}
                    className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-black transition px-3 py-1.5 rounded-full hover:bg-gray-100"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Dashboard
                </button>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-full">
                        <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Research Session</span>
                        <div className="h-3 w-[1px] bg-gray-200 mx-1" />
                        <span className="text-xs font-bold text-gray-700">{participant}</span>
                    </div>

                    {timer < 1800 && (
                        <div className="flex items-center gap-1.5 text-gray-400 font-mono text-xs tabular-nums bg-gray-50/50 px-3 py-1.5 rounded-full border border-gray-100/50">
                            <Clock className="w-3.5 h-3.5" />
                            {formatTime(timer)}
                        </div>
                    )}
                </div>
                <div className="w-32 hidden sm:block" /> {/* Spacer for visual balance */}
            </header>

            <main className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth">
                <div className="max-w-4xl mx-auto space-y-6 pb-48 pt-4">
                    {messages.filter(m => m.role !== 'system').length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 px-4">
                            <motion.div layoutId="ai-face-avatar">
                                <AnimatedEyes isFocused={isLoading} isSurprised={isFeedbackSurprised} />
                            </motion.div>
                            <div className="text-center space-y-2 max-w-sm">
                                <h3 className="text-xl font-bold text-gray-900 tracking-tight">How can I help you today?</h3>
                                <p className="text-sm text-gray-500 font-medium">
                                    I'm ready to assist with your research session. Just type a message below to begin our interaction.
                                </p>
                            </div>
                        </div>
                    )}
                    {(() => {
                        const filtered = messages.filter(m => m.role !== 'system');
                        const lastAssistantIdx = [...filtered].reverse().findIndex(m => m.role === 'assistant');
                        const lastAssistantId = lastAssistantIdx !== -1 ? filtered[filtered.length - 1 - lastAssistantIdx].id : null;
                        const hasAssistantReply = lastAssistantId !== null;

                        const elements = filtered.map(msg => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-8 group`}>
                                <div className={`flex items-end gap-3 max-w-[95%] md:max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    {/* Final Avatar Placement (Left of bubble, bottom aligned) */}
                                    {msg.role === 'assistant' && (
                                        <div className="w-10 shrink-0 flex justify-center pb-1">
                                            {msg.id === lastAssistantId && (
                                                <motion.div
                                                    layoutId="ai-face-avatar"
                                                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                                    className="origin-bottom"
                                                >
                                                    <AnimatedEyes key="active-avatar" size="small" isFocused={isLoading} isSurprised={isFeedbackSurprised} />
                                                </motion.div>
                                            )}
                                        </div>
                                    )}

                                    <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                        <div
                                            className={`px-5 py-3.5 shadow-sm transition-all border relative ${msg.role === 'user'
                                                ? 'bg-[#61a0c2] text-white border-[#61a0c2] rounded-3xl rounded-tr-sm'
                                                : 'bg-white border-gray-100 text-gray-800 rounded-3xl rounded-tl-sm'
                                                }`}
                                        >
                                            <div className={`prose prose-xl max-w-none prose-p:leading-relaxed ${msg.role === 'user' ? 'prose-invert text-white' : 'text-gray-800'}`}>
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {msg.content || '...'}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-gray-300 mt-1 font-medium px-2">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ));

                        // If thinking but message hasn't been added to the list yet
                        if (isLoading && !hasAssistantReply) {
                            elements.push(
                                <div key="thinking-placeholder" className="flex justify-start mb-8 group">
                                    <div className="flex items-end gap-3 max-w-[95%] md:max-w-[85%] flex-row">
                                        <div className="w-10 shrink-0 flex justify-center pb-1">
                                            <motion.div
                                                layoutId="ai-face-avatar"
                                                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                                className="origin-bottom"
                                            >
                                                <AnimatedEyes key="active-avatar" size="small" isFocused={true} isSurprised={isFeedbackSurprised} />
                                            </motion.div>
                                        </div>
                                        <div className="flex flex-col items-start pt-2">
                                            <div className="text-[10px] text-gray-300 font-bold uppercase tracking-widest animate-pulse">Thinking...</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        return elements;
                    })()}
                    <div ref={messagesEndRef} className="h-4" />
                </div>
            </main>

            <footer className="fixed bottom-0 left-0 w-full z-20 pt-6">
                {/* Gradual Blur Overlay */}
                <div
                    className="absolute inset-0 bg-gradient-to-t from-gray-50/80 via-gray-50/20 to-transparent backdrop-blur-sm"
                    style={{
                        maskImage: 'linear-gradient(to top, black 80%, transparent)',
                        WebkitMaskImage: 'linear-gradient(to top, black 80%, transparent)'
                    }}
                />
                <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-4 sm:pb-6 relative">
                    <div className="relative flex items-end shadow-xl rounded-3xl bg-white/80 border border-white/60 focus-within:ring-2 focus-within:ring-gray-300/10 focus-within:border-transparent transition-all">
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
                            placeholder="Ask me anything..."
                            className="w-full bg-transparent border-none rounded-3xl pl-5 pr-14 py-4 min-h-[56px] resize-none focus:outline-none focus:ring-0 text-lg placeholder:text-lg placeholder:font-normal placeholder:text-gray-400"
                            rows={1}
                        />
                        {isLoading ? (
                            <button
                                onClick={handleStop}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/5 text-gray-500 rounded-full hover:bg-black/10 transition h-10 w-10 flex items-center justify-center border border-black/5"
                            >
                                <Square className="w-4 h-4 fill-gray-500" />
                            </button>
                        ) : (
                            <button
                                onClick={handleSend}
                                disabled={!input.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-[#61a0c2] text-white rounded-full hover:brightness-90 disabled:opacity-50 h-10 w-10 flex items-center justify-center transition"
                            >
                                <ArrowUp className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            </footer>
        </div>
    );
}
