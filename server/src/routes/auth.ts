import type { FastifyPluginCallback } from 'fastify';

import { unlockRequestSchema } from '@tesla-openclaw/shared';

export const authRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/api/auth/config', () => ({
    ok: true as const,
    data: app.services.authService.getClientConfig(),
  }));

  app.post('/api/auth/unlock', async (request, reply) => {
    const body = unlockRequestSchema.parse(request.body);
    reply.header('x-request-id', request.id);

    return {
      ok: true as const,
      data: app.services.authService.unlock(body.pin),
    };
  });

  done();
};
