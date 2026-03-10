import type {
  ApiFailure,
  ApiResponse,
  CreateSessionResponse,
  MessagesResponse,
  TextInputResponse,
  VoiceInputResponse,
} from '@tesla-openclaw/shared';
import {
  apiErrorResponseSchema,
  apiSuccessSchema,
  createSessionResponseSchema,
  messagesResponseSchema,
  textInputResponseSchema,
  voiceInputResponseSchema,
} from '@tesla-openclaw/shared';

import { getWebConfig } from './config.js';

const createSessionEnvelopeSchema = apiSuccessSchema(createSessionResponseSchema);
const textInputEnvelopeSchema = apiSuccessSchema(textInputResponseSchema);
const voiceInputEnvelopeSchema = apiSuccessSchema(voiceInputResponseSchema);
const messagesEnvelopeSchema = apiSuccessSchema(messagesResponseSchema);
const webConfig = getWebConfig();

const toApiUrl = (path: string): string => `${webConfig.apiBaseUrl}${path}`;

const networkError = (message: string): ApiFailure => ({
  ok: false,
  error: {
    code: 'SERVICE_UNAVAILABLE',
    message,
    retryable: true,
  },
});

type TextStreamCallbacks = {
  onStart(): void;
  onDelta(delta: string): void;
};

const parseResponse = async <T>(
  response: Response,
  successSchema: { parse(data: unknown): ApiResponse<T> },
): Promise<ApiResponse<T>> => {
  const payload = (await response.json()) as unknown;
  if (response.ok) {
    return successSchema.parse(payload);
  }

  return apiErrorResponseSchema.parse(payload);
};

const safeRequest = async <T>(
  request: () => Promise<Response>,
  successSchema: { parse(data: unknown): ApiResponse<T> },
): Promise<ApiResponse<T>> => {
  try {
    const response = await request();
    return await parseResponse(response, successSchema);
  } catch {
    return networkError('网络不可用，请稍后重试');
  }
};

export const createSession = async (): Promise<ApiResponse<CreateSessionResponse>> =>
  safeRequest(
    async () =>
      fetch(toApiUrl('/api/session/create'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          device: {
            type: 'tesla-browser',
            label: 'tesla-mcu2',
          },
        }),
      }),
    createSessionEnvelopeSchema,
  );

export const fetchMessages = async (
  sessionId: string,
  sessionToken: string,
): Promise<ApiResponse<MessagesResponse>> =>
  safeRequest(
    async () =>
      fetch(toApiUrl(`/api/messages?sessionId=${encodeURIComponent(sessionId)}&limit=8`), {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      }),
    messagesEnvelopeSchema,
  );

export const sendTextMessage = async (params: {
  sessionId: string;
  sessionToken: string;
  text: string;
  requestId: string;
}): Promise<ApiResponse<TextInputResponse>> =>
  safeRequest(
    async () =>
      fetch(toApiUrl('/api/text/input'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.sessionToken}`,
        },
        body: JSON.stringify({
          sessionId: params.sessionId,
          text: params.text,
          requestId: params.requestId,
        }),
      }),
    textInputEnvelopeSchema,
  );

const parseSsePayload = async <T>(response: Response, callbacks: TextStreamCallbacks): Promise<ApiResponse<T>> => {
  if (!response.body) {
    return networkError('当前浏览器不支持流式响应，请稍后重试');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = 'message';
  let completedPayload: ApiResponse<T> | null = null;

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

      currentEvent = 'message';
      const dataLines: string[] = [];
      for (const rawLine of eventBlock.split('\n')) {
        if (rawLine.startsWith('event:')) {
          currentEvent = rawLine.slice('event:'.length).trim();
          continue;
        }

        if (rawLine.startsWith('data:')) {
          dataLines.push(rawLine.slice('data:'.length).trim());
        }
      }

      if (dataLines.length === 0) {
        continue;
      }

      const data = JSON.parse(dataLines.join('\n')) as unknown;
      if (currentEvent === 'start') {
        callbacks.onStart();
        continue;
      }

      if (currentEvent === 'delta') {
        const delta = (data as { delta?: string }).delta;
        if (delta) {
          callbacks.onDelta(delta);
        }
        continue;
      }

      if (currentEvent === 'error') {
        completedPayload = apiErrorResponseSchema.parse(data) as ApiResponse<T>;
        break;
      }

      if (currentEvent === 'done') {
        completedPayload = {
          ok: true,
          data: textInputResponseSchema.parse(data) as T,
        };
        break;
      }
    }

    if (completedPayload) {
      break;
    }
  }

  return completedPayload ?? networkError('流式响应提前结束，请稍后重试');
};

export const sendTextMessageStream = async (params: {
  sessionId: string;
  sessionToken: string;
  text: string;
  requestId: string;
  onStart(): void;
  onDelta(delta: string): void;
}): Promise<ApiResponse<TextInputResponse>> => {
  try {
    const response = await fetch(toApiUrl('/api/text/input/stream'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.sessionToken}`,
      },
      body: JSON.stringify({
        sessionId: params.sessionId,
        text: params.text,
        requestId: params.requestId,
      }),
    });

    if (!response.ok) {
      return parseResponse(response, textInputEnvelopeSchema);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/event-stream')) {
      return parseResponse(response, textInputEnvelopeSchema);
    }

    return parseSsePayload<TextInputResponse>(response, {
      onStart: () => params.onStart(),
      onDelta: (delta) => params.onDelta(delta),
    });
  } catch {
    return networkError('网络不可用，请稍后重试');
  }
};

export const sendVoiceMessage = async (params: {
  sessionId: string;
  sessionToken: string;
  requestId: string;
  blob: Blob;
  mimeType: string;
  language: string;
}): Promise<ApiResponse<VoiceInputResponse>> => {
  const formData = new FormData();
  formData.set('sessionId', params.sessionId);
  formData.set('requestId', params.requestId);
  formData.set('mimeType', params.mimeType);
  formData.set('language', params.language);
  formData.set('audio', params.blob, 'voice-input.webm');

  return safeRequest(
    async () =>
      fetch(toApiUrl('/api/voice/input'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.sessionToken}`,
        },
        body: formData,
      }),
    voiceInputEnvelopeSchema,
  );
};
