import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api.js', () => ({
  createSession: vi.fn(),
  fetchAuthConfig: vi.fn(),
  fetchMessages: vi.fn(),
  sendTextMessageStream: vi.fn(),
  unlockWithPin: vi.fn(),
}));

import { TeslaOpenClawApp } from '../app.js';
import { sendTextMessageStream } from '../api.js';

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
});
