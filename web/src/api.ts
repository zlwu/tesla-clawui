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
