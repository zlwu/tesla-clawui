import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AppConfig } from '../lib/config.js';
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

describe('OpenClawProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends OpenClaw auth, encoded agent model, and stable user session', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'OpenClaw reply' } }],
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenClawProvider(createConfig());
    const reply = await provider.generateReply({
      sessionId: 'sess_123',
      requestId: 'req_123',
      text: '你好',
      history: [{ role: 'assistant', content: '上一轮回复' }],
    });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = requestInit?.headers as Record<string, string> | undefined;
    const requestBody = parseRequestBody(requestInit);

    expect(reply).toBe('OpenClaw reply');
    expect(fetchMock.mock.calls[0]?.[0]).toBe(createConfig().llmBaseUrl);
    expect(headers).toBeDefined();
    expect(headers?.Authorization).toBe('Bearer gateway-token');
    expect(requestBody).toMatchObject({
      model: 'openclaw:main',
      user: 'sess_123',
    });
    expect(requestBody?.messages).toEqual([
      {
        role: 'system',
        content: '你是 Tesla 车机里的 OpenClaw 助手。回答简洁、清晰、适合大字文本显示。',
      },
      { role: 'assistant', content: '上一轮回复' },
      { role: 'user', content: '你好' },
    ]);
  });

  it('throws a stable error when OpenClaw returns empty content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            choices: [{ message: { content: '   ' } }],
          }),
      }),
    );

    const provider = new OpenClawProvider(createConfig());

    await expect(
      provider.generateReply({
        sessionId: 'sess_123',
        requestId: 'req_123',
        text: '你好',
        history: [],
      }),
    ).rejects.toMatchObject({
      payload: {
        code: 'LLM_FAILED',
        message: 'OpenClaw 返回为空',
      },
    });
  });

  it('keeps an explicit model ref unchanged', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'OpenClaw reply' } }],
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenClawProvider({
      ...createConfig(),
      llmModel: 'openclaw:ops',
    });
    await provider.generateReply({
      sessionId: 'sess_123',
      requestId: 'req_123',
      text: '你好',
      history: [],
    });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const requestBody = parseRequestBody(requestInit);

    expect(requestBody?.model).toBe('openclaw:ops');
  });

  it('returns stream diagnostics when upstream stream completes', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"OpenClaw"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":" stream"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(stream, {
          status: 200,
          headers: {
            'content-type': 'text/event-stream; charset=utf-8',
          },
        }),
      ),
    );

    const provider = new OpenClawProvider(createConfig());
    const result = await provider.generateReplyStream(
      {
        sessionId: 'sess_123',
        requestId: 'req_stream_ok',
        text: '你好',
        history: [],
      },
      { onDelta: () => {} },
    );

    expect(result.replyText).toBe('OpenClaw stream');
    expect(result.diagnostics.provider).toBe('openclaw');
    expect(result.diagnostics.completionMarkerObserved).toBe(true);
    expect(result.diagnostics.deltaCount).toBe(2);
  });

  it('throws a stable stream error when upstream call fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      }),
    );

    const provider = new OpenClawProvider(createConfig());

    await expect(
      provider.generateReplyStream(
        {
          sessionId: 'sess_123',
          requestId: 'req_stream_fail',
          text: '你好',
          history: [],
        },
        { onDelta: () => {} },
      ),
    ).rejects.toMatchObject({
      payload: {
        code: 'LLM_FAILED',
        message: 'OpenClaw 服务调用失败',
      },
    });
  });
});

const parseRequestBody = (
  requestInit: RequestInit | undefined,
): { model?: string; user?: string; messages?: Array<{ role: string; content: string }> } | undefined => {
  if (typeof requestInit?.body !== 'string') {
    return undefined;
  }

  return JSON.parse(requestInit.body) as {
    model?: string;
    user?: string;
    messages?: Array<{ role: string; content: string }>;
  };
};
