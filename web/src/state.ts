import type { AppErrorCode, AppStatus, Message } from '@tesla-openclaw/shared';

export type RetryAction =
  | { kind: 'reload-messages' }
  | { kind: 'send-text'; requestId: string; text: string };

export type MessageFollowMode = 'follow' | 'history';
export type ResponsePhase = 'idle' | 'waiting' | 'streaming';
export type KeyboardAvoidanceSource = 'none' | 'layout' | 'visual-viewport' | 'focus-fallback';
export type ComposerStatusKind =
  | 'idle'
  | 'booting'
  | 'offline'
  | 'waiting'
  | 'streaming'
  | 'history'
  | 'error';

export type Theme = 'auto' | 'light' | 'dark';

export type AppState = {
  theme: Theme;
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
  messageFollowMode: MessageFollowMode;
  responsePhase: ResponsePhase;
  composerStatusKind: ComposerStatusKind;
  keyboardAvoidanceSource: KeyboardAvoidanceSource;
  restoreFollowOnBlur: boolean;
  pendingAssistantMessageId: string | null;
  waitingIndicatorFrame: number;
  isHeaderMenuOpen: boolean;
  isClearingContext: boolean;
  clearContextError: string | null;
};

const readInitialTheme = (): Theme => {
  try {
    const s = localStorage.getItem('theme');
    if (s === 'light' || s === 'dark') return s;
  } catch { /* localStorage unavailable */ }
  return 'auto';
};

export const createInitialState = (): AppState => ({
  theme: readInitialTheme(),
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
  messageFollowMode: 'follow',
  responsePhase: 'idle',
  composerStatusKind: 'booting',
  keyboardAvoidanceSource: 'none',
  restoreFollowOnBlur: true,
  pendingAssistantMessageId: null,
  waitingIndicatorFrame: 0,
  isHeaderMenuOpen: false,
  isClearingContext: false,
  clearContextError: null,
});
