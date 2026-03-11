import type { Message } from '@tesla-openclaw/shared';

const storageKey = 'tesla-openclaw-session';

type PersistedState = {
  authToken: string | null;
  authExpiresAt: string | null;
  sessionId: string | null;
  sessionToken: string | null;
  messages: Message[];
};

const emptyPersistedState = (): PersistedState => ({
  authToken: null,
  authExpiresAt: null,
  sessionId: null,
  sessionToken: null,
  messages: [],
});

const isMessageArray = (value: unknown): value is Message[] => Array.isArray(value);

const readRawState = (): PersistedState => {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return emptyPersistedState();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedState> | null;
    return {
      authToken: typeof parsed?.authToken === 'string' ? parsed.authToken : null,
      authExpiresAt: typeof parsed?.authExpiresAt === 'string' ? parsed.authExpiresAt : null,
      sessionId: typeof parsed?.sessionId === 'string' ? parsed.sessionId : null,
      sessionToken: typeof parsed?.sessionToken === 'string' ? parsed.sessionToken : null,
      messages: isMessageArray(parsed?.messages) ? parsed.messages : [],
    };
  } catch {
    return emptyPersistedState();
  }
};

export const readPersistedState = (): PersistedState => readRawState();

export const persistSessionState = (params: {
  authToken: string | null;
  authExpiresAt: string | null;
  sessionId: string | null;
  sessionToken: string | null;
  messages: Message[];
}): void => {
  localStorage.setItem(
    storageKey,
    JSON.stringify({
      authToken: params.authToken,
      authExpiresAt: params.authExpiresAt,
      sessionId: params.sessionId,
      sessionToken: params.sessionToken,
      messages: params.messages,
    }),
  );
};

export const clearPersistedState = (): void => {
  localStorage.removeItem(storageKey);
};
