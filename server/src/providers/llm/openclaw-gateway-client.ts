import { AppException } from '../../lib/errors.js';
import type { AppConfig } from '../../lib/config.js';
import {
  signOpenClawDevicePayload,
  type OpenClawGatewayAuthState,
  type OpenClawGatewayAuthStore,
} from './openclaw-gateway-auth-store.js';
import type { LlmStreamCallbacks, LlmStreamResult } from './provider.js';

type GatewayRequestFrame = {
  type: 'req';
  id: string;
  method: string;
  params?: unknown;
};

type GatewayResponseFrame = {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    retryable?: boolean;
  };
};

type GatewayEventFrame = {
  type: 'event';
  event: string;
  payload?: unknown;
};

type GatewayHelloOkFrame = {
  type: 'hello-ok';
};

type GatewayHelloOkPayload = {
  type: 'hello-ok';
  protocol?: number;
  auth?: {
    role?: string;
    scopes?: string[];
    deviceToken?: string;
  };
};

type GatewayChatEvent = {
  runId?: string;
  sessionKey?: string;
  key?: string;
  seq?: number;
  state?: string;
  type?: string;
  kind?: string;
  phase?: string;
  message?: unknown;
  content?: unknown;
  delta?: unknown;
  value?: unknown;
  errorMessage?: string;
  stopReason?: string;
};

type GatewaySocketFrame =
  | GatewayRequestFrame
  | GatewayResponseFrame
  | GatewayEventFrame
  | GatewayHelloOkFrame;

type PendingResponse = {
  resolve(payload: unknown): void;
  reject(error: Error): void;
};

const GATEWAY_CONNECT_TIMEOUT_MS = 10_000;
const GATEWAY_REQUEST_TIMEOUT_MS = 30_000;
const GATEWAY_CHAT_COMPLETION_TIMEOUT_MS = 45_000;
const GATEWAY_SUBSCRIBE_TIMEOUT_MS = 5_000;
const GATEWAY_CONNECT_DELAY_MS = 750;
const GATEWAY_CONNECT_ROLE = 'operator';
const GATEWAY_CLIENT_ID = 'gateway-client';
const GATEWAY_CLIENT_MODE = 'backend';
const GATEWAY_CONNECT_SCOPES = ['operator.admin', 'operator.approvals', 'operator.pairing'];
const GATEWAY_CONNECT_CAPS = ['tool-events'];

const resolveGatewayPlatform = (): string => {
  if (process.platform === 'darwin') {
    return 'macos';
  }

  if (process.platform === 'win32') {
    return 'windows';
  }

  return process.platform;
};

const createFrameId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;

const normalizeGatewayUrl = (baseUrl: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new AppException(500, {
      code: 'LLM_FAILED',
      message: 'OpenClaw Gateway 地址无效',
      retryable: false,
      details: { baseUrl },
    });
  }

  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  }

  if (!['ws:', 'wss:'].includes(parsed.protocol)) {
    throw new AppException(500, {
      code: 'LLM_FAILED',
      message: 'OpenClaw Gateway 地址必须使用 ws 或 wss 协议',
      retryable: false,
      details: { baseUrl },
    });
  }

  if (parsed.pathname === '/v1/chat/completions') {
    parsed.pathname = '/';
    parsed.search = '';
  }

  return parsed.toString();
};

const resolveOpenClawAgentId = (config: AppConfig): string => {
  if (config.openclawAgentId) {
    return config.openclawAgentId;
  }

  if (config.llmModel.startsWith('openclaw:')) {
    const [, agentId] = config.llmModel.split(':', 2);
    if (agentId) {
      return agentId;
    }
  }

  return 'main';
};

const normalizeScopes = (value: string[] | null | undefined): string[] =>
  Array.from(
    new Set(
      (value ?? [])
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );

const createDeviceSignaturePayload = (params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string | null;
  nonce: string;
}): string =>
  [
    'v2',
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(','),
    String(params.signedAtMs),
    params.token ?? '',
    params.nonce,
  ].join('|');

