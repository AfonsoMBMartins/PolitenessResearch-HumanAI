import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllSessionKeys, getSessionMessages, deleteSession, getSystemPrompt, saveSystemPrompt, deleteAllSessions, saveInvitation } from '../services/kv';
import { SYSTEM_PROMPT as DEFAULT_PROMPT } from '../config/prompt';
import { Trash2, Loader2, Link, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function Admin() {
    const [sessions, setSessions] = useState<string[]>([]);
    const [participant, setParticipant] = useState('Test');
    const [scenario, setScenario] = useState('');
    const [model, setModel] = useState('gpt-4o');
    const [temperature, setTemperature] = useState(1.0);
    const [systemPrompt, setSystemPrompt] = useState(DEFAULT_PROMPT);
    const [isSavingPrompt, setIsSavingPrompt] = useState(false);
    const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
    const [isDbConnected, setIsDbConnected] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedSessionLog, setSelectedSessionLog] = useState<{ id: string, log: string } | null>(null);
    const [isSessionLoading, setIsSessionLoading] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    const navigate = useNavigate();

    useEffect(() => {
        loadSessions();
        loadPrompt();
    }, []);

    const loadPrompt = async () => {
        try {
            const prompt = await getSystemPrompt();
            if (prompt !== null) {
                setSystemPrompt(prompt);
                setIsDbConnected(true);
            } else {
                setIsDbConnected(false);
            }
        } catch (error) {
            setIsDbConnected(false);
        }
    };

    const loadSessions = async () => {
        setIsLoading(true);
        const keys = await getAllSessionKeys();
        setSessions(keys.sort());
        setIsLoading(false);
    };

    const handleCreateSession = (e: React.FormEvent) => {
        e.preventDefault();
        if (!scenario.trim()) return;
        navigate(`/chat?participant=${participant}&scenario=${scenario}&model=${model}&temperature=${temperature}`);
    };

    const handleGetLink = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (!scenario.trim()) return;
        
        // Generate a random 6-character code
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const config = { 
            participant, 
            scenario, 
            model, 
            temperature, 
            mode: 'participant' 
        };
        
        const success = await saveInvitation(code, config);
        if (success) {
            const link = `${window.location.origin}/chat?code=${code}`;
            navigator.clipboard.writeText(link);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } else {
            alert("Failed to generate code link. Please try again.");
        }
    };

    const viewSession = async (key: string) => {
        setIsSessionLoading(true);
        const parts = key.split(':');
        if (parts.length < 3) {
            setIsSessionLoading(false);
            return;
        }
        const pId = parts[1];
        const sName = parts.slice(2).join(':');
        try {
            const msgs = await getSessionMessages(pId, sName);
            const logText = msgs.map(m => `[${m.role.toUpperCase()}] (${new Date(m.timestamp).toLocaleString()})\n${m.content}`).join('\n\n');
            setSelectedSessionLog({ id: key, log: logText });
        } catch (error) {
            console.error("Error viewing session:", error);
        } finally {
            setIsSessionLoading(false);
        }
    };

    const exportSelectedAsTxt = () => {
        if (!selectedSessionLog) return;
        const blob = new Blob([selectedSessionLog.log], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedSessionLog.id.replace(/:/g, '_')}.txt`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    const exportSelectedAsJson = async () => {
        if (!selectedSessionLog) return;
        const parts = selectedSessionLog.id.split(':');
        const msgs = await getSessionMessages(parts[1], parts.slice(2).join(':'));
        const blob = new Blob([JSON.stringify(msgs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedSessionLog.id.replace(/:/g, '_')}.json`;
        document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
    };

    const handleDeleteSession = async () => {
        if (!selectedSessionLog) return;
        const confirmDelete = window.confirm(`Are you sure you want to delete session: ${selectedSessionLog.id}?`);
        if (!confirmDelete) return;

        const success = await deleteSession(selectedSessionLog.id);
        if (success) {
            setSelectedSessionLog(null);
            loadSessions();
        } else {
            alert('Failed to delete session. Please check console.');
        }
    };

    const handleDeleteAll = async () => {
        if (sessions.length === 0) return;
        const confirmDelete = window.confirm(`Are you sure you want to delete ALL ${sessions.length} sessions? This cannot be undone.`);
        if (!confirmDelete) return;

        const success = await deleteAllSessions();
        if (success) {
            setSelectedSessionLog(null);
            loadSessions();
            alert('All sessions deleted.');
        } else {
            alert('Failed to delete all sessions.');
        }
    };

    const handleSavePrompt = async () => {
        setIsSavingPrompt(true);
        const success = await saveSystemPrompt(systemPrompt);
        setIsSavingPrompt(false);
        if (success) {
            alert('System prompt updated successfully!');
            setIsPromptModalOpen(false);
        } else {
            alert('Failed to update system prompt.');
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8 font-sans">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Admin Console</h1>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsPromptModalOpen(true)}
                        className="bg-white border border-gray-300 text-gray-700 px-5 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
                    >
                        System Instructions
                    </button>
                    <button
                        onClick={() => navigate('/transcript')}
                        className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-5 py-2 rounded-xl text-sm font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
                    >
                        Transcript
                    </button>
                </div>
            </div>

            {/* Modal for System Prompt */}
            {isPromptModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div className="flex items-center gap-3">
                                <h2 className="font-bold text-gray-800">System Instructions</h2>
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white border border-gray-200 shadow-sm">
                                    <span className={`w-2 h-2 rounded-full ${isDbConnected === true ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                                        isDbConnected === false ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                                            'bg-gray-300'
                                        }`}></span>
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">
                                        {isDbConnected === true ? 'Database Connected' :
                                            isDbConnected === false ? 'Connection Error' :
                                                'Checking...'}
                                    </span>
                                </div>
                            </div>
                            <button onClick={() => setIsPromptModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto">
                            <p className="text-sm text-gray-500 mb-4 italic">
                                Note: This will be the initial instructions given to the AI for all NEW sessions.
                            </p>
                            <textarea
                                value={systemPrompt}
                                onChange={e => setSystemPrompt(e.target.value)}
                                className="w-full h-80 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-black focus:border-transparent focus:outline-none font-mono text-sm leading-relaxed"
                            />
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button
                                onClick={() => setIsPromptModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSavePrompt}
                                disabled={isSavingPrompt}
                                className="bg-black text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-800 transition disabled:opacity-50"
                            >
                                {isSavingPrompt ? 'Saving...' : 'Save Instructions'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Create New Session</h2>
                <form onSubmit={handleCreateSession} className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                    <div className="w-full sm:w-auto">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Participant ID</label>
                        <select
                            value={participant}
                            onChange={e => setParticipant(e.target.value)}
                            className="w-full sm:w-auto border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                            <option value="Test">Test</option>
                            {Array.from({ length: 12 }, (_, i) => `P${String(i + 1).padStart(2, '0')}`).map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-full sm:w-auto">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                        <select
                            value={model}
                            onChange={e => setModel(e.target.value)}
                            className="w-full sm:w-auto border border-gray-300 rounded-lg px-4 py-2.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                            <option value="gpt-4o-mini">GPT-4o mini</option>
                            <option value="gpt-4o">GPT-4o</option>
                        </select>
                    </div>
                    <div className="w-full sm:w-auto">
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between">
                            <span>Temperature</span>
                            <span className="font-mono text-indigo-600 ml-2">{temperature.toFixed(1)}</span>
                        </label>
                        <div className="flex items-center gap-2 h-[46px]">
                            <input
                                type="range"
                                min="0"
                                max="2"
                                step="0.1"
                                value={temperature}
                                onChange={e => setTemperature(parseFloat(e.target.value))}
                                className="w-full sm:w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                        </div>
                    </div>
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Scenario Name</label>
                        <input
                            type="text"
                            value={scenario}
                            onChange={e => setScenario(e.target.value)}
                            placeholder="e.g. scenario_1"
                            required
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                    </div>
                    <div className="flex w-full sm:w-auto gap-2 items-end">
                        <div className="relative group flex-1 sm:flex-none">
                            <AnimatePresence>
                                {isCopied && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10, x: '-50%' }}
                                        animate={{ opacity: 1, y: 0, x: '-50%' }}
                                        exit={{ opacity: 0, y: 10, x: '-50%' }}
                                        className="absolute -top-12 left-1/2 bg-gray-900 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none"
                                    >
                                        Copied to clipboard!
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900" />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <button 
                                type="button"
                                onClick={handleGetLink}
                                disabled={!scenario.trim()}
                                title="Get Session Link"
                                className={`w-full h-[46px] flex items-center justify-center border transition-all duration-300 px-4 rounded-lg font-medium shadow-sm ${
                                    isCopied 
                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-600 scale-105' 
                                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 active:scale-95 disabled:opacity-30 disabled:grayscale'
                                }`}
                            >
                                {isCopied ? (
                                    <Check className="w-4 h-4" />
                                ) : (
                                    <Link className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                        <button type="submit" className="flex-1 sm:flex-none h-[46px] bg-indigo-600 text-white px-6 rounded-lg font-medium hover:bg-indigo-700 transition shadow-sm active:scale-95">
                            Enter Session
                        </button>
                    </div>
                </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6 max-h-[600px]">
                <div className="border border-gray-200 rounded-xl overflow-hidden flex flex-col shadow-sm">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 shrink-0">
                        <div className="flex justify-between items-center">
                            <h2 className="font-bold text-gray-800 flex items-center gap-2">
                                Existing Sessions
                                <span className={`w-2 h-2 rounded-full ${isDbConnected === true ? 'bg-green-500' : isDbConnected === false ? 'bg-red-500' : 'bg-yellow-400'} shadow-sm`}></span>
                            </h2>
                            <button onClick={loadSessions} className="text-xs text-indigo-600 hover:text-indigo-800 font-bold transition-colors">Refresh</button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto bg-white">
                        <ul className="divide-y divide-gray-200">
                            {isLoading ? (
                                <li className="p-4 text-gray-500 text-sm">Loading sessions...</li>
                            ) : sessions.length === 0 ? (
                                <li className="p-4 text-gray-500 text-sm italic">No sessions found.</li>
                            ) : (
                                sessions.map(key => (
                                    <li key={key}>
                                        <button
                                            onClick={() => viewSession(key)}
                                            className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between group transition ${selectedSessionLog?.id === key ? 'bg-indigo-50/50' : ''}`}
                                        >
                                            <span className={`font-medium truncate text-sm ${selectedSessionLog?.id === key ? 'text-indigo-700' : 'text-gray-600'}`}>
                                                {key.replace('session:', '')}
                                            </span>
                                        </button>
                                    </li>
                                ))
                            )}
                        </ul>

                    </div>

                    {/* Fixed Footer for Delete All Sessions */}
                    <div className="p-4 border-t border-gray-100 bg-gray-50/30 flex justify-center shrink-0">
                        <button
                            onClick={handleDeleteAll}
                            disabled={sessions.length === 0 || isLoading}
                            title="Delete All Sessions"
                            className="p-3 bg-white text-red-500 hover:bg-red-500 hover:text-white disabled:bg-gray-50 disabled:text-gray-300 disabled:border-gray-200 disabled:shadow-none rounded-full transition-all shadow-md border border-gray-200 hover:scale-110 active:scale-95 group"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="border border-gray-200 rounded-xl bg-white flex flex-col h-[600px] shadow-sm overflow-hidden">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between shrink-0 h-[49px]">
                        <h2 className="font-semibold text-gray-800 flex items-center gap-2 truncate pr-2">
                            {selectedSessionLog ? (
                                <span className="truncate">Log: {selectedSessionLog.id.replace('session:', '')}</span>
                            ) : 'Session Log'}
                            {isSessionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />}
                        </h2>
                        {selectedSessionLog && (
                            <div className="flex gap-2">
                                <button onClick={exportSelectedAsTxt} className="text-xs font-medium bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-md transition shadow-sm">Export .txt</button>
                                <button onClick={exportSelectedAsJson} className="text-xs font-medium bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-md transition shadow-sm">Export .json</button>
                                <button onClick={handleDeleteSession} className="text-xs font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 px-3 py-1.5 rounded-md transition shadow-sm">Delete</button>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 bg-gray-900 text-gray-100 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                        {selectedSessionLog ? selectedSessionLog.log : <span className="text-gray-500">Select a session to view its conversation log.</span>}
                    </div>
                </div>
            </div>
        </div>
    );
}
