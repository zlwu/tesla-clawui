import type { FastifyPluginCallback } from 'fastify';

export const healthRoutes: FastifyPluginCallback = (app, _opts, done) => {
  app.get('/api/health', () => ({
    ok: true as const,
    data: {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
    },
  }));

  done();
};
