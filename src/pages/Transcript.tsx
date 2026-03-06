import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllSessionKeys, getSessionMessages, getSessionMetadata } from '../services/kv';
import { Message } from '../types';
import { RefreshCw, Clock, ArrowLeft, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function Transcript() {
    const [sessions, setSessions] = useState<string[]>([]);
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const [isDbConnected, setIsDbConnected] = useState<boolean | null>(null);
    const [timer, setTimer] = useState(0);
    const [startTime, setStartTime] = useState<string | null>(null);
    const [totalGlobalCost, setTotalGlobalCost] = useState(0);

    // Derived session info
    const sessionParts = selectedKey?.split(':') || [];
    const participantId = sessionParts[1] || '';
    const scenarioName = sessionParts.slice(2).join(':') || '';

    const navigate = useNavigate();
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadSessions();
        return () => stopPolling();
    }, []);

    useEffect(() => {
        if (selectedKey) {
            refreshMessages(true);
            startPolling();
        } else {
            stopPolling();
            setMessages([]);
            setTimer(0);
            setStartTime(null);
        }
    }, [selectedKey]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (startTime) {
            interval = setInterval(() => {
                const elapsed = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
                setTimer(Math.max(0, elapsed));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [startTime]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const calculateSessionCost = (msgs: Message[]) => {
        let inputChars = 0;
        let outputChars = 0;
        msgs.forEach(msg => {
            if (msg.role === 'assistant') outputChars += (msg.content?.length || 0);
            else inputChars += (msg.content?.length || 0);
        });
        const inputTokens = Math.ceil(inputChars / 4);
        const outputTokens = Math.ceil(outputChars / 4);
        return (inputTokens * 0.0000025) + (outputTokens * 0.00001);
    };

    const calculateStats = (msgs: Message[]) => {
        let inputChars = 0;
        let outputChars = 0;

        msgs.forEach(msg => {
            if (msg.role === 'assistant') {
                outputChars += (msg.content?.length || 0);
            } else {
                inputChars += (msg.content?.length || 0);
            }
        });

        const inputTokens = Math.ceil(inputChars / 4);
        const outputTokens = Math.ceil(outputChars / 4);

        // GPT-4o pricing: $2.50 per 1M input tokens, $10.00 per 1M output tokens
        const cost = (inputTokens * 0.0000025) + (outputTokens * 0.00001);

        return {
            totalTokens: inputTokens + outputTokens,
            cost: cost.toFixed(4)
        };
    };

    const stats = calculateStats(messages);

    useEffect(() => {
        // Target the actual scrollable main element
        const scrollContainer = messagesEndRef.current?.closest('main');
        if (scrollContainer) {
            const isAtBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop <= scrollContainer.clientHeight + 150;
            if (isAtBottom) {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }, [messages]);

    const loadSessions = async () => {
        try {
            const keys = await getAllSessionKeys();
            if (keys) {
                const sortedKeys = keys.sort();
                setSessions(sortedKeys);
                setIsDbConnected(true);

                // Calculate total cost for all sessions
                const costPromises = sortedKeys.map(async (key) => {
                    const parts = key.split(':');
                    if (parts.length < 3) return 0;
                    const pId = parts[1];
                    const sName = parts.slice(2).join(':');
                    const msgs = await getSessionMessages(pId, sName);
                    return calculateSessionCost(msgs);
                });

                const costs = await Promise.all(costPromises);
                setTotalGlobalCost(costs.reduce((sum, c) => sum + c, 0));
            } else {
                setIsDbConnected(false);
            }
        } catch (error) {
            setIsDbConnected(false);
        }
    };

    const refreshMessages = async (showLoading = false) => {
        if (!selectedKey) return;
        if (showLoading) setIsLoading(true);
        try {
            const parts = selectedKey.split(':');
            if (parts.length < 3) return;
            const pId = parts[1];
            const sName = parts.slice(2).join(':');

            const [msgs, metadata] = await Promise.all([
                getSessionMessages(pId, sName),
                getSessionMetadata(pId, sName)
            ]);

            setMessages(msgs);

            if (metadata?.startTime) {
                setStartTime(metadata.startTime);
                const elapsed = Math.floor((Date.now() - new Date(metadata.startTime).getTime()) / 1000);
                setTimer(Math.max(0, elapsed));
            }

            setIsDbConnected(true);
        } catch (error) {
            setIsDbConnected(false);
        } finally {
            if (showLoading) setIsLoading(false);
        }
    };

    const startPolling = () => {
        stopPolling();
        setIsPolling(true);
        pollIntervalRef.current = setInterval(() => {
            refreshMessages();
        }, 3000); // Poll every 3 seconds
    };

    const stopPolling = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
        setIsPolling(false);
    };

    return (
        <div className="flex h-screen bg-gray-50 font-sans">
            {/* Sidebar - Session List */}
            <div className="w-80 border-r border-gray-200 bg-white flex flex-col pt-4">
                <div className="px-4 mb-4 flex justify-between items-center">
                    <h2 className="font-bold text-gray-800">Active Sessions</h2>
                    <button onClick={loadSessions} className="text-gray-400 hover:text-indigo-600">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {sessions.map(key => (
                        <button
                            key={key}
                            onClick={() => setSelectedKey(key)}
                            className={`w-full text-left px-4 py-3 text-sm transition-colors border-l-4 ${selectedKey === key
                                ? 'bg-indigo-50 border-indigo-600 text-indigo-700 font-medium'
                                : 'border-transparent text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <div className="truncate">{key}</div>
                        </button>
                    ))}
                </div>
                <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Total Research Cost</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-emerald-600 font-mono text-lg font-bold">${totalGlobalCost.toFixed(4)}</span>
                            <span className="text-[10px] text-gray-400 font-medium">USD</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content - Transcript */}
            <div className="flex-1 flex flex-col">
                <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/admin')}
                            className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition"
                            title="Back to Admin"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900 leading-none">Live Transcript</h1>
                            {selectedKey && (
                                <div className="flex items-center gap-3 mt-2">
                                    <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-100 rounded-full">
                                        <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-600 animate-pulse" />
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Research Session</span>
                                        <div className="h-3 w-[1px] bg-gray-200 mx-1" />
                                        <span className="text-xs font-bold text-gray-700">{participantId}</span>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1 bg-gray-50/50 border border-gray-100/50 rounded-full">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Scenario</span>
                                        <div className="h-3 w-[1px] bg-gray-200 mx-1" />
                                        <span className="text-xs font-medium text-gray-600">{scenarioName}</span>
                                    </div>
                                    {timer < 1800 && (
                                        <div className="flex items-center gap-1.5 text-gray-400 font-mono text-xs tabular-nums bg-gray-50/50 px-3 py-1 rounded-full border border-gray-100/50">
                                            <Clock className="w-3.5 h-3.5" />
                                            {formatTime(timer)}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 px-3 py-1 bg-gray-50/50 border border-gray-100/50 rounded-full">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Usage</span>
                                        <div className="h-3 w-[1px] bg-gray-200 mx-1" />
                                        <span className="text-xs font-bold text-gray-700">
                                            {stats.totalTokens.toLocaleString()} tokens
                                            <span className="text-gray-300 mx-1.5">|</span>
                                            <span className="text-emerald-600">${stats.cost}</span>
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-100 shadow-sm transition-all hover:border-gray-200">
                            <span className={`w-2 h-2 rounded-full ${isDbConnected === true ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' :
                                isDbConnected === false ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.4)]' :
                                    'bg-gray-300'
                                }`}></span>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">
                                {isDbConnected === true ? 'Connected' :
                                    isDbConnected === false ? 'Error' :
                                        'Validating...'}
                            </span>
                        </div>
                        {isPolling && (
                            <div className="flex items-center gap-2 text-[10px] text-indigo-600 font-bold uppercase tracking-tight bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full animate-pulse">
                                <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                                Monitoring
                            </div>
                        )}
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto bg-gray-50/50">
                    <div className="max-w-3xl mx-auto p-8 space-y-8">
                        {!selectedKey ? (
                            <div className="h-[70vh] flex flex-col items-center justify-center text-gray-400 space-y-2">
                                <Clock className="w-8 h-8 opacity-20" />
                                <p>Select a session from the sidebar to start tracking</p>
                            </div>
                        ) : isLoading ? (
                            <div className="h-[70vh] flex flex-col items-center justify-center text-gray-400 space-y-4">
                                <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                                <div className="text-center">
                                    <p className="font-bold text-gray-900 tracking-tight">Loading session...</p>
                                    <p className="text-sm">Fetching messages and metadata</p>
                                </div>
                            </div>
                        ) : messages.length === 0 ? (
                            <div className="text-center py-20 text-gray-400 italic font-medium">
                                Waiting for messages...
                            </div>
                        ) : (
                            messages.filter(m => m.role !== 'system').map((msg) => (
                                <div key={msg.id} className="flex flex-col space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 tracking-wider rounded ${msg.role === 'user' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-500 shadow-sm'
                                            }`}>
                                            {msg.role === 'user' ? participantId : msg.role}
                                        </span>
                                        <span className="text-[10px] font-medium text-gray-400">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className={`p-6 rounded-2xl text-base leading-relaxed tracking-tight shadow-sm border transition-all ${msg.role === 'user' ? 'bg-indigo-50 border-indigo-100/50 text-indigo-900' : 'bg-white border-gray-200/60 text-gray-800'
                                        }`}>
                                        <div className="prose prose-indigo max-w-none prose-p:leading-relaxed prose-pre:bg-gray-900 prose-pre:text-gray-100">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} className="h-12" />
                    </div>
                </div>
            </div>
        </div>
    );
}
