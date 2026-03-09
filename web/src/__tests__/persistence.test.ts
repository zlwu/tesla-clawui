import { describe, expect, it } from 'vitest';

import { clearPersistedState, persistSessionState, readPersistedState } from '../persistence.js';

describe('persistence', () => {
  it('stores and restores session with recent messages', () => {
    clearPersistedState();

    persistSessionState({
      sessionId: 'sess_1',
      sessionToken: 'token_1',
      messages: [
        {
          messageId: 'msg_1',
          sessionId: 'sess_1',
          role: 'assistant',
          content: 'hello',
          source: 'llm',
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const restored = readPersistedState();

    expect(restored.sessionId).toBe('sess_1');
    expect(restored.sessionToken).toBe('token_1');
    expect(restored.messages).toHaveLength(1);
  });

  it('falls back to empty state for invalid cache', () => {
    localStorage.setItem('tesla-openclaw-session', '{bad json');

    const restored = readPersistedState();

    expect(restored.sessionId).toBeNull();
    expect(restored.sessionToken).toBeNull();
    expect(restored.messages).toHaveLength(0);
  });
});
