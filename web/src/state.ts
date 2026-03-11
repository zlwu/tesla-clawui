import type { AppErrorCode, AppStatus, Message } from '@tesla-openclaw/shared';

export type RetryAction =
  | { kind: 'reload-messages' }
  | { kind: 'send-text'; requestId: string; text: string };

export type AppState = {
  authEnabled: boolean;
  authRequired: boolean;
  authToken: string | null;
  authExpiresAt: string | null;
  pinDraft: string;
  isUnlocking: boolean;
  sessionId: string | null;
  sessionToken: string | null;
  status: AppStatus;
  messages: Message[];
  draftText: string;
  error: string | null;
  errorCode: AppErrorCode | null;
  isSendingText: boolean;
  networkOnline: boolean;
  retryAction: RetryAction | null;
};

export const createInitialState = (): AppState => ({
  authEnabled: false,
  authRequired: false,
  authToken: null,
  authExpiresAt: null,
  pinDraft: '',
  isUnlocking: false,
  sessionId: null,
  sessionToken: null,
  status: 'idle',
  messages: [],
  draftText: '',
  error: null,
  errorCode: null,
  isSendingText: false,
  networkOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  retryAction: null,
});
