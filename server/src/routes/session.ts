import type { FastifyPluginCallback } from 'fastify';

import {
  clearSessionContextRequestSchema,
  createSessionRequestSchema,
} from '@tesla-openclaw/shared';

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

export const sessionRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.post('/api/session/create', async (request, reply) => {
    const body = createSessionRequestSchema.parse(request.body);
    reply.header('x-request-id', request.id);
    const result = await app.services.sessionService.create(body.device.label);

    return {
      ok: true as const,
      data: result,
    };
  });

  app.post('/api/session/clear', async (request, reply) => {
    const body = clearSessionContextRequestSchema.parse(request.body);
    const token = getBearerToken(request.headers.authorization);
    reply.header('x-request-id', request.id);
    const session = await app.services.sessionService.acquireAuthorizedBusySession(body.sessionId, token);

    try {
      if (app.services.requestLogService.hasInFlightSession(body.sessionId)) {
        throw new AppException(409, {
          code: 'REQUEST_CONFLICT',
          message: '当前回复尚未完成，请等待后再清除上下文',
          retryable: true,
        });
      }

      if (session.openclawSessionKey) {
        await app.services.llmService.resetSession({
          sessionId: body.sessionId,
          upstreamSessionKey: session.openclawSessionKey,
        });
      }

      await app.services.messageService.clearSession(body.sessionId);
      await app.services.requestLogService.clearSession(body.sessionId);
      await app.services.sessionService.touch(body.sessionId, 'idle');

      return {
        ok: true as const,
        data: {
          sessionId: body.sessionId,
          cleared: true as const,
        },
      };
    } catch (error) {
      await app.services.sessionService.touch(body.sessionId, 'idle');
      throw error;
    }
  });

  done();
};