const extractTextSegments = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return value ? [value] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractTextSegments(entry));
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  const directText = ['text', 'content', 'delta', 'message', 'value']
    .flatMap((key) => extractTextSegments(record[key]));

  if (directText.length > 0) {
    return directText;
  }

  return Object.values(record).flatMap((entry) => extractTextSegments(entry));
};

const resolveChatEventSessionKey = (event: GatewayChatEvent): string | null => {
  if (typeof event.sessionKey === 'string' && event.sessionKey) {
    return event.sessionKey;
  }

  if (typeof event.key === 'string' && event.key) {
    return event.key;
  }

  return null;
};

const resolveChatEventState = (event: GatewayChatEvent): string | null => {
  for (const candidate of [event.state, event.type, event.kind, event.phase]) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().toLowerCase();
    }
  }

  return null;
};

const extractChatEventText = (event: GatewayChatEvent): string => {
  const segments = extractTextSegments([
    event.message,
    event.content,
    event.delta,
    event.value,
  ]);

  return segments.join('');
};

class GatewayConnection {
  private readonly socket: WebSocket;
  private readonly pendingResponses = new Map<string, PendingResponse>();
  private readonly eventListeners = new Map<string, Array<(payload: unknown) => void>>();
  private readonly openPromise: Promise<void>;
  private readonly closePromise: Promise<void>;
  private closed = false;
  private closeResolve!: () => void;
  private connectNonce = '';
  private connectSent = false;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectPromise: Promise<GatewayHelloOkPayload> | null = null;
  private connectResolve: ((payload: GatewayHelloOkPayload) => void) | null = null;
  private connectReject: ((error: Error) => void) | null = null;

