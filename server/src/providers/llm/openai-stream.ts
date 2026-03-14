import { AppException } from '../../lib/errors.js';
import type { LlmStreamResult } from './provider.js';

type OpenAiStreamChunk = {
  choices?: Array<{
    delta?: { content?: string };
    finish_reason?: string | null;
  }>;
};

export const readOpenAiCompatibleStream = async (params: {
  provider: string;
  response: Response;
  onDelta(delta: string): Promise<void> | void;
  emptyMessage: string;
}): Promise<LlmStreamResult> => {
  if (!params.response.body) {
    throw new AppException(502, {
      code: 'LLM_FAILED',
      message: 'LLM 流式响应为空',
      retryable: true,
    });
  }

  const reader = params.response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let collected = '';
  let deltaCount = 0;
  let completionMarkerObserved = false;
  let finishReason: string | null = null;
  let terminationReason = 'stream_closed_without_completion';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const boundaryIndex = buffer.indexOf('\n\n');
      if (boundaryIndex === -1) {
        break;
      }

      const eventBlock = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + 2);

      for (const rawLine of eventBlock.split('\n')) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) {
          continue;
        }

        const data = line.slice('data:'.length).trim();
        if (!data) {
          continue;
        }

        if (data === '[DONE]') {
          completionMarkerObserved = true;
          terminationReason = 'done_marker';
          continue;
        }

        let chunk: OpenAiStreamChunk;
        try {
          chunk = JSON.parse(data) as OpenAiStreamChunk;
        } catch {
          throw new AppException(502, {
            code: 'LLM_FAILED',
            message: 'LLM 流式响应解析失败',
            retryable: true,
            details: {
              provider: params.provider,
              terminationReason: 'parse_error',
            },
          });
        }

        const chunkFinishReason = chunk.choices?.[0]?.finish_reason ?? null;
        if (chunkFinishReason) {
          completionMarkerObserved = true;
          finishReason = chunkFinishReason;
          terminationReason = 'finish_reason';
        }

        const delta = chunk.choices?.[0]?.delta?.content ?? '';
        if (!delta) {
          continue;
        }

        collected += delta;
        deltaCount += 1;
        await params.onDelta(delta);
      }
    }
  }

  const finalText = collected.trim();
  if (!finalText) {
    throw new AppException(502, {
      code: 'LLM_FAILED',
      message: params.emptyMessage,
      retryable: true,
      details: {
        provider: params.provider,
        completionMarkerObserved,
        finishReason,
        deltaCount,
        characterCount: 0,
        terminationReason,
      },
    });
  }

  return {
    replyText: finalText,
    diagnostics: {
      provider: params.provider,
      completionMarkerObserved,
      finishReason,
      deltaCount,
      characterCount: finalText.length,
      terminationReason,
    },
  };
};
