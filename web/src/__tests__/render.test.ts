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

  it('keeps the textarea node stable across rerenders', () => {
    const root = document.createElement('div');
    const state = createInitialState();

    renderApp(root, state);
    const firstTextarea = root.querySelector<HTMLTextAreaElement>('#text-input');

    state.draftText = '继续输入';
    state.status = 'thinking';
    renderApp(root, state);
    const secondTextarea = root.querySelector<HTMLTextAreaElement>('#text-input');

    expect(firstTextarea).toBe(secondTextarea);
    expect(secondTextarea?.value).toBe('继续输入');
  });

  it('keeps the last message node stable during streaming updates', () => {
    const root = document.createElement('div');
    const state = createInitialState();
    state.messages = [
      {
        messageId: 'msg_stream',
        sessionId: 'sess_1',
        role: 'assistant',
        content: '第一段',
        source: 'llm',
        createdAt: new Date().toISOString(),
      },
    ];

    renderApp(root, state);
    const firstMessage = root.querySelector<HTMLElement>('[data-message-id="msg_stream"]');

    state.messages = [
      {
        ...state.messages[0]!,
        content: '第一段第二段',
      },
    ];
    renderApp(root, state);
    const secondMessage = root.querySelector<HTMLElement>('[data-message-id="msg_stream"]');

    expect(firstMessage).toBe(secondMessage);
    expect(secondMessage?.textContent).toContain('第一段第二段');
  });

  it('renders waiting-first-token feedback inside the assistant placeholder', () => {
    const root = document.createElement('div');
    const state = createInitialState();
    state.sessionId = 'sess_1';
    state.responsePhase = 'waiting';
    state.pendingAssistantMessageId = 'local_assistant_req_1';
    state.waitingIndicatorFrame = 2;
    state.messages = [
      {
        messageId: 'local_user_req_1',
        sessionId: 'sess_1',
        role: 'user',
        content: '你好',
        source: 'text',
        createdAt: new Date().toISOString(),
      },
      {
        messageId: 'local_assistant_req_1',
        sessionId: 'sess_1',
        role: 'assistant',
        content: '',
        source: 'llm',
        createdAt: new Date().toISOString(),
      },
    ];

    renderApp(root, state);

    expect(root.textContent).toContain('正在等待回复...');
  });

  it('shows a back-to-bottom button while browsing history', () => {
    const root = document.createElement('div');
    const state = createInitialState();
    state.sessionId = 'sess_1';
    state.messageFollowMode = 'history';
    state.messages = [
      {
        messageId: 'msg_1',
        sessionId: 'sess_1',
        role: 'assistant',
        content: '历史消息',
        source: 'llm',
        createdAt: new Date().toISOString(),
      },
    ];

    renderApp(root, state);

    expect(root.querySelector('#back-to-bottom-button')).not.toBeNull();
    expect(root.textContent).toContain('回到底部');
  });

  it('keeps the textarea editable while waiting for or streaming a reply', () => {
    const root = document.createElement('div');
    const state = createInitialState();
    state.sessionId = 'sess_1';
    state.responsePhase = 'waiting';

    renderApp(root, state);
    const waitingTextarea = root.querySelector<HTMLTextAreaElement>('#text-input');

    state.responsePhase = 'streaming';
    renderApp(root, state);
    const streamingTextarea = root.querySelector<HTMLTextAreaElement>('#text-input');

    expect(waitingTextarea?.disabled).toBe(false);
    expect(streamingTextarea?.disabled).toBe(false);
  });
});
