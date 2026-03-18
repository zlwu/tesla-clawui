import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AppConfig } from '../lib/config.js';
import { MemoryOpenClawGatewayAuthStore } from '../providers/llm/openclaw-gateway-auth-store.js';
import { OpenClawProvider } from '../providers/llm/openclaw-provider.js';

const createConfig = (): AppConfig => ({
  port: 3000,
  host: '0.0.0.0',
  databaseUrl: '/tmp/openclaw-test.db',
  sessionTokenBytes: 24,
  authEnabled: false,
  authSessionDays: 90,
  messageLimitDefault: 8,
  messageLimitMax: 20,
  llmProvider: 'openclaw',
  llmBaseUrl: 'http://127.0.0.1:18789/v1/chat/completions',
  llmApiKey: 'gateway-token',
  llmModel: 'openclaw',
  openclawAgentId: 'main',
});

type SentFrame = {
  type: 'req';
  id: string;
  method: string;
  params?: unknown;
};

class FakeWebSocket {
  public static instances: FakeWebSocket[] = [];
  public readonly sentFrames: SentFrame[] = [];
  private readonly listeners = new Map<string, Set<(event: { data?: unknown }) => void>>();
  private readonly scriptedErrorMethod: string | null;
  private readonly scriptedCloseMethod: string | null;
  private readonly scriptedChatEvents: Array<Record<string, unknown>>;
  private readonly scriptedConnectPayload: Record<string, unknown> | null;
  private readonly scriptedConnectChallengeNonce: string | null;

  public constructor(public readonly url: string) {
    this.scriptedErrorMethod = FakeWebSocket.nextScriptedErrorMethod;
    this.scriptedCloseMethod = FakeWebSocket.nextScriptedCloseMethod;
    this.scriptedChatEvents = FakeWebSocket.nextScriptedChatEvents;
    this.scriptedConnectPayload = FakeWebSocket.nextScriptedConnectPayload;
    this.scriptedConnectChallengeNonce = FakeWebSocket.nextScriptedConnectChallengeNonce;
    FakeWebSocket.instances.push(this);
    FakeWebSocket.nextScriptedErrorMethod = null;
    FakeWebSocket.nextScriptedCloseMethod = null;
    FakeWebSocket.nextScriptedChatEvents = [];
    FakeWebSocket.nextScriptedConnectPayload = {
      type: 'hello-ok',
      protocol: 3,
      auth: {
        role: 'operator',
        scopes: ['operator.admin', 'operator.write'],
        deviceToken: 'device-token-1',
      },
    };
    FakeWebSocket.nextScriptedConnectChallengeNonce = 'nonce_test';
    queueMicrotask(() => {
      this.dispatch('open', {});
      if (this.scriptedConnectChallengeNonce) {
        this.dispatch('message', {
          data: JSON.stringify({
            type: 'event',
            event: 'connect.challenge',
            payload: {
              nonce: this.scriptedConnectChallengeNonce,
            },
          }),
        });
      }
    });
  }

  private static nextScriptedErrorMethod: string | null = null;
  private static nextScriptedCloseMethod: string | null = null;
  private static nextScriptedChatEvents: Array<Record<string, unknown>> = [];
  private static nextScriptedConnectPayload: Record<string, unknown> | null = {
    type: 'hello-ok',
    protocol: 3,
    auth: {
      role: 'operator',
      scopes: ['operator.admin', 'operator.write'],
      deviceToken: 'device-token-1',
    },
  };
  private static nextScriptedConnectChallengeNonce: string | null = 'nonce_test';

  public static scriptChat(events: Array<Record<string, unknown>>): void {
    FakeWebSocket.nextScriptedChatEvents = events;
  }

  public static scriptMethodError(method: string): void {
    FakeWebSocket.nextScriptedErrorMethod = method;
  }

  public static scriptMethodClose(method: string): void {
    FakeWebSocket.nextScriptedCloseMethod = method;
  }

  public static scriptConnectPayload(payload: Record<string, unknown> | null): void {
    FakeWebSocket.nextScriptedConnectPayload = payload;
  }

  public static scriptConnectChallenge(nonce: string | null): void {
    FakeWebSocket.nextScriptedConnectChallengeNonce = nonce;
  }

