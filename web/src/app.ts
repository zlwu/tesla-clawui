import type { AppError, AppErrorCode } from '@tesla-openclaw/shared';

import { createSession, fetchAuthConfig, fetchMessages, sendTextMessageStream, unlockWithPin } from './api.js';
import { toDisplayErrorMessage } from './errors.js';
import { clearPersistedState, persistSessionState, readPersistedState } from './persistence.js';
import { renderApp } from './render.js';
import { createInitialState, type AppState, type RetryAction } from './state.js';
import { buildVisibleMessages, limitMessages } from './state-machine.js';
import type { Message } from '@tesla-openclaw/shared';

const createRequestId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;

export class TeslaOpenClawApp {
  private readonly persistedState = readPersistedState();
  private readonly keyboardFallbackDelayMs = 180;
  private readonly state: AppState = {
    ...createInitialState(),
    authToken: this.persistedState.authToken,
    authExpiresAt: this.persistedState.authExpiresAt,
    sessionId: this.persistedState.sessionId,
    sessionToken: this.persistedState.sessionToken,
    messages: limitMessages(this.persistedState.messages),
  };

  private lastRenderSignature: string | null = null;
  private keyboardMode = false;
  private lastButtonAction: { id: string; at: number } | null = null;
  private shouldAutoScrollMessages = true;
  private pendingInitialScroll = true;
  private keyboardFallbackTimerId: number | null = null;

  public constructor(private readonly root: HTMLElement) {}

  public async start(): Promise<void> {
    this.state.networkOnline = this.readNetworkOnline();
    this.bindEvents();
    this.render();
    await this.bootstrapApp();
  }

  private bindEvents(): void {
    const handleButtonAction = (event: Event, options: { early: boolean }) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const button = target.closest('button');
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

       if (button.disabled) {
        return;
      }

      const now = Date.now();
      if (
        !options.early &&
        this.lastButtonAction &&
        this.lastButtonAction.id === button.id &&
        now - this.lastButtonAction.at < 350
      ) {
        return;
      }

      if (options.early) {
        event.preventDefault();
        this.lastButtonAction = { id: button.id, at: now };
      }

      if (button.id === 'send-button') {
        void this.handleSend();
        return;
      }

      if (button.id === 'recover-button') {
        void this.handleRecoveryAction();
        return;
      }

      if (button.id === 'unlock-button') {
        void this.handleUnlock();
      }
    };

    this.root.addEventListener('pointerdown', (event) => {
      handleButtonAction(event, { early: true });
    });

    this.root.addEventListener('mousedown', (event) => {
      handleButtonAction(event, { early: true });
    });

    this.root.addEventListener('click', (event) => {
      handleButtonAction(event, { early: false });
    });

