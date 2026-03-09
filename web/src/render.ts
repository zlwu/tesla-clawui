import type { AppState } from './state.js';
import { isVoiceBusyStatus, statusLabelMap } from './state-machine.js';

const messageClassName = (role: string) =>
  role === 'assistant' ? 'message message-assistant' : 'message message-user';

const voiceButtonLabel = (state: AppState): string => {
  if (!state.voiceSupported) {
    return '语音不可用';
  }

  if (state.status === 'recording') {
    return '停止并发送';
  }

  return '按一下开始说话';
};

const actionButtonLabel = (state: AppState): string => {
  if (state.retryAction) {
    return '重试上一步';
  }

  return '恢复继续';
};

export const renderApp = (root: HTMLElement, state: AppState): void => {
  const messageItems = state.messages
    .map(
      (message) => `
        <article class="${messageClassName(message.role)}">
          <div class="message-role">${message.role === 'assistant' ? 'OpenClaw' : '你'}</div>
          <p class="message-content">${escapeHtml(message.content)}</p>
        </article>
      `,
    )
    .join('');

  const voiceBusy = isVoiceBusyStatus(state.status);
  const textDisabled = state.isSendingText || state.status === 'recording' || voiceBusy;
  const actionButton =
    state.status === 'error'
      ? `<button id="recover-button" class="secondary-button">${actionButtonLabel(state)}</button>`
      : '';

  root.innerHTML = `
    <main class="shell">
      <header class="status-bar">
        <div class="status-pill">状态：${statusLabelMap[state.status]}</div>
        <div class="status-pill">${state.sessionId ? '会话已连接' : '正在初始化'}</div>
        <div class="status-pill">${state.networkOnline ? '网络在线' : '网络离线'}</div>
      </header>
      <section class="voice-panel">
        <button id="voice-button" class="voice-button" ${!state.sessionId || !state.voiceSupported || state.isSendingText || voiceBusy ? 'disabled' : ''}>${voiceButtonLabel(state)}</button>
        <div class="voice-hint">语音是主入口，文本输入只作为兜底。</div>
      </section>
      <section class="messages" aria-live="polite">
        ${messageItems || '<div class="empty-state">现在可以开始说话，或先输入文本。</div>'}
      </section>
      <section class="composer">
        <label class="composer-label" for="text-input">文本输入（MVP 兜底）</label>
        <textarea id="text-input" class="composer-input" rows="3" placeholder="直接输入要说的话" ${textDisabled ? 'disabled' : ''}>${escapeHtml(state.draftText)}</textarea>
        <div class="composer-actions">
          <button id="send-button" class="send-button" ${textDisabled || !state.sessionId ? 'disabled' : ''}>${state.isSendingText ? '发送中...' : '发送'}</button>
          ${actionButton}
          <span class="error-text">${state.error ?? ''}</span>
        </div>
      </section>
    </main>
  `;
};

const escapeHtml = (value: string): string => {
  let escaped = value;
  escaped = escaped.split('&').join('&amp;');
  escaped = escaped.split('<').join('&lt;');
  escaped = escaped.split('>').join('&gt;');
  escaped = escaped.split('"').join('&quot;');
  escaped = escaped.split("'").join('&#39;');
  return escaped;
};
