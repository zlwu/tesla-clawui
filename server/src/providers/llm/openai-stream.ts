import { AppException } from '../../lib/errors.js';

type OpenAiStreamChunk = {
  choices?: Array<{
    delta?: { content?: string };
  }>;
};

export const readOpenAiCompatibleStream = async (params: {
  response: Response;
  onDelta(delta: string): Promise<void> | void;
  emptyMessage: string;
}): Promise<string> => {
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
          continue;
        }

        const chunk = JSON.parse(data) as OpenAiStreamChunk;
        const delta = chunk.choices?.[0]?.delta?.content ?? '';
        if (!delta) {
          continue;
        }

        collected += delta;
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
    });
  }

  return finalText;
};
