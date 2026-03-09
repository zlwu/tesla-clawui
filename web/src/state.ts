import type { AppErrorCode, AppStatus, Message } from '@tesla-openclaw/shared';

export type RetryAction =
  | { kind: 'reload-messages' }
  | { kind: 'send-text'; requestId: string; text: string }
  | { kind: 'send-voice'; requestId: string; blob: Blob; mimeType: string; language: string };

export type AppState = {
  sessionId: string | null;
  sessionToken: string | null;
  status: AppStatus;
  messages: Message[];
  draftText: string;
  error: string | null;
  errorCode: AppErrorCode | null;
  isSendingText: boolean;
  voiceSupported: boolean;
  networkOnline: boolean;
  retryAction: RetryAction | null;
};

export const createInitialState = (): AppState => ({
  sessionId: null,
  sessionToken: null,
  status: 'idle',
  messages: [],
  draftText: '',
  error: null,
  errorCode: null,
  isSendingText: false,
  voiceSupported: false,
  networkOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  retryAction: null,
});
