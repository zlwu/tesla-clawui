import type { FastifyPluginCallback } from 'fastify';

import { textInputRequestSchema } from '@tesla-openclaw/shared';

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

export const textRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.post('/api/text/input', async (request, reply) => {
    const body = textInputRequestSchema.parse(request.body);
    const token = getBearerToken(request.headers.authorization);
    reply.header('x-request-id', request.id);
    const result = await app.services.textService.handleInput({
      sessionId: body.sessionId,
      token,
      text: body.text,
      requestId: body.requestId,
      logger: request.log.child({
        apiRequestId: request.id,
        sessionId: body.sessionId,
        requestId: body.requestId,
      }),
    });

    return {
      ok: true as const,
      data: result,
    };
  });

  done();
};
