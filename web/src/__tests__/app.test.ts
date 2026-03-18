import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api.js', () => ({
  clearSessionContext: vi.fn(),
  createSession: vi.fn(),
  fetchAuthConfig: vi.fn(),
  fetchMessages: vi.fn(),
  sendTextMessageStream: vi.fn(),
  unlockWithPin: vi.fn(),
}));

import { TeslaOpenClawApp } from '../app.js';
import { clearSessionContext, createSession, sendTextMessageStream } from '../api.js';

describe('TeslaOpenClawApp keyboard send behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('sends on Enter and keeps Shift+Enter for newline', async () => {
    vi.mocked(sendTextMessageStream).mockResolvedValue({
      ok: true,
      data: {
        requestId: 'req_1',
        sessionId: 'sess_1',
        userMessage: {
          messageId: 'msg_user_1',
          sessionId: 'sess_1',
          role: 'user',
          content: '你好',
          source: 'text',
          createdAt: new Date().toISOString(),
        },
        assistantMessage: {
          messageId: 'msg_assistant_1',
          sessionId: 'sess_1',
          role: 'assistant',
          content: '收到',
          source: 'llm',
          createdAt: new Date().toISOString(),
        },
        status: 'idle',
      },
    });

    const root = document.createElement('div');
    const app = new TeslaOpenClawApp(root) as unknown as {
      state: {
        sessionId: string | null;
        sessionToken: string | null;
        draftText: string;
      };
      bindEvents(): void;
      render(): void;
    };

    app.state.sessionId = 'sess_1';
    app.state.sessionToken = 'token_1';
    app.state.draftText = '你好';
    app.bindEvents();
    app.render();

    const textarea = root.querySelector<HTMLTextAreaElement>('#text-input');
    expect(textarea).not.toBeNull();

    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    textarea?.dispatchEvent(enterEvent);
    await Promise.resolve();

    expect(sendTextMessageStream).toHaveBeenCalledTimes(1);

    const shiftEnterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    textarea?.dispatchEvent(shiftEnterEvent);
    await Promise.resolve();

    expect(sendTextMessageStream).toHaveBeenCalledTimes(1);
  });

  it('clears conversation context after menu confirm', async () => {
    vi.mocked(clearSessionContext).mockResolvedValue({
      ok: true,
      data: {
        sessionId: 'sess_1',
        cleared: true,
      },
    });

    const root = document.createElement('div');
    const app = new TeslaOpenClawApp(root) as unknown as {
      state: {
        sessionId: string | null;
        sessionToken: string | null;
        messages: Array<{ messageId: string; sessionId: string; role: 'assistant'; content: string; source: 'llm'; createdAt: string }>;
      };
      bindEvents(): void;
      render(): void;
    };

    app.state.sessionId = 'sess_1';
    app.state.sessionToken = 'token_1';
    app.state.messages = [
      {
        messageId: 'msg_1',
        sessionId: 'sess_1',
        role: 'assistant',
        content: '旧上下文',
        source: 'llm',
        createdAt: new Date().toISOString(),
      },
    ];
    app.bindEvents();
    app.render();

    root.querySelector<HTMLButtonElement>('#header-menu-button')?.click();
    root.querySelector<HTMLButtonElement>('#clear-context-button')?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(clearSessionContext).toHaveBeenCalledWith('sess_1', 'token_1', null);
    expect(createSession).not.toHaveBeenCalled();
    expect(app.state.messages).toHaveLength(0);
    expect(app.state.sessionId).toBe('sess_1');
    expect(app.state.sessionToken).toBe('token_1');
  });

  it('returns to the PIN gate when clear-context gets AUTH_REQUIRED', async () => {
    vi.mocked(clearSessionContext).mockResolvedValue({
      ok: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: '请先输入 PIN 码解锁',
        retryable: false,
      },
    });

    const root = document.createElement('div');
    const app = new TeslaOpenClawApp(root) as unknown as {
      state: {
        authEnabled: boolean;
        authToken: string | null;
        authExpiresAt: string | null;
        authRequired: boolean;
        sessionId: string | null;
        sessionToken: string | null;
        messages: Array<{ messageId: string; sessionId: string; role: 'assistant'; content: string; source: 'llm'; createdAt: string }>;
      };
      bindEvents(): void;
      render(): void;
    };

    app.state.authEnabled = true;
    app.state.authToken = 'expired_auth_token';
    app.state.authExpiresAt = new Date(Date.now() - 60_000).toISOString();
    app.state.authRequired = false;
    app.state.sessionId = 'sess_1';
    app.state.sessionToken = 'token_1';
    app.state.messages = [
      {
        messageId: 'msg_1',
        sessionId: 'sess_1',
        role: 'assistant',
        content: '旧上下文',
        source: 'llm',
        createdAt: new Date().toISOString(),
      },
    ];
    app.bindEvents();
    app.render();

    root.querySelector<HTMLButtonElement>('#header-menu-button')?.click();
    root.querySelector<HTMLButtonElement>('#clear-context-button')?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(app.state.authRequired).toBe(true);
    expect(app.state.authToken).toBeNull();
    expect(app.state.sessionId).toBeNull();
    expect(root.querySelector('#unlock-button')).not.toBeNull();
  });

  it('closes the header menu when clicking outside the menu area', () => {
    const root = document.createElement('div');
    const app = new TeslaOpenClawApp(root) as unknown as {
      state: {
        isHeaderMenuOpen: boolean;
      };
      bindEvents(): void;
      render(): void;
    };

    app.bindEvents();
    app.render();

    root.querySelector<HTMLButtonElement>('#header-menu-button')?.dispatchEvent(
      new Event('pointerdown', { bubbles: true }),
    );

    expect(app.state.isHeaderMenuOpen).toBe(true);

    root.dispatchEvent(new Event('pointerdown', { bubbles: true }));

    expect(app.state.isHeaderMenuOpen).toBe(false);
  });
});
