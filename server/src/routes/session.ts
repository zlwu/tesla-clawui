import type { FastifyPluginCallback } from 'fastify';

import { createSessionRequestSchema } from '@tesla-openclaw/shared';

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

  done();
};