  public constructor(
    private readonly config: AppConfig,
    private readonly authStore: OpenClawGatewayAuthStore,
  ) {
    this.socket = new WebSocket(normalizeGatewayUrl(config.llmBaseUrl ?? ''));
    this.openPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new AppException(502, {
            code: 'LLM_TIMEOUT',
            message: '连接 OpenClaw Gateway 超时',
            retryable: true,
          }),
        );
      }, GATEWAY_CONNECT_TIMEOUT_MS);

      this.socket.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      });
      this.socket.addEventListener('error', () => {
        clearTimeout(timer);
        reject(
          new AppException(502, {
            code: 'LLM_FAILED',
            message: '连接 OpenClaw Gateway 失败',
            retryable: true,
          }),
        );
      });
    });

    this.socket.addEventListener('message', (event) => {
      void this.handleMessage(event.data);
    });

    this.closePromise = new Promise((resolve) => {
      this.closeResolve = resolve;
      this.socket.addEventListener('close', () => {
        this.closed = true;
        if (this.connectTimer) {
          clearTimeout(this.connectTimer);
          this.connectTimer = null;
        }
        this.rejectPendingOperations(
          new AppException(502, {
            code: 'LLM_FAILED',
            message: 'OpenClaw Gateway 连接已关闭',
            retryable: true,
          }),
        );
        resolve();
      });
    });

    this.socket.addEventListener('error', () => {
      this.rejectPendingOperations(
        new AppException(502, {
          code: 'LLM_FAILED',
          message: 'OpenClaw Gateway 连接异常中断',
          retryable: true,
        }),
      );
    });
  }

  public async connect(): Promise<void> {
    await this.openPromise;
    await this.ensureConnectPromise();
  }

  public async request(method: string, params?: unknown, timeoutMs = GATEWAY_REQUEST_TIMEOUT_MS): Promise<unknown> {
    const id = createFrameId(method.replace(/\W+/g, '_'));
    const result = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingResponses.delete(id);
        reject(
          new AppException(502, {
            code: 'LLM_TIMEOUT',
            message: '等待 OpenClaw Gateway 响应超时',
            retryable: true,
            details: { method },
          }),
        );
      }, timeoutMs);

      this.pendingResponses.set(id, {
        resolve: (payload) => {
          clearTimeout(timer);
          resolve(payload);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
    });

    this.send({
      type: 'req',
      id,
      method,
      ...(params === undefined ? {} : { params }),
    });

    return result;
  }

  public on(eventName: string, listener: (payload: unknown) => void): void {
    const listeners = this.eventListeners.get(eventName) ?? [];
    listeners.push(listener);
    this.eventListeners.set(eventName, listeners);
  }

  public async close(): Promise<void> {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    if (!this.closed) {
      this.socket.close();
    }
    await this.closePromise;
  }

  private send(frame: GatewayRequestFrame): void {
    this.socket.send(JSON.stringify(frame));
  }

  private rejectPendingOperations(error: AppException): void {
    for (const pending of this.pendingResponses.values()) {
      pending.reject(error);
    }
    this.pendingResponses.clear();
    this.connectReject?.(error);
    this.connectResolve = null;
    this.connectReject = null;
  }

  private ensureConnectPromise(): Promise<GatewayHelloOkPayload> {
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise<GatewayHelloOkPayload>((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
      this.queueConnect();
    });

    return this.connectPromise;
  }

  private queueConnect(): void {
    if (this.connectSent) {
      return;
    }

    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
    }

    this.connectTimer = setTimeout(() => {
      void this.beginConnect();
    }, GATEWAY_CONNECT_DELAY_MS);
  }

  private async buildConnectParams(): Promise<Record<string, unknown>> {
    const authState = await this.authStore.getState(GATEWAY_CONNECT_ROLE);
    const bootstrapToken = this.config.llmApiKey?.trim() || null;
    const authToken = bootstrapToken ?? authState.deviceToken;
    const authDeviceToken = bootstrapToken ? null : authState.deviceToken;
    const signedAt = Date.now();
    const nonce = this.connectNonce;
    const signaturePayload = createDeviceSignaturePayload({
      deviceId: authState.deviceId,
      clientId: GATEWAY_CLIENT_ID,
      clientMode: GATEWAY_CLIENT_MODE,
      role: GATEWAY_CONNECT_ROLE,
      scopes: GATEWAY_CONNECT_SCOPES,
      signedAtMs: signedAt,
      token: bootstrapToken,
      nonce,
    });

    return {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: GATEWAY_CLIENT_ID,
        version: 'tesla-openclaw/0.1.0',
        platform: resolveGatewayPlatform(),
        mode: GATEWAY_CLIENT_MODE,
      },
      role: GATEWAY_CONNECT_ROLE,
      scopes: GATEWAY_CONNECT_SCOPES,
      device: this.buildDevicePayload(authState, signaturePayload, signedAt, nonce),
      caps: GATEWAY_CONNECT_CAPS,
      ...(authToken
        ? {
          auth: {
            token: authToken,
            ...(authDeviceToken ? { deviceToken: authDeviceToken } : {}),
          },
        }
        : {}),
      locale: Intl.DateTimeFormat().resolvedOptions().locale,
      userAgent: 'tesla-openclaw/0.1.0',
    };
  }

  private buildDevicePayload(
    authState: OpenClawGatewayAuthState,
    signaturePayload: string,
    signedAt: number,
    nonce: string,
  ): Record<string, unknown> {
    return {
      id: authState.deviceId,
      publicKey: authState.publicKey,
      signature: signOpenClawDevicePayload(
        authState.privateKey,
        authState.publicKey,
        signaturePayload,
      ),
      signedAt,
      nonce,
    };
  }

  private async beginConnect(): Promise<void> {
    if (this.connectSent) {
      return;
    }

    this.connectSent = true;
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    try {
      const payload = await this.request(
        'connect',
        await this.buildConnectParams(),
        GATEWAY_CONNECT_TIMEOUT_MS,
      );
      const hello = payload as Partial<GatewayHelloOkPayload> | null;
      if (hello?.type !== 'hello-ok') {
        throw new AppException(502, {
          code: 'LLM_FAILED',
          message: 'OpenClaw Gateway 握手响应无效',
          retryable: true,
          ...(payload !== undefined ? { details: { payload } } : {}),
        });
      }

      if (typeof hello.auth?.deviceToken === 'string' && hello.auth.deviceToken.trim()) {
        await this.authStore.saveDeviceToken({
          role: hello.auth.role?.trim() || GATEWAY_CONNECT_ROLE,
          deviceToken: hello.auth.deviceToken.trim(),
          scopes: normalizeScopes(hello.auth.scopes),
        });
      }

      this.connectResolve?.(hello as GatewayHelloOkPayload);
    } catch (error) {
      const appError =
        error instanceof AppException
          ? error
          : new AppException(502, {
            code: 'LLM_FAILED',
            message: error instanceof Error ? error.message : 'OpenClaw Gateway 握手失败',
            retryable: true,
          });
      this.connectReject?.(appError);
    } finally {
      this.connectResolve = null;
      this.connectReject = null;
    }
  }

  private async handleMessage(raw: unknown): Promise<void> {
    let text = '';
    if (typeof raw === 'string') {
      text = raw;
    } else if (raw instanceof ArrayBuffer) {
      text = Buffer.from(raw).toString('utf8');
    } else if (raw instanceof Blob) {
      text = Buffer.from(await raw.arrayBuffer()).toString('utf8');
    }

    if (!text) {
      return;
    }

    let frame: GatewaySocketFrame;
    try {
      frame = JSON.parse(text) as GatewaySocketFrame;
    } catch {
      const error = new AppException(502, {
        code: 'LLM_FAILED',
        message: 'OpenClaw Gateway 响应解析失败',
        retryable: true,
      });
      for (const pending of this.pendingResponses.values()) {
        pending.reject(error);
      }
      this.pendingResponses.clear();
      return;
    }

    if (frame.type === 'res') {
      const pending = this.pendingResponses.get(frame.id);
      if (!pending) {
        return;
      }

      this.pendingResponses.delete(frame.id);
      if (frame.ok) {
        pending.resolve(frame.payload);
        return;
      }

      const error = new AppException(502, {
        code: 'LLM_FAILED',
        message: frame.error?.message ?? 'OpenClaw Gateway 调用失败',
        retryable: frame.error?.retryable ?? true,
        ...(frame.error?.details ? { details: { methodError: frame.error.details } } : {}),
      });
      pending.reject(error);
      return;
    }

    if (frame.type === 'hello-ok') {
      return;
    }

    if (frame.type === 'event') {
      if (frame.event === 'connect.challenge') {
        const payload = frame.payload as { nonce?: unknown } | undefined;
        if (typeof payload?.nonce === 'string') {
          this.connectNonce = payload.nonce;
          void this.beginConnect();
        }
        return;
      }

      const listeners = this.eventListeners.get(frame.event) ?? [];
      for (const listener of listeners) {
        listener(frame.payload);
      }
    }
  }
}

