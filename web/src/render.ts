import type { AppState } from './state.js';
import { escapeHtml, renderMarkdown, renderPlainText } from './render-markdown.js';
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

const voiceHintText = (state: AppState): string =>
  state.voiceSupported
    ? '给 OpenClaw 发消息，也可使用系统语音输入后发送'
    : '给 OpenClaw 发消息，Tesla 真机可使用系统语音输入';

const actionButtonLabel = (state: AppState): string => {
  if (state.retryAction) {
    return '重试上一步';
  }

  return '恢复继续';
};

const sendIcon = () => `
  <svg viewBox="0 0 20 20" aria-hidden="true" class="button-icon">
    <path d="M4 10.2 15.4 4.8c.8-.4 1.6.4 1.2 1.2L11.2 17.4c-.3.7-1.3.7-1.6 0l-1.7-4-4-1.7c-.7-.3-.7-1.3.1-1.5Z" fill="currentColor"/>
  </svg>
`;

const micIcon = () => `
  <svg viewBox="0 0 20 20" aria-hidden="true" class="button-icon">
    <path d="M10 13.8a3.6 3.6 0 0 0 3.6-3.6V6a3.6 3.6 0 1 0-7.2 0v4.2A3.6 3.6 0 0 0 10 13.8Zm5-3.9a.9.9 0 1 1 1.8 0 6.8 6.8 0 0 1-5.9 6.7v1.6h2.1a.9.9 0 1 1 0 1.8H7a.9.9 0 0 1 0-1.8h2.1v-1.6a6.8 6.8 0 0 1-5.9-6.7.9.9 0 0 1 1.8 0 5 5 0 1 0 10 0Z" fill="currentColor"/>
  </svg>
`;

export const renderApp = (root: HTMLElement, state: AppState): void => {
  if (state.authEnabled && state.authRequired) {
    const pinDigits = Array.from({ length: 6 }, (_, index) => escapeHtml(state.pinDraft[index] ?? ''));
    root.innerHTML = `
      <main class="shell shell-auth">
        <section class="auth-card">
          <div class="app-title">OpenClaw</div>
          <p class="auth-copy">输入 6 位 PIN 码后继续使用当前 Tesla 会话。</p>
          <div class="auth-pin-grid" role="group" aria-label="PIN 输入">
            ${pinDigits
              .map(
                (digit, index) => `
                  <input
                    class="auth-pin-digit"
                    data-pin-index="${index}"
                    inputmode="numeric"
                    autocomplete="${index === 0 ? 'one-time-code' : 'off'}"
                    pattern="[0-9]*"
                    maxlength="1"
                    value="${digit}"
                    aria-label="PIN 第 ${index + 1} 位"
                  />
                `,
              )
              .join('')}
          </div>
          <div class="composer-row auth-row">
            <button id="unlock-button" class="icon-button auth-button" ${state.isUnlocking || state.pinDraft.length !== 6 ? 'disabled' : ''}>${state.isUnlocking ? '解锁中…' : '解锁'}</button>
          </div>
          <div class="auth-meta">
            <span class="status-pill">${state.networkOnline ? '网络在线' : '网络离线'}</span>
            <span class="error-text auth-error">${state.error ?? ''}</span>
          </div>
        </section>
      </main>
    `;
    return;
  }

  const messageItems = state.messages
    .map(
      (message) => `
        <article class="${messageClassName(message.role)}">
          <div class="message-shell">
            <div class="message-avatar">${message.role === 'assistant' ? 'OC' : '你'}</div>
            <div class="message-body">
              <div class="message-role">${message.role === 'assistant' ? 'OpenClaw' : '你'}</div>
              <div class="message-content">${message.role === 'assistant' ? renderMarkdown(message.content) : renderPlainText(message.content)}</div>
            </div>
          </div>
        </article>
      `,
    )
    .join('');

  const voiceBusy = isVoiceBusyStatus(state.status);
  const textDisabled = state.isSendingText || state.status === 'recording' || voiceBusy;
  const hasDraftText = state.draftText.trim().length > 0;
  const actionButton =
    state.status === 'error'
      ? `<button id="recover-button" class="secondary-button">${actionButtonLabel(state)}</button>`
      : '';

  root.innerHTML = `
    <main class="shell">
      <header class="app-header">
        <div class="app-title">OpenClaw</div>
        <div class="status-bar">
          <div class="status-pill">状态：${statusLabelMap[state.status]}</div>
          <div class="status-pill">${state.sessionId ? '会话已连接' : '正在初始化'}</div>
          <div class="status-pill">${state.networkOnline ? '网络在线' : '网络离线'}</div>
        </div>
      </header>
      <section class="messages" aria-live="polite">
        ${messageItems || '<div class="empty-state"><div class="empty-title">今天想聊什么？</div><div class="empty-copy">可以直接输入，也可以使用车机键盘语音输入。</div></div>'}
      </section>
      <section class="composer">
        <div class="composer-row">
          <textarea id="text-input" class="composer-input" rows="2" placeholder="${voiceHintText(state)}" ${textDisabled ? 'disabled' : ''}>${escapeHtml(state.draftText)}</textarea>
          <button id="send-button" class="icon-button send-icon-button${hasDraftText ? '' : ' send-icon-button-hidden'}" ${textDisabled || !state.sessionId || !hasDraftText ? 'disabled' : ''} aria-label="${state.isSendingText ? '发送中' : '发送消息'}">${state.isSendingText ? '…' : sendIcon()}</button>
        </div>
        <div class="composer-actions">
          <div class="composer-tools">
            <button id="voice-button" class="icon-button voice-tool-button" ${!state.sessionId || !state.voiceSupported || state.isSendingText || voiceBusy ? 'disabled' : ''} aria-label="${voiceButtonLabel(state)}">${micIcon()}</button>
          </div>
          ${actionButton}
          <span class="error-text">${state.error ?? ''}</span>
        </div>
      </section>
    </main>
  `;
};
