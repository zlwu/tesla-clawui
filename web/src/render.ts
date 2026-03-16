import type { Message } from '@tesla-openclaw/shared';

import type { AppState } from './state.js';
import { renderMarkdown, renderPlainText } from './render-markdown.js';
import { statusLabelMap } from './state-machine.js';
import { getComposerStatusView, getWaitingIndicatorText } from './ui-state.js';

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
  backToBottomButton: HTMLButtonElement;
  textarea: HTMLTextAreaElement;
  sendButton: HTMLButtonElement;
  composerStatus: HTMLElement;
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
    <path
      d="M10 15.2V5.4"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M5.9 8.5 10 4.4l4.1 4.1"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
`;

const backToBottomIcon = () => `
  <svg viewBox="0 0 20 20" aria-hidden="true" class="button-icon">
    <path
      d="M5.8 6.6 10 10.8l4.2-4.2"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M5.8 10.4 10 14.6l4.2-4.2"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
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

const getMessageContentHtml = (message: Message, state: AppState): string => {
  const isPendingWaitingMessage =
    message.messageId === state.pendingAssistantMessageId && state.responsePhase === 'waiting';

  if (isPendingWaitingMessage) {
    return `<p class="message-content-text message-waiting-indicator">${getWaitingIndicatorText(state.waitingIndicatorFrame)}</p>`;
  }

  return message.role === 'assistant' ? renderMarkdown(message.content) : renderPlainText(message.content);
};

const createMessageElement = (message: Message, state: AppState): MessageRefs => {
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

  patchMessageElement({ article, content }, message, state);
  return { article, content };
};

const patchMessageElement = (refs: MessageRefs, message: Message, state: AppState): void => {
  const nextClassName =
    message.role === 'assistant' ? 'message message-assistant' : 'message message-user';
  if (refs.article.className !== nextClassName) {
    refs.article.className = nextClassName;
  }
  refs.article.dataset.messageId = message.messageId;

  const nextRenderedContent = getMessageContentHtml(message, state);
  if (refs.content.innerHTML !== nextRenderedContent) {
    refs.content.innerHTML = nextRenderedContent;
  }

  refs.content.classList.toggle(
    'message-content-waiting',
    message.messageId === state.pendingAssistantMessageId && state.responsePhase === 'waiting',
  );
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

  const composerDock = createElement('div', { className: 'composer-dock' });
  const backToBottomButton = createElement('button', { className: 'icon-button follow-button' });
  backToBottomButton.id = 'back-to-bottom-button';
  backToBottomButton.type = 'button';

  const composer = createElement('section', { className: 'composer' });
  const composerRow = createElement('div', { className: 'composer-row' });
  const textarea = createElement('textarea', { className: 'composer-input' });
  textarea.id = 'text-input';
  textarea.rows = 2;
  const sendButton = createElement('button', { className: 'icon-button send-icon-button' });
  sendButton.id = 'send-button';
  composerRow.append(textarea, sendButton);

  const composerActions = createElement('div', { className: 'composer-actions' });
  const composerStatus = createElement('span', { className: 'composer-status' });
  const recoverButton = createElement('button', { className: 'secondary-button' });
  recoverButton.id = 'recover-button';
  const errorText = createElement('span', { className: 'error-text' });
  composerActions.append(composerStatus, recoverButton, errorText);

  composer.append(composerRow, composerActions);
  composerDock.append(backToBottomButton, composer);
  chatShell.append(header, messages, composerDock);

  return {
    chatShell,
    statusText,
    sessionText,
    networkText,
    messages,
    emptyState,
    backToBottomButton,
    textarea,
    sendButton,
    composerStatus,
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
      messageRefs = createMessageElement(message, state);
      refs.messageRefs.set(message.messageId, messageRefs);
    } else {
      patchMessageElement(messageRefs, message, state);
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
  const composerStatus = getComposerStatusView(state);

  refs.statusText.textContent = `状态：${statusLabelMap[state.status]}`;
  refs.sessionText.textContent = state.sessionId ? '会话已连接' : '正在初始化';
  refs.networkText.textContent = state.networkOnline ? '网络在线' : '网络离线';

  refs.textarea.placeholder = inputHintText();
  refs.textarea.disabled = false;
  if (refs.textarea.value !== state.draftText) {
    refs.textarea.value = state.draftText;
  }

  const hasDraftText = state.draftText.trim().length > 0;
  refs.sendButton.className = `icon-button send-icon-button${hasDraftText ? '' : ' send-icon-button-hidden'}`;
  refs.sendButton.disabled = state.responsePhase !== 'idle' || !state.sessionId || !hasDraftText;
  refs.sendButton.setAttribute(
    'aria-label',
    state.responsePhase === 'idle' ? '发送消息' : '请等待当前回复完成',
  );
  refs.sendButton.innerHTML = sendIcon();

  refs.backToBottomButton.innerHTML = backToBottomIcon();
  refs.backToBottomButton.setAttribute(
    'aria-label',
    state.responsePhase === 'idle' ? '回到底部' : '有新回复，回到底部',
  );
  refs.backToBottomButton.title =
    state.responsePhase === 'idle' ? '回到底部' : '有新回复，回到底部';
  setHidden(refs.backToBottomButton, state.messageFollowMode !== 'history' || state.messages.length === 0);

  const showRecoverButton = state.status === 'error';
  setHidden(refs.recoverButton, !showRecoverButton);
  refs.recoverButton.textContent = actionButtonLabel(state);
  refs.errorText.textContent = state.error ?? '';

  refs.composerStatus.textContent = composerStatus.text ?? '';
  refs.composerStatus.className = `composer-status composer-status-${composerStatus.tone}`;
  setHidden(refs.composerStatus, composerStatus.text === null || composerStatus.kind === 'error');

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