    this.root.addEventListener('input', (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.classList.contains('auth-pin-digit')) {
        this.handlePinDigitInput(target);
        return;
      }

      if (!(target instanceof HTMLTextAreaElement) || target.id !== 'text-input') {
        return;
      }

      this.state.draftText = target.value;
      this.syncComposerInputHeight();
      this.syncComposerDraftState();
    });

    this.root.addEventListener('keydown', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !target.classList.contains('auth-pin-digit')) {
        return;
      }

      if (event.key === 'Backspace' && target.value === '') {
        const previous = this.findPinDigitInput(Number(target.dataset.pinIndex ?? '-1') - 1);
        previous?.focus();
        previous?.select();
      }
    });

    this.root.addEventListener('paste', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !target.classList.contains('auth-pin-digit')) {
        return;
      }

      const pasted = event.clipboardData?.getData('text')?.replace(/\D/g, '').slice(0, 6) ?? '';
      if (!pasted) {
        return;
      }

      event.preventDefault();
      const digits = this.getPinDigitInputs();
      for (let index = 0; index < digits.length; index += 1) {
        const digitInput = digits[index];
        if (!digitInput) {
          continue;
        }
        digitInput.value = pasted[index] ?? '';
      }
      this.state.pinDraft = pasted;
      this.syncUnlockDraftState();
      const nextIndex = Math.min(pasted.length, digits.length - 1);
      digits[nextIndex]?.focus();
      digits[nextIndex]?.select();
    });

    this.root.addEventListener(
      'scroll',
      (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || !target.classList.contains('messages')) {
          return;
        }

        this.shouldAutoScrollMessages = this.isNearMessagesBottom(target);
      },
      true,
    );

    window.addEventListener('online', () => {
      this.state.networkOnline = true;
      this.render();
    });

    window.addEventListener('offline', () => {
      this.state.networkOnline = false;
      this.render();
    });

    this.root.addEventListener('focusin', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement) || target.id !== 'text-input') {
        return;
      }

      this.keyboardMode = true;
      this.syncKeyboardViewport();
      this.scheduleKeyboardFallbackCheck();
      window.setTimeout(() => {
        this.scrollComposerIntoView();
      }, 120);
    });

    this.root.addEventListener('focusout', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement) || target.id !== 'text-input') {
        return;
      }

      this.keyboardMode = false;
      this.clearKeyboardFallbackCheck();
      this.syncKeyboardViewport();
    });

    window.visualViewport?.addEventListener('resize', () => {
      if (!this.keyboardMode) {
        return;
      }

      this.syncKeyboardViewport();
      this.scheduleKeyboardFallbackCheck();
      this.scrollComposerIntoView();
    });

    window.visualViewport?.addEventListener('scroll', () => {
      if (!this.keyboardMode) {
        return;
      }

      this.syncKeyboardViewport();
    });

    window.addEventListener('resize', () => {
      if (!this.keyboardMode) {
        return;
      }

      this.syncKeyboardViewport();
      this.scheduleKeyboardFallbackCheck();
    });
  }

  private render(): void {
    const viewState = {
      ...this.state,
      messages: buildVisibleMessages(this.state.messages),
    };
    const nextSignature = JSON.stringify(viewState);
    if (nextSignature === this.lastRenderSignature) {
      return;
    }

    this.lastRenderSignature = nextSignature;
    renderApp(this.root, viewState);

    this.syncComposerInputHeight();
    this.syncKeyboardViewport();
    if (this.pendingInitialScroll || this.shouldAutoScrollMessages) {
      this.scrollMessagesToBottom({ force: this.pendingInitialScroll });
      this.pendingInitialScroll = false;
    }
  }

  private handlePinDigitInput(input: HTMLInputElement): void {
    const digit = input.value.replace(/\D/g, '').slice(-1);
    input.value = digit;
    this.state.pinDraft = this.getPinDigitInputs()
      .map((node) => node.value.replace(/\D/g, '').slice(0, 1))
      .join('');
    this.syncUnlockDraftState();

    if (!digit) {
      return;
    }

    const next = this.findPinDigitInput(Number(input.dataset.pinIndex ?? '-1') + 1);
    next?.focus();
    next?.select();
  }

  private getPinDigitInputs(): HTMLInputElement[] {
    return Array.from(this.root.querySelectorAll<HTMLInputElement>('.auth-pin-digit'));
  }

  private findPinDigitInput(index: number): HTMLInputElement | null {
    return this.root.querySelector<HTMLInputElement>(`.auth-pin-digit[data-pin-index="${index}"]`);
  }

  private syncUnlockDraftState(): void {
    const unlockButton = this.root.querySelector<HTMLButtonElement>('#unlock-button');
    if (!unlockButton) {
      return;
    }

    unlockButton.disabled = this.state.isUnlocking || this.state.pinDraft.length !== 6;
  }

  private async bootstrapApp(): Promise<void> {
    const authConfig = await fetchAuthConfig();
    if (!authConfig.ok) {
      this.applyApiFailure(authConfig, null);
      this.render();
      return;
    }

    this.state.authEnabled = authConfig.data.enabled;
    const hasValidAuth = !this.state.authEnabled || this.hasValidAuthToken();
    if (!hasValidAuth) {
      this.requireUnlock();
      this.render();
      return;
    }

    this.state.authRequired = false;
    await this.ensureSession();
    await this.loadMessages();
  }

  private readNetworkOnline(): boolean {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  }

  private syncKeyboardViewport(): void {
    const visualViewport = window.visualViewport;
    const keyboardOffset =
      this.keyboardMode && visualViewport
        ? Math.max(window.innerHeight - visualViewport.height - visualViewport.offsetTop, 0)
        : 0;
    const keyboardFallbackOffset = this.getKeyboardFallbackOffset(keyboardOffset);

    this.root.style.setProperty('--keyboard-offset', `${keyboardOffset}px`);
    this.root.style.setProperty('--keyboard-fallback-offset', `${keyboardFallbackOffset}px`);
    this.root.classList.toggle(
      'keyboard-active',
      this.keyboardMode || keyboardOffset > 0 || keyboardFallbackOffset > 0,
    );
  }

  private scrollMessagesToBottom(options?: { force?: boolean }): void {
    const messagesNode = this.root.querySelector<HTMLElement>('.messages');
    if (!messagesNode) {
      return;
    }

    if (!options?.force && !this.shouldAutoScrollMessages) {
      return;
    }

    messagesNode.scrollTop = messagesNode.scrollHeight;

    window.requestAnimationFrame(() => {
      const latestMessage = messagesNode.lastElementChild as HTMLElement | null;
      latestMessage?.scrollIntoView({ block: 'end' });
      messagesNode.scrollTop = messagesNode.scrollHeight;
    });
  }

  private isNearMessagesBottom(messagesNode: HTMLElement): boolean {
    const distanceToBottom =
      messagesNode.scrollHeight - messagesNode.scrollTop - messagesNode.clientHeight;
    return distanceToBottom <= 48;
  }

  private scrollComposerIntoView(): void {
    const composer = this.root.querySelector<HTMLElement>('.composer');
    composer?.scrollIntoView({ block: 'end' });
  }

  private scheduleKeyboardFallbackCheck(): void {
    this.clearKeyboardFallbackCheck();
    this.keyboardFallbackTimerId = window.setTimeout(() => {
      this.keyboardFallbackTimerId = null;
      this.syncKeyboardViewport();
      this.scrollComposerIntoView();
      this.scrollMessagesToBottom();
    }, this.keyboardFallbackDelayMs);
  }

  private clearKeyboardFallbackCheck(): void {
    if (this.keyboardFallbackTimerId === null) {
      return;
    }

    window.clearTimeout(this.keyboardFallbackTimerId);
    this.keyboardFallbackTimerId = null;
  }

  private getKeyboardFallbackOffset(keyboardOffset: number): number {
    if (!this.keyboardMode || keyboardOffset > 24 || !this.shouldUseTouchKeyboardFallback()) {
      return 0;
    }

    return Math.min(Math.max(Math.round(window.innerHeight * 0.36), 220), 320);
  }

  private shouldUseTouchKeyboardFallback(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return (
      navigator.maxTouchPoints > 0
      || window.matchMedia('(pointer: coarse)').matches
      || 'ontouchstart' in window
    );
  }

  private syncComposerInputHeight(): void {
    const input = this.root.querySelector<HTMLTextAreaElement>('#text-input');
    if (!input) {
      return;
    }

    input.style.height = '0px';
    input.style.height = `${Math.min(input.scrollHeight, 168)}px`;
  }

  private syncComposerDraftState(): void {
    const sendButton = this.root.querySelector<HTMLButtonElement>('#send-button');
    if (!sendButton) {
      return;
    }

    const hasDraftText = this.state.draftText.trim().length > 0;
    sendButton.classList.toggle('send-icon-button-hidden', !hasDraftText);
    sendButton.disabled = !hasDraftText || this.state.isSendingText || !this.state.sessionId;
  }

  private setErrorState(message: string, retryAction: RetryAction | null, errorCode: AppErrorCode): void {
    this.state.networkOnline = this.readNetworkOnline();
    this.state.status = 'error';
    this.state.error = message;
    this.state.errorCode = errorCode;
    this.state.retryAction = retryAction;
  }

  private applyApiFailure(
    failure: { error: AppError },
    retryAction: RetryAction | null,
  ): void {
    if (failure.error.code === 'AUTH_REQUIRED') {
      this.requireUnlock();
      return;
    }

    this.setErrorState(
      toDisplayErrorMessage(failure.error, this.readNetworkOnline()),
      failure.error.retryable ? retryAction : null,
      failure.error.code,
    );
  }

  private persistState(): void {
    if (!this.state.authToken && (!this.state.sessionId || !this.state.sessionToken)) {
      clearPersistedState();
      return;
    }

    persistSessionState({
      authToken: this.state.authToken,
      authExpiresAt: this.state.authExpiresAt,
      sessionId: this.state.sessionId,
      sessionToken: this.state.sessionToken,
      messages: limitMessages(this.state.messages),
    });
  }

  private hasValidAuthToken(): boolean {
    return Boolean(
      this.state.authToken &&
      this.state.authExpiresAt &&
      Date.parse(this.state.authExpiresAt) > Date.now(),
    );
  }

  private requireUnlock(): void {
    this.state.authRequired = true;
    this.state.authToken = null;
    this.state.authExpiresAt = null;
    this.state.sessionId = null;
    this.state.sessionToken = null;
    this.state.messages = [];
    this.state.draftText = '';
    this.state.isSendingText = false;
    this.state.isUnlocking = false;
    this.state.status = 'idle';
    this.state.error = null;
    this.state.errorCode = null;
    this.state.retryAction = null;
    this.pendingInitialScroll = true;
    this.shouldAutoScrollMessages = true;
    clearPersistedState();
  }

  private async handleUnlock(): Promise<void> {
    const pin = this.state.pinDraft.trim();
    if (!/^\d{6}$/.test(pin)) {
      this.setErrorState('请输入 6 位数字 PIN 码', null, 'VALIDATION_FAILED');
      this.render();
      return;
    }

    this.state.isUnlocking = true;
    this.state.error = null;
    this.state.errorCode = null;
    this.render();

    const result = await unlockWithPin(pin);
    if (!result.ok) {
      this.state.isUnlocking = false;
      this.applyApiFailure(result, null);
      this.render();
      return;
    }

    this.state.authToken = result.data.authToken;
    this.state.authExpiresAt = result.data.expiresAt;
    this.state.authRequired = false;
    this.state.isUnlocking = false;
    this.state.pinDraft = '';
    this.state.error = null;
    this.state.errorCode = null;
    this.persistState();
    this.render();

    await this.ensureSession();
    await this.loadMessages();
  }

  private async ensureSession(): Promise<void> {
    if (this.state.authEnabled && !this.hasValidAuthToken()) {
      this.requireUnlock();
      this.render();
      return;
    }

    if (this.state.sessionId && this.state.sessionToken) {
      this.persistState();
      this.render();
      return;
    }

    const result = await createSession(this.state.authToken);
    if (!result.ok) {
      this.applyApiFailure(result, null);
      this.render();
      return;
    }

    this.state.sessionId = result.data.session.sessionId;
    this.state.sessionToken = result.data.sessionToken;
    this.state.status = 'idle';
    this.state.error = null;
    this.state.errorCode = null;
    this.state.retryAction = null;
    this.persistState();
    this.render();
  }

  private async loadMessages(): Promise<void> {
    if (!this.state.sessionId || !this.state.sessionToken) {
      return;
    }

    const result = await fetchMessages(this.state.sessionId, this.state.sessionToken, this.state.authToken);
    if (!result.ok) {
      this.applyApiFailure(result, { kind: 'reload-messages' });
      this.render();
      return;
    }

    this.state.messages = limitMessages(result.data.messages);
    this.state.status = 'idle';
    this.state.error = null;
    this.state.errorCode = null;
    this.state.retryAction = null;
    this.pendingInitialScroll = true;
    this.shouldAutoScrollMessages = true;
    this.persistState();
    this.render();
  }

  private async handleSend(): Promise<void> {
    if (!this.state.sessionId || !this.state.sessionToken) {
      return;
    }

    const text = this.state.draftText.trim();
    if (!text) {
      this.setErrorState('请输入内容', null, 'VALIDATION_FAILED');
      this.render();
      return;
    }

    const requestId = createRequestId('req_text');
    const optimisticUserMessage = this.createOptimisticMessage({
      messageId: `local_user_${requestId}`,
      role: 'user',
      content: text,
      source: 'text',
    });
    const optimisticAssistantMessage = this.createOptimisticMessage({
      messageId: `local_assistant_${requestId}`,
      role: 'assistant',
      content: '',
      source: 'llm',
    });
    this.state.messages = limitMessages([
      ...this.state.messages,
      optimisticUserMessage,
      optimisticAssistantMessage,
    ]);
    this.shouldAutoScrollMessages = true;
    this.state.draftText = '';
    this.state.isSendingText = true;
    this.state.status = 'thinking';
    this.state.error = null;
    this.state.errorCode = null;
    this.state.retryAction = null;
    this.render();

    const result = await sendTextMessageStream({
      sessionId: this.state.sessionId,
      sessionToken: this.state.sessionToken,
      authToken: this.state.authToken,
      text,
      requestId,
      onStart: () => {
        this.render();
      },
      onDelta: (delta) => {
        this.updateOptimisticAssistantMessage(requestId, delta);
        this.render();
      },
    });

    if (!result.ok) {
      this.removeOptimisticMessages(requestId);
      this.state.draftText = text;
      this.state.isSendingText = false;
      this.applyApiFailure(result, { kind: 'send-text', requestId, text });
      this.render();
      return;
    }

    this.replaceOptimisticMessages(requestId, result.data.userMessage, result.data.assistantMessage);
    this.state.isSendingText = false;
    this.state.status = 'idle';
    this.state.error = null;
    this.state.errorCode = null;
    this.state.retryAction = null;
    this.persistState();
    this.render();
  }

  private async handleRecoveryAction(): Promise<void> {
    const retryAction = this.state.retryAction;
    this.state.error = null;
    this.state.errorCode = null;
    this.state.retryAction = null;
    this.state.status = 'idle';
    this.render();

    if (!retryAction) {
      if (this.state.sessionId && this.state.sessionToken) {
        await this.loadMessages();
      }
      return;
    }

    if (retryAction.kind === 'reload-messages') {
      await this.loadMessages();
      return;
    }

    if (retryAction.kind === 'send-text') {
      this.state.draftText = retryAction.text;
      this.render();
      await this.retryTextMessage(retryAction);
    }
  }

  private async retryTextMessage(action: Extract<RetryAction, { kind: 'send-text' }>): Promise<void> {
    if (!this.state.sessionId || !this.state.sessionToken) {
      return;
    }

    const optimisticUserMessage = this.createOptimisticMessage({
      messageId: `local_user_${action.requestId}`,
      role: 'user',
      content: action.text,
      source: 'text',
    });
    const optimisticAssistantMessage = this.createOptimisticMessage({
      messageId: `local_assistant_${action.requestId}`,
      role: 'assistant',
      content: '',
      source: 'llm',
    });
    this.state.messages = limitMessages([
      ...this.state.messages,
      optimisticUserMessage,
      optimisticAssistantMessage,
    ]);
    this.shouldAutoScrollMessages = true;
    this.state.draftText = '';
    this.state.isSendingText = true;
    this.state.status = 'thinking';
    this.state.error = null;
    this.state.errorCode = null;
    this.render();

    const result = await sendTextMessageStream({
      sessionId: this.state.sessionId,
      sessionToken: this.state.sessionToken,
      authToken: this.state.authToken,
      text: action.text,
      requestId: action.requestId,
      onStart: () => {
        this.render();
      },
      onDelta: (delta) => {
        this.updateOptimisticAssistantMessage(action.requestId, delta);
        this.render();
      },
    });

    if (!result.ok) {
      this.removeOptimisticMessages(action.requestId);
      this.state.draftText = action.text;
      this.state.isSendingText = false;
      this.applyApiFailure(result, action);
      this.render();
      return;
    }

    this.replaceOptimisticMessages(action.requestId, result.data.userMessage, result.data.assistantMessage);
    this.state.isSendingText = false;
    this.state.status = 'idle';
    this.state.error = null;
    this.state.errorCode = null;
    this.persistState();
    this.render();
  }

  private createOptimisticMessage(params: {
    messageId: string;
    role: Message['role'];
    content: string;
    source: Message['source'];
  }): Message {
    return {
      messageId: params.messageId,
      sessionId: this.state.sessionId ?? 'pending',
      role: params.role,
      content: params.content,
      source: params.source,
      createdAt: new Date().toISOString(),
    };
  }

  private updateOptimisticAssistantMessage(requestId: string, delta: string): void {
    this.shouldAutoScrollMessages = true;
    this.state.messages = this.state.messages.map((message) =>
      message.messageId === `local_assistant_${requestId}`
        ? {
          ...message,
          content: message.content + delta,
        }
        : message,
    );
  }

  private removeOptimisticMessages(requestId: string): void {
    this.state.messages = this.state.messages.filter(
      (message) =>
        message.messageId !== `local_user_${requestId}`
        && message.messageId !== `local_assistant_${requestId}`,
    );
  }

  private replaceOptimisticMessages(requestId: string, userMessage: Message, assistantMessage: Message): void {
    const messages: Message[] = [];
    for (const message of this.state.messages) {
      if (message.messageId === `local_user_${requestId}`) {
        messages.push(userMessage);
        continue;
      }

      if (message.messageId === `local_assistant_${requestId}`) {
        messages.push(assistantMessage);
        continue;
      }

      messages.push(message);
    }

    this.state.messages = limitMessages(messages);
    this.shouldAutoScrollMessages = true;
  }
}
