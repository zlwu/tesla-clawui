import type { Message } from '@tesla-openclaw/shared';

import type { AppState } from './state.js';
import { renderMarkdown, renderPlainText } from './render-markdown.js';
import { statusLabelMap } from './state-machine.js';

type MessageRefs = {
  article: HTMLElement;
  content: HTMLElement;
};

type DomRefs = {
  authShell: HTMLElement;
  authDigits: HTMLInputElement[];
  unlockButton: HTMLButtonElement;
  authNetwork: HTMLElement;
  authError: HTMLElement;
  chatShell: HTMLElement;
  statusText: HTMLElement;
  sessionText: HTMLElement;
  networkText: HTMLElement;
  messages: HTMLElement;
  emptyState: HTMLElement;
  textarea: HTMLTextAreaElement;
  sendButton: HTMLButtonElement;
  recoverButton: HTMLButtonElement;
  errorText: HTMLElement;
  messageRefs: Map<string, MessageRefs>;
};

const domRefStore = new WeakMap<HTMLElement, DomRefs>();

const inputHintText = (): string =>
  '给 OpenClaw 发消息，Tesla 真机请使用系统语音输入后发送';

const actionButtonLabel = (state: AppState): string =>
  state.retryAction ? '重试上一步' : '恢复继续';

const sendIcon = () => `
  <svg viewBox="0 0 20 20" aria-hidden="true" class="button-icon">
    <path d="M4 10.2 15.4 4.8c.8-.4 1.6.4 1.2 1.2L11.2 17.4c-.3.7-1.3.7-1.6 0l-1.7-4-4-1.7c-.7-.3-.7-1.3.1-1.5Z" fill="currentColor"/>
  </svg>
`;

const createElement = <K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  options?: { className?: string; textContent?: string },
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tagName);
  if (options?.className) {
    element.className = options.className;
  }
  if (options?.textContent !== undefined) {
    element.textContent = options.textContent;
  }
  return element;
};

const setHidden = (element: HTMLElement, hidden: boolean): void => {
  element.hidden = hidden;
  element.style.display = hidden ? 'none' : '';
};

const createMessageElement = (message: Message): MessageRefs => {
  const article = createElement('article', {
    className: message.role === 'assistant' ? 'message message-assistant' : 'message message-user',
  });
  article.dataset.messageId = message.messageId;

  const shell = createElement('div', { className: 'message-shell' });
  const avatar = createElement('div', {
    className: 'message-avatar',
    textContent: message.role === 'assistant' ? 'OC' : '你',
  });
  const body = createElement('div', { className: 'message-body' });
  const role = createElement('div', {
    className: 'message-role',
    textContent: message.role === 'assistant' ? 'OpenClaw' : '你',
  });
  const content = createElement('div', { className: 'message-content' });

  body.append(role, content);
  shell.append(avatar, body);
  article.append(shell);

  patchMessageElement({ article, content }, message);
  return { article, content };
};

const patchMessageElement = (refs: MessageRefs, message: Message): void => {
  const nextClassName =
    message.role === 'assistant' ? 'message message-assistant' : 'message message-user';
  if (refs.article.className !== nextClassName) {
    refs.article.className = nextClassName;
  }
  refs.article.dataset.messageId = message.messageId;

  const nextRenderedContent =
    message.role === 'assistant' ? renderMarkdown(message.content) : renderPlainText(message.content);
  if (refs.content.innerHTML !== nextRenderedContent) {
    refs.content.innerHTML = nextRenderedContent;
  }
};

const createAuthShell = () => {
  const authShell = createElement('main', { className: 'shell shell-auth' });
  const authCard = createElement('section', { className: 'auth-card' });
  const title = createElement('div', { className: 'app-title', textContent: 'OpenClaw' });
  const copy = createElement('p', {
    className: 'auth-copy',
    textContent: '输入 6 位 PIN 码后继续使用当前 Tesla 会话。',
  });
  const pinGrid = createElement('div', { className: 'auth-pin-grid' });
  pinGrid.setAttribute('role', 'group');
  pinGrid.setAttribute('aria-label', 'PIN 输入');

  const authDigits = Array.from({ length: 6 }, (_, index) => {
    const input = createElement('input', { className: 'auth-pin-digit' });
    input.dataset.pinIndex = String(index);
    input.inputMode = 'numeric';
    input.autocomplete = index === 0 ? 'one-time-code' : 'off';
    input.pattern = '[0-9]*';
    input.maxLength = 1;
    input.setAttribute('aria-label', `PIN 第 ${index + 1} 位`);
    return input;
  });
  pinGrid.append(...authDigits);

  const authRow = createElement('div', { className: 'composer-row auth-row' });
  const unlockButton = createElement('button', { className: 'icon-button auth-button' });
  unlockButton.id = 'unlock-button';
  authRow.append(unlockButton);

  const authMeta = createElement('div', { className: 'auth-meta' });
  const authNetwork = createElement('span', { className: 'status-pill' });
  const authError = createElement('span', { className: 'error-text auth-error' });
  authMeta.append(authNetwork, authError);

  authCard.append(title, copy, pinGrid, authRow, authMeta);
  authShell.append(authCard);

  return {
    authShell,
    authDigits,
    unlockButton,
    authNetwork,
    authError,
  };
};

