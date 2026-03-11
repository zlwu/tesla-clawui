import { z } from 'zod';

export const appStatusSchema = z.enum([
  'idle',
  'recording',
  'uploading',
  'transcribing',
  'thinking',
  'error',
]);

export const messageRoleSchema = z.enum(['user', 'assistant', 'system']);
export const messageSourceSchema = z.enum(['text', 'voice_asr', 'llm', 'system']);
export const appErrorCodeSchema = z.enum([
  'AUTH_REQUIRED',
  'AUTH_INVALID_PIN',
  'SESSION_NOT_FOUND',
  'SESSION_EXPIRED',
  'SESSION_UNAUTHORIZED',
  'INVALID_REQUEST',
  'VALIDATION_FAILED',
  'UNSUPPORTED_MEDIA_TYPE',
  'REQUEST_CONFLICT',
  'MIC_REQUIRED',
  'AUDIO_UPLOAD_FAILED',
  'AUDIO_FILE_INVALID',
  'ASR_FAILED',
  'ASR_TIMEOUT',
  'LLM_FAILED',
  'LLM_TIMEOUT',
  'CONTEXT_BUILD_FAILED',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
  'TTS_FAILED',
  'TTS_TIMEOUT',
]);

export const deviceSchema = z.object({
  type: z.literal('tesla-browser'),
  label: z.string().trim().min(1).max(64).optional(),
});

export const sessionSchema = z.object({
  sessionId: z.string(),
  status: appStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const messageSchema = z.object({
  messageId: z.string(),
  sessionId: z.string(),
  role: messageRoleSchema,
  content: z.string(),
  source: messageSourceSchema,
  createdAt: z.string().datetime(),
});

export const appErrorSchema = z.object({
  code: appErrorCodeSchema,
  message: z.string(),
  retryable: z.boolean(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export const createSessionRequestSchema = z.object({
  device: deviceSchema,
});

export const createSessionResponseSchema = z.object({
  session: sessionSchema,
  sessionToken: z.string(),
});

export const authConfigResponseSchema = z.object({
  enabled: z.boolean(),
  pinLength: z.number().int().min(4).max(12),
  sessionDays: z.number().int().positive(),
});

export const unlockRequestSchema = z.object({
  pin: z.string().trim().regex(/^\d{6}$/),
});

export const unlockResponseSchema = z.object({
  authToken: z.string(),
  expiresAt: z.string().datetime(),
});

export const textInputRequestSchema = z.object({
  sessionId: z.string(),
  text: z.string().trim().min(1).max(4000),
  requestId: z.string().trim().min(1).max(128),
});

export const textInputResponseSchema = z.object({
  requestId: z.string(),
  sessionId: z.string(),
  userMessage: messageSchema,
  assistantMessage: messageSchema,
  status: appStatusSchema,
});

export const messagesQuerySchema = z.object({
  sessionId: z.string(),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export const messagesResponseSchema = z.object({
  sessionId: z.string(),
  messages: z.array(messageSchema),
});

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
});

export const apiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    ok: z.literal(true),
    data: dataSchema,
  });

export const apiErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: appErrorSchema,
});
