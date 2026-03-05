import React, { useState, useEffect } from 'react';
import { StudySettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StudySettings;
  onSave: (settings: StudySettings) => void;
}

export function SettingsModal({ isOpen, onClose, settings, onSave }: SettingsModalProps) {
  const [tempSettings, setTempSettings] = useState<StudySettings>(settings);

  useEffect(() => {
    setTempSettings(settings);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Study Settings</h2>
        
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Participant ID
            </label>
            <input
              type="text"
              value={tempSettings.participantId}
              onChange={(e) => setTempSettings({ ...tempSettings, participantId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              placeholder="e.g., P01"
            />
            <p className="text-xs text-gray-500 mt-1.5">
              Used to identify the participant in the exported transcript.
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              System Prompt (AI Persona)
            </label>
            <textarea
              value={tempSettings.systemPrompt}
              onChange={(e) => setTempSettings({ ...tempSettings, systemPrompt: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-32 resize-none outline-none transition-all"
              placeholder="Instructions for the AI..."
            />
            <p className="text-xs text-amber-600 mt-1.5 bg-amber-50 p-2 rounded-md border border-amber-100">
              Warning: Changing the system prompt will clear the current conversation history.
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSave(tempSettings);
              onClose();
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