export class OpenClawGatewayClient {
  public constructor(
    private readonly config: AppConfig,
    private readonly authStore: OpenClawGatewayAuthStore,
  ) {}

  public resolveSessionKey(localSessionId: string): string {
    return `agent:${resolveOpenClawAgentId(this.config)}:${localSessionId}`;
  }

  public async resetSession(sessionKey: string): Promise<void> {
    if (!this.config.llmBaseUrl || !this.config.llmApiKey) {
      throw new AppException(500, {
        code: 'LLM_FAILED',
        message: '缺少 OpenClaw Gateway 配置',
        retryable: false,
      });
    }

    const connection = new GatewayConnection(this.config, this.authStore);
    try {
      await connection.connect();
      await connection.request('sessions.reset', { key: sessionKey });
    } finally {
      await connection.close();
    }
  }

  public async sendChat(params: {
    requestId: string;
    sessionKey: string;
    text: string;
    callbacks: LlmStreamCallbacks;
  }): Promise<LlmStreamResult> {
    if (!this.config.llmBaseUrl || !this.config.llmApiKey) {
      throw new AppException(500, {
        code: 'LLM_FAILED',
        message: '缺少 OpenClaw Gateway 配置',
        retryable: false,
      });
    }

    const connection = new GatewayConnection(this.config, this.authStore);
    let collected = '';
    let deltaCount = 0;
    let completionMarkerObserved = false;
    let finishReason: string | null = null;
    let terminationReason = 'stream_closed_without_completion';
    let lastRunId: string | null = null;
    let subscriptionMode: 'sessionKey' | 'key' | 'unsupported' | 'skipped' = 'skipped';
    let cancelChatCompletion = (): void => {};

    try {
      await connection.connect();
      subscriptionMode = await this.subscribeToChat(connection, params.sessionKey);

      const chatCompletion = new Promise<void>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          terminationReason = 'chat_event_timeout';
          reject(
            new AppException(502, {
              code: 'LLM_TIMEOUT',
              message: '等待 OpenClaw Gateway 回复超时',
              retryable: true,
              details: {
                sessionKey: params.sessionKey,
                requestId: params.requestId,
                subscriptionMode,
                deltaCount,
                lastRunId,
              },
            }),
          );
        }, GATEWAY_CHAT_COMPLETION_TIMEOUT_MS);

