export type LlmHistoryMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type LlmGenerateInput = {
  sessionId: string;
  requestId: string;
  text: string;
  history: LlmHistoryMessage[];
};

export type LlmStreamCallbacks = {
  onDelta(delta: string): Promise<void> | void;
};

export type LlmStreamDiagnostics = {
  provider: string;
  completionMarkerObserved: boolean;
  finishReason: string | null;
  deltaCount: number;
  characterCount: number;
  terminationReason: string;
};

export type LlmStreamResult = {
  replyText: string;
  diagnostics: LlmStreamDiagnostics;
};

export type LlmProvider = {
  generateReply(input: LlmGenerateInput): Promise<string>;
  generateReplyStream(input: LlmGenerateInput, callbacks: LlmStreamCallbacks): Promise<LlmStreamResult>;
};
