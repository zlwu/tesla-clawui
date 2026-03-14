import { describe, expect, it } from 'vitest';

import { readOpenAiCompatibleStream } from './openai-stream.js';

const createStreamResponse = (chunks: string[]): Response => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
    },
  });
};

describe('readOpenAiCompatibleStream', () => {
  it('returns reply text and completion metadata when [DONE] is observed', async () => {
    const deltas: string[] = [];
    const result = await readOpenAiCompatibleStream({
      provider: 'openai-compatible',
      response: createStreamResponse([
        'data: {"choices":[{"delta":{"content":"你好"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"，世界"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
      onDelta: (delta) => {
        deltas.push(delta);
      },
      emptyMessage: 'LLM 返回为空',
    });

    expect(deltas).toEqual(['你好', '，世界']);
    expect(result.replyText).toBe('你好，世界');
    expect(result.diagnostics.completionMarkerObserved).toBe(true);
    expect(result.diagnostics.terminationReason).toBe('done_marker');
    expect(result.diagnostics.deltaCount).toBe(2);
  });

  it('treats finish_reason as an explicit completion marker', async () => {
    const result = await readOpenAiCompatibleStream({
      provider: 'openai-compatible',
      response: createStreamResponse([
        'data: {"choices":[{"delta":{"content":"已完成"}}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
      ]),
      onDelta: () => {},
      emptyMessage: 'LLM 返回为空',
    });

    expect(result.replyText).toBe('已完成');
    expect(result.diagnostics.completionMarkerObserved).toBe(true);
    expect(result.diagnostics.finishReason).toBe('stop');
    expect(result.diagnostics.terminationReason).toBe('finish_reason');
  });

  it('returns diagnostics for silent truncation after partial deltas', async () => {
    const result = await readOpenAiCompatibleStream({
      provider: 'openai-compatible',
      response: createStreamResponse([
        'data: {"choices":[{"delta":{"content":"说到一半"}}]}\n\n',
      ]),
      onDelta: () => {},
      emptyMessage: 'LLM 返回为空',
    });

    expect(result.replyText).toBe('说到一半');
    expect(result.diagnostics.completionMarkerObserved).toBe(false);
    expect(result.diagnostics.terminationReason).toBe('stream_closed_without_completion');
  });

  it('throws a stable error when stream output is empty', async () => {
    await expect(
      readOpenAiCompatibleStream({
        provider: 'openai-compatible',
        response: createStreamResponse(['data: [DONE]\n\n']),
        onDelta: () => {},
        emptyMessage: 'LLM 返回为空',
      }),
    ).rejects.toMatchObject({
      payload: {
        code: 'LLM_FAILED',
        message: 'LLM 返回为空',
      },
    });
  });
});
