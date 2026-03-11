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

  it('renders assistant markdown blocks into structured content', () => {
    const root = document.createElement('div');
    const state = createInitialState();
    state.messages = [
      {
        messageId: 'msg_1',
        sessionId: 'sess_1',
        role: 'assistant',
        content: '## 标题\n\n- 列表项\n\n> 引用',
        source: 'llm',
        createdAt: new Date().toISOString(),
      },
    ];

    renderApp(root, state);

    expect(root.querySelector('.md-heading-2')?.textContent).toBe('标题');
    expect(root.querySelector('.md-list-item')?.textContent).toBe('列表项');
    expect(root.querySelector('.md-blockquote')?.textContent).toContain('引用');
  });

  it('renders the text composer without a voice button', () => {
    const root = document.createElement('div');
    const state = createInitialState();

    renderApp(root, state);

    expect(root.querySelector('#voice-button')).toBeNull();
    expect(root.querySelector<HTMLTextAreaElement>('#text-input')?.placeholder).toContain('系统语音输入');
  });

  it('renders a PIN unlock screen when auth is required', () => {
    const root = document.createElement('div');
    const state = createInitialState();
    state.authEnabled = true;
    state.authRequired = true;
    state.pinDraft = '123';

    renderApp(root, state);

    expect(root.querySelectorAll('.auth-pin-digit')).toHaveLength(6);
    expect(root.querySelector('#unlock-button')).not.toBeNull();
    expect(root.textContent).toContain('输入 6 位 PIN');
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

  it('shows Tesla system dictation hint in the composer placeholder', () => {
    const root = document.createElement('div');
    const state = createInitialState();

    renderApp(root, state);

    expect(root.querySelector<HTMLTextAreaElement>('#text-input')?.placeholder).toContain('系统语音输入');
  });

  it('places the send button next to the text input when draft exists', () => {
    const root = document.createElement('div');
    const state = createInitialState();
    state.draftText = '你好';

    renderApp(root, state);

    expect(root.querySelector('.composer-row #send-button')).not.toBeNull();
  });

  it('hides the send button when draft is empty', () => {
    const root = document.createElement('div');
    const state = createInitialState();

    renderApp(root, state);

    expect(root.querySelector('#send-button')?.className).toContain('send-icon-button-hidden');
  });
});
