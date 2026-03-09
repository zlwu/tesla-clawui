import { describe, expect, it } from 'vitest';

import { renderApp } from '../render.js';
import { createInitialState } from '../state.js';

describe('renderApp', () => {
  it('renders a large text message list', () => {
    const root = document.createElement('div');
    const state = createInitialState();
    state.messages = [
      {
        messageId: 'msg_1',
        sessionId: 'sess_1',
        role: 'assistant',
        content: '你好，Tesla。',
        source: 'llm',
        createdAt: new Date().toISOString(),
      },
    ];

    renderApp(root, state);

    expect(root.textContent).toContain('你好，Tesla。');
    expect(root.querySelector('.message-content')).not.toBeNull();
  });

  it('renders the voice button', () => {
    const root = document.createElement('div');
    const state = createInitialState();
    state.voiceSupported = true;

    renderApp(root, state);

    expect(root.querySelector('#voice-button')).not.toBeNull();
    expect(root.textContent).toContain('按一下开始说话');
  });

  it('renders draft text and recover button in error state', () => {
    const root = document.createElement('div');
    const state = createInitialState();
    state.status = 'error';
    state.error = '网络不可用';
    state.draftText = '保留中的文本';
    state.networkOnline = false;
    state.retryAction = { kind: 'reload-messages' };

    renderApp(root, state);

    expect(root.querySelector('#recover-button')).not.toBeNull();
    expect(root.textContent).toContain('重试上一步');
    expect(root.textContent).toContain('网络离线');
    expect(root.querySelector<HTMLTextAreaElement>('#text-input')?.value).toBe('保留中的文本');
  });
});
