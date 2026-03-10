import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sendTextMessageStream } from '../api.js';

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
    expect(started).toHaveLength(1);
    expect(deltas).toEqual(['你好', '，世界']);
    if (result.ok) {
      expect(result.data.assistantMessage.content).toBe('你好，世界');
    }
  });
});
