import type { AppError, AppErrorCode, AppStatus } from '@tesla-openclaw/shared';

import { createSession, fetchMessages, sendTextMessage, sendVoiceMessage } from './api.js';
import { toDisplayErrorMessage } from './errors.js';
import { clearPersistedState, persistSessionState, readPersistedState } from './persistence.js';
import { renderApp } from './render.js';
import { createInitialState, type AppState, type RetryAction } from './state.js';
import { buildVisibleMessages, isVoiceBusyStatus, limitMessages, transitionStatus } from './state-machine.js';
import { VoiceRecorder } from './voice-recorder.js';

const createRequestId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;

export class TeslaOpenClawApp {
  private readonly persistedState = readPersistedState();
  private readonly state: AppState = {
    ...createInitialState(),
    sessionId: this.persistedState.sessionId,
    sessionToken: this.persistedState.sessionToken,
    messages: limitMessages(this.persistedState.messages),
  };

  private readonly voiceRecorder = new VoiceRecorder();
  private progressTimerIds: number[] = [];
  private lastRenderSignature: string | null = null;
  private keyboardMode = false;
  private lastButtonAction: { id: string; at: number } | null = null;

  public constructor(private readonly root: HTMLElement) {}

  public async start(): Promise<void> {
    this.state.voiceSupported = this.voiceRecorder.isSupported();
    this.state.networkOnline = this.readNetworkOnline();
    this.render();
    await this.ensureSession();
    await this.loadMessages();
    this.bindEvents();
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

      if (button.id === 'voice-button') {
        void this.handleVoiceAction();
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
      if (!(target instanceof HTMLTextAreaElement) || target.id !== 'text-input') {
        return;
      }

      this.state.draftText = target.value;
      this.syncComposerInputHeight();
      this.syncComposerDraftState();
    });

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
      this.syncKeyboardViewport();
    });

    window.visualViewport?.addEventListener('resize', () => {
      if (!this.keyboardMode) {
        return;
      }

      this.syncKeyboardViewport();
      this.scrollComposerIntoView();
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

    const messagesNode = this.root.querySelector<HTMLElement>('.messages');
    if (messagesNode) {
      messagesNode.scrollTop = messagesNode.scrollHeight;
    }

    this.syncComposerInputHeight();

    this.syncKeyboardViewport();
  }

  private setStatus(next: AppStatus): void {
    this.state.status = transitionStatus(this.state.status, next);
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

    this.root.style.setProperty('--keyboard-offset', `${keyboardOffset}px`);
    this.root.classList.toggle('keyboard-active', this.keyboardMode || keyboardOffset > 0);
  }

  private scrollComposerIntoView(): void {
    const composer = this.root.querySelector<HTMLElement>('.composer');
    composer?.scrollIntoView({ block: 'nearest' });
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
    sendButton.disabled =
      !hasDraftText
      || this.state.isSendingText
      || this.state.status === 'recording'
      || isVoiceBusyStatus(this.state.status)
      || !this.state.sessionId;
  }

  private setErrorState(message: string, retryAction: RetryAction | null, errorCode: AppErrorCode): void {
    this.clearVoiceProgressIndicators();
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
    this.setErrorState(
      toDisplayErrorMessage(failure.error, this.readNetworkOnline()),
      failure.error.retryable ? retryAction : null,
      failure.error.code,
    );
  }

  private persistState(): void {
    if (!this.state.sessionId || !this.state.sessionToken) {
      clearPersistedState();
      return;
    }

    persistSessionState({
      sessionId: this.state.sessionId,
      sessionToken: this.state.sessionToken,
      messages: limitMessages(this.state.messages),
    });
  }

  private async ensureSession(): Promise<void> {
    if (this.state.sessionId && this.state.sessionToken) {
      this.persistState();
      this.render();
      return;
    }

    const result = await createSession();
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

    const result = await fetchMessages(this.state.sessionId, this.state.sessionToken);
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
    this.persistState();
    this.render();
  }

  private async handleSend(): Promise<void> {
    if (!this.state.sessionId || !this.state.sessionToken) {
      return;
    }

    if (isVoiceBusyStatus(this.state.status) || this.state.status === 'recording') {
      return;
    }

    const text = this.state.draftText.trim();
    if (!text) {
      this.setErrorState('请输入内容', null, 'VALIDATION_FAILED');
      this.render();
      return;
    }

    const requestId = createRequestId('req_text');
    this.state.isSendingText = true;
    this.state.status = 'thinking';
    this.state.error = null;
    this.state.errorCode = null;
    this.state.retryAction = null;
    this.render();

    const result = await sendTextMessage({
      sessionId: this.state.sessionId,
      sessionToken: this.state.sessionToken,
      text,
      requestId,
    });

    if (!result.ok) {
      this.state.isSendingText = false;
      this.applyApiFailure(result, { kind: 'send-text', requestId, text });
      this.render();
      return;
    }

    this.state.messages = limitMessages([
      ...this.state.messages,
      result.data.userMessage,
      result.data.assistantMessage,
    ]);
    this.state.draftText = '';
    this.state.isSendingText = false;
    this.state.status = 'idle';
    this.state.error = null;
    this.state.errorCode = null;
    this.state.retryAction = null;
    this.persistState();
    this.render();
  }

  private async handleVoiceAction(): Promise<void> {
    if (!this.state.voiceSupported) {
      this.setErrorState('当前浏览器不支持录音', null, 'MIC_REQUIRED');
      this.render();
      return;
    }

    if (this.state.isSendingText) {
      return;
    }

    if (this.state.status === 'recording') {
      await this.stopRecordingAndSend();
      return;
    }

    await this.startRecording();
  }

  private async startRecording(): Promise<void> {
    try {
      await this.voiceRecorder.start();
      this.state.error = null;
      this.state.errorCode = null;
      this.state.retryAction = null;
      this.setStatus('recording');
      this.render();
    } catch (error) {
      const message = error instanceof Error ? error.message : '无法开始录音，请检查麦克风权限';
      this.setErrorState(message, null, 'MIC_REQUIRED');
      this.render();
    }
  }

  private async stopRecordingAndSend(): Promise<void> {
    if (!this.state.sessionId || !this.state.sessionToken) {
      return;
    }

    try {
      const recording = await this.voiceRecorder.stop();
      await this.submitVoiceMessage({
        requestId: createRequestId('req_voice'),
        blob: recording.blob,
        mimeType: recording.mimeType,
        language: 'zh-CN',
      });
    } catch {
      this.setErrorState('录音上传失败，请重试', null, 'AUDIO_UPLOAD_FAILED');
      this.render();
    }
  }

  private async submitVoiceMessage(params: {
    requestId: string;
    blob: Blob;
    mimeType: string;
    language: string;
  }): Promise<void> {
    if (!this.state.sessionId || !this.state.sessionToken) {
      return;
    }

    this.state.error = null;
    this.state.errorCode = null;
    this.state.retryAction = null;
    this.state.status = 'uploading';
    this.render();
    this.startVoiceProgressIndicators();

    const result = await sendVoiceMessage({
      sessionId: this.state.sessionId,
      sessionToken: this.state.sessionToken,
      requestId: params.requestId,
      blob: params.blob,
      mimeType: params.mimeType,
      language: params.language,
    });

    this.clearVoiceProgressIndicators();
    if (!result.ok) {
      this.applyApiFailure(result, {
        kind: 'send-voice',
        requestId: params.requestId,
        blob: params.blob,
        mimeType: params.mimeType,
        language: params.language,
      });
      this.render();
      return;
    }

    this.state.messages = limitMessages([
      ...this.state.messages,
      result.data.userMessage,
      result.data.assistantMessage,
    ]);
    this.state.status = 'idle';
    this.state.error = null;
    this.state.errorCode = null;
    this.state.retryAction = null;
    this.persistState();
    this.render();
  }

  private async handleRecoveryAction(): Promise<void> {
    const retryAction = this.state.retryAction;
    this.clearVoiceProgressIndicators();
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
      return;
    }

    await this.submitVoiceMessage(retryAction);
  }

  private async retryTextMessage(action: Extract<RetryAction, { kind: 'send-text' }>): Promise<void> {
    if (!this.state.sessionId || !this.state.sessionToken) {
      return;
    }

    this.state.isSendingText = true;
    this.state.status = 'thinking';
    this.state.error = null;
    this.state.errorCode = null;
    this.render();

    const result = await sendTextMessage({
      sessionId: this.state.sessionId,
      sessionToken: this.state.sessionToken,
      text: action.text,
      requestId: action.requestId,
    });

    if (!result.ok) {
      this.state.isSendingText = false;
      this.applyApiFailure(result, action);
      this.render();
      return;
    }

    this.state.messages = limitMessages([
      ...this.state.messages,
      result.data.userMessage,
      result.data.assistantMessage,
    ]);
    this.state.draftText = '';
    this.state.isSendingText = false;
    this.state.status = 'idle';
    this.state.error = null;
    this.state.errorCode = null;
    this.persistState();
    this.render();
  }

  private startVoiceProgressIndicators(): void {
    this.clearVoiceProgressIndicators();
    this.progressTimerIds.push(
      window.setTimeout(() => {
        if (this.state.status === 'uploading') {
          this.setStatus('transcribing');
          this.render();
        }
      }, 700),
    );
    this.progressTimerIds.push(
      window.setTimeout(() => {
        if (this.state.status === 'uploading' || this.state.status === 'transcribing') {
          this.state.status = 'thinking';
          this.render();
        }
      }, 1800),
    );
  }

  private clearVoiceProgressIndicators(): void {
    for (const timerId of this.progressTimerIds) {
      window.clearTimeout(timerId);
    }
    this.progressTimerIds = [];
  }
}