  public addEventListener(type: string, listener: (event: { data?: unknown }) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  public send(payload: string): void {
    const frame = JSON.parse(payload) as SentFrame;
    this.sentFrames.push(frame);

    if (frame.method === 'connect') {
      if (this.scriptedCloseMethod === 'connect') {
        queueMicrotask(() => this.dispatch('close', {}));
        return;
      }

      if (this.scriptedErrorMethod === 'connect') {
        queueMicrotask(() =>
          this.dispatch('message', {
            data: JSON.stringify({
              type: 'res',
              id: frame.id,
              ok: false,
              error: {
                message: 'OpenClaw Gateway 调用失败',
                retryable: true,
              },
            }),
          }),
        );
        return;
      }

      if (this.scriptedConnectPayload) {
        queueMicrotask(() =>
          this.dispatch('message', {
            data: JSON.stringify({
              type: 'res',
              id: frame.id,
              ok: true,
              payload: this.scriptedConnectPayload,
            }),
          }),
        );
      }
      return;
    }

    if (frame.method === this.scriptedCloseMethod) {
      queueMicrotask(() => this.dispatch('close', {}));
      return;
    }

    if (frame.method === this.scriptedErrorMethod) {
      queueMicrotask(() =>
        this.dispatch('message', {
          data: JSON.stringify({
            type: 'res',
            id: frame.id,
            ok: false,
            error: {
              message: 'OpenClaw Gateway 调用失败',
              retryable: true,
            },
          }),
        }),
      );
      return;
    }

    queueMicrotask(() =>
      this.dispatch('message', {
        data: JSON.stringify({
          type: 'res',
          id: frame.id,
          ok: true,
          payload: { accepted: true },
        }),
      }),
    );

    if (frame.method === 'chat.send') {
      for (const eventPayload of this.scriptedChatEvents) {
        queueMicrotask(() =>
          this.dispatch('message', {
            data: JSON.stringify({
              type: 'event',
              event: 'chat',
              payload: eventPayload,
            }),
          }),
        );
      }
    }
  }

  public close(): void {
    queueMicrotask(() => this.dispatch('close', {}));
  }

  private dispatch(type: string, event: { data?: unknown }): void {
    const listeners = this.listeners.get(type);
    if (!listeners) {
      return;
    }
    for (const listener of listeners) {
      listener(event);
    }
  }
}

describe('OpenClawProvider', () => {
  afterEach(() => {
    FakeWebSocket.instances = [];
    vi.restoreAllMocks();
  });

  it('connects to the Gateway websocket and sends native chat frames', async () => {
    FakeWebSocket.scriptChat([
      {
        sessionKey: 'agent:main:sess_123',
        state: 'delta',
        message: { text: 'OpenClaw' },
      },
      {
        sessionKey: 'agent:main:sess_123',
        state: 'final',
        stopReason: 'complete',
        message: { text: 'OpenClaw' },
      },
    ]);
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);

    const authStore = new MemoryOpenClawGatewayAuthStore();
    const provider = new OpenClawProvider(createConfig(), authStore);
    const reply = await provider.generateReply({
      sessionId: 'sess_123',
      requestId: 'req_123',
      text: '你好',
      upstreamSessionKey: 'agent:main:sess_123',
      history: [{ role: 'assistant', content: '上一轮回复' }],
    });

    expect(reply).toBe('OpenClaw');
    const socket = FakeWebSocket.instances[0];
    expect(socket?.url).toBe('ws://127.0.0.1:18789/');
    expect(socket?.sentFrames.map((frame) => frame.method)).toEqual(['connect', 'chat.subscribe', 'chat.send']);
    expect(socket?.sentFrames[0]?.params).toMatchObject({
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'gateway-client',
        mode: 'backend',
      },
      role: 'operator',
      scopes: ['operator.admin', 'operator.approvals', 'operator.pairing'],
      caps: ['tool-events'],
      device: {
        nonce: 'nonce_test',
      },
    });
    expect((socket?.sentFrames[0]?.params as { device?: { publicKey?: string; signature?: string } })?.device?.publicKey).toEqual(expect.any(String));
    expect((socket?.sentFrames[0]?.params as { device?: { publicKey?: string; signature?: string } })?.device?.signature).toEqual(expect.any(String));
    expect(socket?.sentFrames[1]?.params).toMatchObject({
      sessionKey: 'agent:main:sess_123',
    });
    expect(socket?.sentFrames[2]?.params).toMatchObject({
      sessionKey: 'agent:main:sess_123',
      message: '你好',
      idempotencyKey: 'req_123',
    });
    await expect(authStore.getState('operator')).resolves.toMatchObject({
      deviceToken: 'device-token-1',
      scopes: ['operator.admin', 'operator.write'],
    });
  });

