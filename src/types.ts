export interface Message {
  id: string;
  role: 'system' | 'user' | 'model' | 'assistant';
  content: string;
  timestamp: string;
}

export interface StudySettings {
  participantId: string;
  systemPrompt: string;
}
