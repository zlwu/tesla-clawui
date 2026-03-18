import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearSessionContext, sendTextMessageStream } from '../api.js';

describe('sendTextMessageStream', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses SSE start, delta, and done events', async () => {
    const chunks = [
      'event: start\n',
      'data: {"sessionId":"sess_1","requestId":"req_1"}\n\n',
      'event: delta\n',
      'data: {"delta":"你好"}\n\n',
      'event: delta\n',
      'data: {"delta":"，世界"}\n\n',
      'event: done\n',
      `data: ${JSON.stringify({
        requestId: 'req_1',
        sessionId: 'sess_1',
        userMessage: {
          messageId: 'msg_user_1',
          sessionId: 'sess_1',
          role: 'user',
          content: 'hello',
          source: 'text',
          createdAt: new Date().toISOString(),
        },
        assistantMessage: {
          messageId: 'msg_assistant_1',
          sessionId: 'sess_1',
          role: 'assistant',
          content: '你好，世界',
          source: 'llm',
          createdAt: new Date().toISOString(),
        },
        status: 'idle',
      })}\n\n`,
    ];

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: {
          'content-type': 'text/event-stream; charset=utf-8',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const deltas: string[] = [];
    const started: string[] = [];
    const result = await sendTextMessageStream({
      sessionId: 'sess_1',
      sessionToken: 'token_1',
      text: 'hello',
      requestId: 'req_1',
      onStart: () => {
        started.push('started');
      },
      onDelta: (delta) => {
        deltas.push(delta);
      },
    });

    expect(result.ok).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).not.toContain('openclawSessionKey');
    expect(started).toHaveLength(1);
    expect(deltas).toEqual(['你好', '，世界']);
    if (result.ok) {
      expect(result.data.assistantMessage.content).toBe('你好，世界');
    }
  });

  it('returns retryable failure when SSE stream ends before done/error', async () => {
    const chunks = [
      'event: start\n',
      'data: {"sessionId":"sess_1","requestId":"req_2"}\n\n',
      'event: delta\n',
      'data: {"delta":"半句"}\n\n',
    ];

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(stream, {
        status: 200,
        headers: {
          'content-type': 'text/event-stream; charset=utf-8',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const deltas: string[] = [];
    const result = await sendTextMessageStream({
      sessionId: 'sess_1',
      sessionToken: 'token_1',
      text: 'hello',
      requestId: 'req_2',
      onStart: () => {},
      onDelta: (delta) => {
        deltas.push(delta);
      },
    });

    expect(deltas).toEqual(['半句']);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).not.toContain('openclawSessionKey');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SERVICE_UNAVAILABLE');
      expect(result.error.retryable).toBe(true);
      expect(result.error.message).toBe('流式响应提前结束，请稍后重试');
    }
  });

  it('posts clear-context requests to the session clear endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({
          ok: true,
          data: {
            sessionId: 'sess_1',
            cleared: true,
          },
        }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await clearSessionContext('sess_1', 'token_1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/session/clear');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer token_1',
        'Content-Type': 'application/json',
      }),
    );
    expect(result.ok).toBe(true);
  });
});
