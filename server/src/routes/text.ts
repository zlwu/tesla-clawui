import type { FastifyPluginCallback } from 'fastify';

import { textInputRequestSchema } from '@tesla-openclaw/shared';

import { AppException } from '../lib/errors.js';

const writeSseEvent = (reply: { raw: NodeJS.WritableStream }, event: string, data: unknown): void => {
  reply.raw.write(`event: ${event}\n`);
  reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
};

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

  app.post('/api/text/input/stream', async (request, reply) => {
    const body = textInputRequestSchema.parse(request.body);
    const token = getBearerToken(request.headers.authorization);

    reply.hijack();
    reply.raw.setHeader('content-type', 'text/event-stream; charset=utf-8');
    reply.raw.setHeader('cache-control', 'no-cache, no-transform');
    reply.raw.setHeader('connection', 'keep-alive');
    reply.raw.setHeader('x-request-id', request.id);

    try {
      await app.services.textService.handleInputStream({
        sessionId: body.sessionId,
        token,
        text: body.text,
        requestId: body.requestId,
        logger: request.log.child({
          apiRequestId: request.id,
          sessionId: body.sessionId,
          requestId: body.requestId,
        }),
        onStart: () => {
          writeSseEvent(reply, 'start', {
            sessionId: body.sessionId,
            requestId: body.requestId,
          });
        },
        onDelta: (delta) => {
          writeSseEvent(reply, 'delta', { delta });
        },
        onDone: (response) => {
          writeSseEvent(reply, 'done', response);
        },
      });
    } catch (error) {
      const appError =
        error instanceof AppException
          ? error.payload
          : {
            code: 'INTERNAL_ERROR',
            message: '服务内部错误',
            retryable: true,
          };
      writeSseEvent(reply, 'error', {
        ok: false,
        error: appError,
      });
    } finally {
      reply.raw.end();
    }
  });

  done();
};