  it('throws a stable error when Gateway returns empty content', async () => {
    FakeWebSocket.scriptChat([
      {
        sessionKey: 'agent:main:sess_123',
        state: 'final',
        stopReason: 'complete',
        message: { text: '   ' },
      },
    ]);
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);

    const provider = new OpenClawProvider(createConfig(), new MemoryOpenClawGatewayAuthStore());

    await expect(
      provider.generateReply({
        sessionId: 'sess_123',
        requestId: 'req_123',
        text: '你好',
        upstreamSessionKey: 'agent:main:sess_123',
        history: [],
      }),
    ).rejects.toMatchObject({
      payload: {
        code: 'LLM_FAILED',
        message: 'OpenClaw 返回为空',
      },
    });
  });

  it('derives the upstream session key from llmModel when agent id is embedded there', async () => {
    FakeWebSocket.scriptChat([
      {
        sessionKey: 'agent:ops:sess_123',
        state: 'delta',
        message: { text: 'Hello' },
      },
      {
        sessionKey: 'agent:ops:sess_123',
        state: 'final',
        stopReason: 'complete',
        message: { text: 'Hello' },
      },
    ]);
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);

    const configWithoutAgentId = createConfig();
    delete configWithoutAgentId.openclawAgentId;
    const provider = new OpenClawProvider({
      ...configWithoutAgentId,
      llmModel: 'openclaw:ops',
    }, new MemoryOpenClawGatewayAuthStore());
    await provider.generateReply({
      sessionId: 'sess_123',
      requestId: 'req_123',
      text: '你好',
      upstreamSessionKey: 'agent:ops:sess_123',
      history: [],
    });

    const socket = FakeWebSocket.instances[0];
    expect(socket?.sentFrames[2]?.params).toMatchObject({
      sessionKey: 'agent:ops:sess_123',
    });
  });

  it('returns stream diagnostics when Gateway stream completes', async () => {
    FakeWebSocket.scriptChat([
      {
        sessionKey: 'agent:main:sess_123',
        state: 'delta',
        message: { text: 'OpenClaw' },
      },
      {
        sessionKey: 'agent:main:sess_123',
        state: 'delta',
        message: { text: ' stream' },
      },
      {
        sessionKey: 'agent:main:sess_123',
        state: 'final',
        stopReason: 'complete',
      },
    ]);
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);

    const provider = new OpenClawProvider(createConfig(), new MemoryOpenClawGatewayAuthStore());
    const result = await provider.generateReplyStream(
      {
        sessionId: 'sess_123',
        requestId: 'req_stream_ok',
        text: '你好',
        upstreamSessionKey: 'agent:main:sess_123',
        history: [],
      },
      { onDelta: () => {} },
    );

    expect(result.replyText).toBe('OpenClaw stream');
    expect(result.diagnostics.provider).toBe('openclaw');
    expect(result.diagnostics.completionMarkerObserved).toBe(true);
    expect(result.diagnostics.deltaCount).toBe(2);
    expect(result.diagnostics.finishReason).toBe('complete');
  });

  it('throws a stable stream error when the Gateway request fails', async () => {
    FakeWebSocket.scriptMethodError('chat.send');
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);

    const provider = new OpenClawProvider(createConfig(), new MemoryOpenClawGatewayAuthStore());

    await expect(
      provider.generateReplyStream(
        {
          sessionId: 'sess_123',
          requestId: 'req_stream_fail',
          text: '你好',
          upstreamSessionKey: 'agent:main:sess_123',
          history: [],
        },
        { onDelta: () => {} },
      ),
    ).rejects.toMatchObject({
      payload: {
        code: 'LLM_FAILED',
        message: 'OpenClaw Gateway 调用失败',
      },
    });
  });

  it('surfaces the Gateway connect error instead of timing out', async () => {
    FakeWebSocket.scriptMethodError('connect');
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);

    const provider = new OpenClawProvider(createConfig(), new MemoryOpenClawGatewayAuthStore());

    await expect(
      provider.generateReply({
        sessionId: 'sess_123',
        requestId: 'req_connect_fail',
        text: '你好',
        upstreamSessionKey: 'agent:main:sess_123',
        history: [],
      }),
    ).rejects.toMatchObject({
      payload: {
        code: 'LLM_FAILED',
        message: 'OpenClaw Gateway 调用失败',
      },
    });
  });

  it('fails fast when the Gateway closes before replying', async () => {
    FakeWebSocket.scriptMethodClose('chat.send');
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);

    const provider = new OpenClawProvider(createConfig(), new MemoryOpenClawGatewayAuthStore());

    await expect(
      provider.generateReply({
        sessionId: 'sess_123',
        requestId: 'req_close_fail',
        text: '你好',
        upstreamSessionKey: 'agent:main:sess_123',
        history: [],
      }),
    ).rejects.toMatchObject({
      payload: {
        code: 'LLM_FAILED',
        message: 'OpenClaw Gateway 连接已关闭',
      },
    });
  });

  it('resets the mapped upstream session through sessions.reset', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket);

    const provider = new OpenClawProvider(createConfig(), new MemoryOpenClawGatewayAuthStore());
    await provider.resetSession({
      sessionId: 'sess_123',
      upstreamSessionKey: 'agent:main:sess_123',
    });

    const socket = FakeWebSocket.instances[0];
    expect(socket?.sentFrames.map((frame) => frame.method)).toEqual(['connect', 'sessions.reset']);
    expect(socket?.sentFrames[1]?.params).toEqual({ key: 'agent:main:sess_123' });
  });
});
