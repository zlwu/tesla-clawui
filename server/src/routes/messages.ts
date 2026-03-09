import type { FastifyPluginCallback } from 'fastify';

import { messagesQuerySchema } from '@tesla-openclaw/shared';

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

export const messagesRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/api/messages', async (request, reply) => {
    const query = messagesQuerySchema.parse(request.query);
    const token = getBearerToken(request.headers.authorization);
    reply.header('x-request-id', request.id);
    await app.services.sessionService.getAuthorizedSession(query.sessionId, token);

    const messages = await app.services.messageService.listRecent(query.sessionId, query.limit);

    return {
      ok: true as const,
      data: {
        sessionId: query.sessionId,
        messages,
      },
    };
  });

  done();
};
