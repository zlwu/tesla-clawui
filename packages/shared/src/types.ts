import type { z } from 'zod';

import type {
  appErrorSchema,
  appErrorCodeSchema,
  appStatusSchema,
  createSessionRequestSchema,
  createSessionResponseSchema,
  healthResponseSchema,
  messageRoleSchema,
  messageSchema,
  messageSourceSchema,
  messagesQuerySchema,
  messagesResponseSchema,
  sessionSchema,
  textInputRequestSchema,
  textInputResponseSchema,
  voiceInputFieldsSchema,
  voiceInputResponseSchema,
} from './schemas.js';

export type AppStatus = z.infer<typeof appStatusSchema>;
export type AppErrorCode = z.infer<typeof appErrorCodeSchema>;
export type MessageRole = z.infer<typeof messageRoleSchema>;
export type MessageSource = z.infer<typeof messageSourceSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Message = z.infer<typeof messageSchema>;
export type AppError = z.infer<typeof appErrorSchema>;
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;
export type CreateSessionResponse = z.infer<typeof createSessionResponseSchema>;
export type TextInputRequest = z.infer<typeof textInputRequestSchema>;
export type TextInputResponse = z.infer<typeof textInputResponseSchema>;
export type VoiceInputFields = z.infer<typeof voiceInputFieldsSchema>;
export type VoiceInputResponse = z.infer<typeof voiceInputResponseSchema>;
export type MessagesQuery = z.infer<typeof messagesQuerySchema>;
export type MessagesResponse = z.infer<typeof messagesResponseSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: AppError;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
