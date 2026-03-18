import type { Message } from '@tesla-openclaw/shared';

import type { AppState } from './state.js';
import { renderMarkdown, renderPlainText } from './render-markdown.js';
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
  statusIndicator: HTMLElement;
  statusDot: HTMLElement;
  statusLabel: HTMLElement;
  themeToggleButton: HTMLButtonElement;
  headerMenuButton: HTMLButtonElement;
  headerMenu: HTMLElement;
  clearContextButton: HTMLButtonElement;
  clearContextError: HTMLElement;
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

const autoThemeIcon = () => `
  <svg viewBox="0 0 20 20" aria-hidden="true" class="button-icon">
    <path d="M10 4.5 A5.5 5.5 0 0 0 10 15.5 Z" fill="currentColor"/>
    <circle cx="10" cy="10" r="5.5" fill="none" stroke="currentColor" stroke-width="1.7"/>
  </svg>
`;

const sunIcon = () => `
  <svg viewBox="0 0 20 20" aria-hidden="true" class="button-icon">
    <circle
      cx="10" cy="10" r="3"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
    />
    <path
      d="M10 4.5V3.5M10 16.5V15.5M4.5 10H3.5M16.5 10H15.5M6.04 6.04L5.33 5.33M14.67 14.67L13.96 13.96M13.96 6.04L14.67 5.33M5.33 14.67L6.04 13.96"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
    />
  </svg>
`;

const moonIcon = () => `
  <svg viewBox="0 0 20 20" aria-hidden="true" class="button-icon">
    <path
      d="M12.3 6.2 A5 5 0 1 0 12.3 13.8 A4 4 0 0 1 12.3 6.2Z"
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

const menuIcon = () => `
  <svg viewBox="0 0 20 20" aria-hidden="true" class="button-icon">
    <circle cx="10" cy="4" r="1.5" fill="currentColor" />
    <circle cx="10" cy="10" r="1.5" fill="currentColor" />
    <circle cx="10" cy="16" r="1.5" fill="currentColor" />
  </svg>
`;

const getHeaderStatusView = (state: AppState): {
  text: string;
  tone: 'online' | 'busy' | 'error' | 'offline';
} => {
  if (!state.networkOnline) {
    return { text: '离线', tone: 'offline' };
  }

  if (state.status === 'error') {
    return { text: '异常', tone: 'error' };
  }

  if (state.responsePhase === 'waiting') {
    return { text: '等待', tone: 'busy' };
  }

  if (state.responsePhase === 'streaming') {
    return { text: '回复中', tone: 'busy' };
  }

  return { text: '在线', tone: 'online' };
};

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
  const content = createElement('div', { className: 'message-content' });

  body.append(content);
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
  const title = createElement('h1', { className: 'app-title', textContent: 'OpenClaw' });
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
  const titleWrap = createElement('div', { className: 'app-title-wrap' });
  const title = createElement('h1', { className: 'app-title', textContent: 'OpenClaw' });
  const statusBar = createElement('div', { className: 'status-bar' });
  const statusIndicator = createElement('div', { className: 'status-indicator' });
  const statusDot = createElement('span', { className: 'status-dot' });
  const statusLabel = createElement('span', { className: 'status-label' });
  statusIndicator.append(statusDot, statusLabel);
  titleWrap.append(title);
  const themeToggleButton = createElement('button', { className: 'icon-button theme-toggle-button' });
  themeToggleButton.id = 'theme-toggle-button';
  themeToggleButton.type = 'button';
  const menuWrap = createElement('div', { className: 'header-menu-wrap' });
  const headerMenuButton = createElement('button', { className: 'icon-button header-menu-button' });
  headerMenuButton.id = 'header-menu-button';
  headerMenuButton.type = 'button';
  const headerMenu = createElement('div', { className: 'header-menu' });
  const clearContextButton = createElement('button', { className: 'header-menu-item' });
  clearContextButton.id = 'clear-context-button';
  clearContextButton.type = 'button';
  const clearContextError = createElement('div', { className: 'header-menu-error error-text' });
  headerMenu.append(clearContextButton, clearContextError);
  menuWrap.append(headerMenuButton, headerMenu);
  statusBar.append(statusIndicator, themeToggleButton, menuWrap);
  header.append(titleWrap, statusBar);

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
    statusIndicator,
    statusDot,
    statusLabel,
    themeToggleButton,
    headerMenuButton,
    headerMenu,
    clearContextButton,
    clearContextError,
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
  const headerStatus = getHeaderStatusView(state);
  refs.statusLabel.textContent = headerStatus.text;
  refs.statusIndicator.className = `status-indicator status-indicator-${headerStatus.tone}`;
  refs.statusIndicator.setAttribute('aria-label', `当前状态：${headerStatus.text}`);
  refs.statusIndicator.title = `当前状态：${headerStatus.text}`;

  const themeLabelMap = { auto: '跟随系统', light: '白天模式', dark: '夜晚模式' } as const;
  const themeLabel = themeLabelMap[state.theme];
  if (refs.themeToggleButton.dataset.theme !== state.theme) {
    const themeIconMap = { auto: autoThemeIcon, light: sunIcon, dark: moonIcon } as const;
    refs.themeToggleButton.innerHTML = themeIconMap[state.theme]();
    refs.themeToggleButton.dataset.theme = state.theme;
  }
  refs.themeToggleButton.setAttribute('aria-label', themeLabel);
  refs.themeToggleButton.title = themeLabel;
  refs.headerMenuButton.innerHTML = menuIcon();
  refs.headerMenuButton.setAttribute('aria-label', state.isHeaderMenuOpen ? '收起更多操作' : '更多操作');
  refs.headerMenuButton.title = state.isHeaderMenuOpen ? '收起更多操作' : '更多操作';
  refs.headerMenu.classList.toggle('header-menu-open', state.isHeaderMenuOpen);
  refs.headerMenu.setAttribute('aria-hidden', String(!state.isHeaderMenuOpen));

  const canClearContext = state.messages.length > 0 && state.responsePhase === 'idle' && !state.isClearingContext;
  refs.clearContextButton.textContent = '清除上下文';
  refs.clearContextButton.disabled = !canClearContext;
  refs.clearContextButton.hidden = state.messages.length === 0;
  refs.clearContextButton.title = canClearContext ? '清除当前对话上下文' : '当前没有可清除内容，或请等待回复结束';
  refs.clearContextError.textContent = state.clearContextError ?? '';
  setHidden(refs.clearContextError, !state.clearContextError);
  refs.clearContextButton.textContent = state.isClearingContext ? '清除中…' : '清除上下文';

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
  const followHidden = state.messageFollowMode !== 'history' || state.messages.length === 0;
  refs.backToBottomButton.classList.toggle('follow-button-hidden', followHidden);
  refs.backToBottomButton.setAttribute('aria-hidden', String(followHidden));

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
