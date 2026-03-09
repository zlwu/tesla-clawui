import type { Multipart, MultipartFile } from '@fastify/multipart';
import type { FastifyPluginCallback } from 'fastify';

import { voiceInputFieldsSchema } from '@tesla-openclaw/shared';

import { AppException } from '../lib/errors.js';

const getBearerToken = (authorizationHeader?: string): string => {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    throw new AppException(401, {
      code: 'SESSION_UNAUTHORIZED',
      message: '缺少 session token',
      retryable: false,
    });
  }

  return authorizationHeader.slice('Bearer '.length).trim();
};

const readFieldValue = (part?: Multipart | Multipart[]): string | undefined => {
  if (!part) {
    return undefined;
  }

  if (Array.isArray(part)) {
    return readFieldValue(part[0]);
  }

  if (part.type !== 'field') {
    return undefined;
  }

  return String(part.value);
};

const collectVoicePayload = async (audioFile: MultipartFile) => {
  const parsedFields = voiceInputFieldsSchema.parse({
    sessionId: readFieldValue(audioFile.fields.sessionId),
    requestId: readFieldValue(audioFile.fields.requestId),
    mimeType: readFieldValue(audioFile.fields.mimeType),
    language: readFieldValue(audioFile.fields.language),
  });

  const audioBuffer = await audioFile.toBuffer();
  const mimeType = parsedFields.mimeType ?? audioFile.mimetype;

  return {
    fields: parsedFields,
    audioBuffer,
    filename: audioFile.filename,
    mimeType,
  };
};

export const voiceRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.post('/api/voice/input', async (request, reply) => {
    const token = getBearerToken(request.headers.authorization);
    const audioFile = await request.file();

    if (!audioFile || audioFile.fieldname !== 'audio') {
      throw new AppException(400, {
        code: 'AUDIO_FILE_INVALID',
        message: '缺少音频文件',
        retryable: false,
      });
    }

    const uploadStartedAt = Date.now();
    const payload = await collectVoicePayload(audioFile);
    reply.header('x-request-id', request.id);
    const logger = request.log.child({
      apiRequestId: request.id,
      sessionId: payload.fields.sessionId,
      requestId: payload.fields.requestId,
    });
    const result = await app.services.voiceService.handleInput({
      sessionId: payload.fields.sessionId,
      token,
      requestId: payload.fields.requestId,
      audioBuffer: payload.audioBuffer,
      mimeType: payload.mimeType,
      language: payload.fields.language,
      uploadDurationMs: Date.now() - uploadStartedAt,
      logger,
      ...(payload.filename ? { filename: payload.filename } : {}),
    });

    return {
      ok: true as const,
      data: result,
    };
  });

  done();
};
