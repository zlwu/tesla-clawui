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

export type LlmProvider = {
  generateReply(input: LlmGenerateInput): Promise<string>;
  generateReplyStream(input: LlmGenerateInput, callbacks: LlmStreamCallbacks): Promise<string>;
};
