import type { FastifyBaseLogger } from 'fastify';

const durationMs = (startedAt: number): number => Date.now() - startedAt;

export const logStepSuccess = (params: {
  logger?: FastifyBaseLogger | undefined;
  event: string;
  startedAt: number;
  context?: Record<string, unknown>;
}): void => {
  params.logger?.info(
    {
      durationMs: durationMs(params.startedAt),
      ...params.context,
    },
    params.event,
  );
};

export const logStepFailure = (params: {
  logger?: FastifyBaseLogger | undefined;
  event: string;
  startedAt: number;
  error: unknown;
  context?: Record<string, unknown>;
}): void => {
  params.logger?.error(
    {
      durationMs: durationMs(params.startedAt),
      err: params.error,
      ...params.context,
    },
    params.event,
  );
};
