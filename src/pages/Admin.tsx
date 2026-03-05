import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllSessionKeys, getSessionMessages } from '../services/kv';

export function Admin() {
    const [sessions, setSessions] = useState<string[]>([]);
    const [participant, setParticipant] = useState('P01');
    const [scenario, setScenario] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const [selectedSessionLog, setSelectedSessionLog] = useState<{ id: string, log: string } | null>(null);

    const navigate = useNavigate();

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        setIsLoading(true);
        const keys = await getAllSessionKeys();
        setSessions(keys.sort());
        setIsLoading(false);
    };

    const handleCreateSession = (e: React.FormEvent) => {
        e.preventDefault();
        if (!scenario.trim()) return;
        navigate(`/chat?participant=${participant}&scenario=${scenario}`);
    };

    const viewSession = async (key: string) => {
        // key is e.g. session:P01:scenario_1
        const parts = key.split(':');
        if (parts.length < 3) return;
        const pId = parts[1];
        const sName = parts.slice(2).join(':');
        const msgs = await getSessionMessages(pId, sName);

        // Format JSON objects cleanly for reading
        const logText = msgs.map(m => `[${m.role.toUpperCase()}] (${new Date(m.timestamp).toLocaleString()})\n${m.content}`).join('\n\n');
        setSelectedSessionLog({ id: key, log: logText });
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

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8 font-sans">
            <h1 className="text-3xl font-bold">Researcher Dashboard</h1>

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
                            {Array.from({ length: 12 }, (_, i) => `P${String(i + 1).padStart(2, '0')}`).map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
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
                    <button type="submit" className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition">
                        Start Chat
                    </button>
                </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6 max-h-[600px]">
                <div className="border border-gray-200 rounded-xl overflow-hidden flex flex-col shadow-sm">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center shrink-0">
                        <h2 className="font-semibold text-gray-800">Existing Sessions</h2>
                        <button onClick={loadSessions} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Refresh</button>
                    </div>
                    <ul className="divide-y divide-gray-200 flex-1 overflow-y-auto bg-white">
                        {isLoading ? (
                            <li className="p-4 text-gray-500 text-sm">Loading sessions...</li>
                        ) : sessions.length === 0 ? (
                            <li className="p-4 text-gray-500 text-sm">No sessions found in Vercel KV.</li>
                        ) : (
                            sessions.map(key => (
                                <li key={key}>
                                    <button
                                        onClick={() => viewSession(key)}
                                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between group transition"
                                    >
                                        <span className="font-medium text-indigo-600 truncate text-sm">{key}</span>
                                    </button>
                                </li>
                            ))
                        )}
                    </ul>
                </div>

                <div className="border border-gray-200 rounded-xl bg-white flex flex-col h-[600px] shadow-sm">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
                        <h2 className="font-semibold text-gray-800">
                            {selectedSessionLog ? `Log: ${selectedSessionLog.id}` : 'Session Log'}
                        </h2>
                        {selectedSessionLog && (
                            <div className="flex gap-2">
                                <button onClick={exportSelectedAsTxt} className="text-xs font-medium bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-md transition shadow-sm">Export .txt</button>
                                <button onClick={exportSelectedAsJson} className="text-xs font-medium bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-md transition shadow-sm">Export .json</button>
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