        const finish = (fn: () => void): void => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          fn();
        };

        cancelChatCompletion = () => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          resolve();
        };

        connection.on('chat', (payload) => {
          const event = (payload ?? {}) as GatewayChatEvent;
          if (resolveChatEventSessionKey(event) !== params.sessionKey) {
            return;
          }

          if (event.runId) {
            lastRunId = event.runId;
          }

          const nextText = extractChatEventText(event);
          const eventState = resolveChatEventState(event);

          if (eventState === 'delta' || eventState === 'stream' || eventState === 'chunk' || eventState === 'partial') {
            if (!nextText) {
              return;
            }
            collected += nextText;
            deltaCount += 1;
            void Promise.resolve(params.callbacks.onDelta(nextText)).catch(reject);
            return;
          }

          if (eventState === 'final' || eventState === 'done' || eventState === 'complete' || eventState === 'completed') {
            completionMarkerObserved = true;
            finishReason = event.stopReason ?? 'complete';
            terminationReason = 'final_event';

            if (!collected && nextText) {
              collected = nextText;
            }

            finish(resolve);
            return;
          }

          if (eventState === 'aborted' || eventState === 'cancelled' || eventState === 'canceled') {
            terminationReason = 'aborted';
            finish(() =>
              reject(
                new AppException(502, {
                  code: 'LLM_FAILED',
                  message: 'OpenClaw Gateway 回复已中止',
                  retryable: true,
                  details: {
                    runId: lastRunId,
                    stopReason: event.stopReason,
                    subscriptionMode,
                  },
                }),
              ),
            );
            return;
          }

          if (eventState === 'error' || eventState === 'failed') {
            terminationReason = 'error_event';
            finish(() =>
              reject(
                new AppException(502, {
                  code: 'LLM_FAILED',
                  message: event.errorMessage ?? 'OpenClaw Gateway 回复失败',
                  retryable: true,
                  details: {
                    runId: lastRunId,
                    subscriptionMode,
                  },
                }),
              ),
            );
          }
        });
      });

      await connection.request('chat.send', {
        sessionKey: params.sessionKey,
        message: params.text,
        deliver: true,
        idempotencyKey: params.requestId,
      });
      await chatCompletion;
    } finally {
      cancelChatCompletion();
      await connection.close();
    }

    const finalText = collected.trim();
    if (!finalText) {
      throw new AppException(502, {
        code: 'LLM_FAILED',
        message: 'OpenClaw 返回为空',
        retryable: true,
        details: {
          provider: 'openclaw',
          completionMarkerObserved,
          finishReason,
          deltaCount,
          characterCount: 0,
          terminationReason,
          subscriptionMode,
        },
      });
    }

    return {
      replyText: finalText,
      diagnostics: {
        provider: 'openclaw',
        completionMarkerObserved,
        finishReason,
        deltaCount,
        characterCount: finalText.length,
        terminationReason,
      },
    };
  }

  private async subscribeToChat(
    connection: GatewayConnection,
    sessionKey: string,
  ): Promise<'sessionKey' | 'key' | 'unsupported' | 'skipped'> {
    const candidates: Array<{ mode: 'sessionKey' | 'key'; params: { sessionKey?: string; key?: string } }> = [
      { mode: 'sessionKey', params: { sessionKey } },
      { mode: 'key', params: { key: sessionKey } },
    ];

    for (const candidate of candidates) {
      try {
        await connection.request('chat.subscribe', candidate.params, GATEWAY_SUBSCRIBE_TIMEOUT_MS);
        return candidate.mode;
      } catch {
        continue;
      }
    }

    return 'unsupported';
  }
}