const createChatShell = () => {
  const chatShell = createElement('main', { className: 'shell' });
  const header = createElement('header', { className: 'app-header' });
  const title = createElement('div', { className: 'app-title', textContent: 'OpenClaw' });
  const statusBar = createElement('div', { className: 'status-bar' });
  const statusText = createElement('div', { className: 'status-pill' });
  const sessionText = createElement('div', { className: 'status-pill' });
  const networkText = createElement('div', { className: 'status-pill' });
  statusBar.append(statusText, sessionText, networkText);
  header.append(title, statusBar);

  const messages = createElement('section', { className: 'messages' });
  messages.setAttribute('aria-live', 'polite');
  const emptyState = createElement('div', { className: 'empty-state' });
  const emptyTitle = createElement('div', { className: 'empty-title', textContent: '今天想聊什么？' });
  const emptyCopy = createElement('div', {
    className: 'empty-copy',
    textContent: '直接输入，或先用车机系统语音输入再发送。',
  });
  emptyState.append(emptyTitle, emptyCopy);
  messages.append(emptyState);

  const composer = createElement('section', { className: 'composer' });
  const composerRow = createElement('div', { className: 'composer-row' });
  const textarea = createElement('textarea', { className: 'composer-input' });
  textarea.id = 'text-input';
  textarea.rows = 2;
  const sendButton = createElement('button', { className: 'icon-button send-icon-button' });
  sendButton.id = 'send-button';
  composerRow.append(textarea, sendButton);

  const composerActions = createElement('div', { className: 'composer-actions' });
  const recoverButton = createElement('button', { className: 'secondary-button' });
  recoverButton.id = 'recover-button';
  const errorText = createElement('span', { className: 'error-text' });
  composerActions.append(recoverButton, errorText);

  composer.append(composerRow, composerActions);
  chatShell.append(header, messages, composer);

  return {
    chatShell,
    statusText,
    sessionText,
    networkText,
    messages,
    emptyState,
    textarea,
    sendButton,
    recoverButton,
    errorText,
  };
};

const createDomRefs = (root: HTMLElement): DomRefs => {
  root.replaceChildren();

  const auth = createAuthShell();
  const chat = createChatShell();
  root.append(auth.authShell, chat.chatShell);

  return {
    ...auth,
    ...chat,
    messageRefs: new Map<string, MessageRefs>(),
  };
};

const syncAuthState = (refs: DomRefs, state: AppState): void => {
  refs.authDigits.forEach((input, index) => {
    const nextValue = state.pinDraft[index] ?? '';
    if (input.value !== nextValue) {
      input.value = nextValue;
    }
  });
  refs.unlockButton.disabled = state.isUnlocking || state.pinDraft.length !== 6;
  refs.unlockButton.textContent = state.isUnlocking ? '解锁中…' : '解锁';
  refs.authNetwork.textContent = state.networkOnline ? '网络在线' : '网络离线';
  refs.authError.textContent = state.error ?? '';
};

const syncMessages = (refs: DomRefs, state: AppState): void => {
  const nextIds = new Set(state.messages.map((message) => message.messageId));

  for (const [messageId, messageRefs] of refs.messageRefs.entries()) {
    if (nextIds.has(messageId)) {
      continue;
    }
    messageRefs.article.remove();
    refs.messageRefs.delete(messageId);
  }

  const orderedArticles: HTMLElement[] = [];
  for (const message of state.messages) {
    let messageRefs = refs.messageRefs.get(message.messageId);
    if (!messageRefs) {
      messageRefs = createMessageElement(message);
      refs.messageRefs.set(message.messageId, messageRefs);
    } else {
      patchMessageElement(messageRefs, message);
    }
    orderedArticles.push(messageRefs.article);
  }

  if (state.messages.length === 0) {
    setHidden(refs.emptyState, false);
    for (const messageRefs of refs.messageRefs.values()) {
      messageRefs.article.remove();
    }
    refs.messageRefs.clear();
    if (!refs.messages.contains(refs.emptyState)) {
      refs.messages.append(refs.emptyState);
    }
    return;
  }

  setHidden(refs.emptyState, true);
  refs.messages.replaceChildren(...orderedArticles);
};

const syncChatState = (refs: DomRefs, state: AppState): void => {
  refs.statusText.textContent = `状态：${statusLabelMap[state.status]}`;
  refs.sessionText.textContent = state.sessionId ? '会话已连接' : '正在初始化';
  refs.networkText.textContent = state.networkOnline ? '网络在线' : '网络离线';

  refs.textarea.placeholder = inputHintText();
  refs.textarea.disabled = state.isSendingText;
  if (refs.textarea.value !== state.draftText) {
    refs.textarea.value = state.draftText;
  }

  const hasDraftText = state.draftText.trim().length > 0;
  refs.sendButton.className = `icon-button send-icon-button${hasDraftText ? '' : ' send-icon-button-hidden'}`;
  refs.sendButton.disabled = state.isSendingText || !state.sessionId || !hasDraftText;
  refs.sendButton.setAttribute('aria-label', state.isSendingText ? '发送中' : '发送消息');
  refs.sendButton.innerHTML = state.isSendingText ? '…' : sendIcon();

  const showRecoverButton = state.status === 'error';
  setHidden(refs.recoverButton, !showRecoverButton);
  refs.recoverButton.textContent = actionButtonLabel(state);
  refs.errorText.textContent = state.error ?? '';

  syncMessages(refs, state);
};

export const renderApp = (root: HTMLElement, state: AppState): void => {
  let refs = domRefStore.get(root);
  if (!refs) {
    refs = createDomRefs(root);
    domRefStore.set(root, refs);
  }

  const authMode = state.authEnabled && state.authRequired;
  setHidden(refs.authShell, !authMode);
  setHidden(refs.chatShell, authMode);

  syncAuthState(refs, state);
  syncChatState(refs, state);
};
