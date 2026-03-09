import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDb } from './db/client.js';
import { loadConfig } from './lib/config.js';
import { AppException, toErrorResponse } from './lib/errors.js';
import { createLoggerOptions } from './lib/logger.js';
import { healthRoutes } from './routes/health.js';
import { messagesRoutes } from './routes/messages.js';
import { sessionRoutes } from './routes/session.js';
import { textRoutes } from './routes/text.js';
import { voiceRoutes } from './routes/voice.js';
import { AsrService } from './services/asr-service.js';
import { AudioFileService } from './services/audio-file-service.js';
import { LlmService } from './services/llm-service.js';
import { MessageService } from './services/message-service.js';
import { RequestLogService } from './services/request-log-service.js';
import { SessionService } from './services/session-service.js';
import { TextService } from './services/text-service.js';
import { VoiceService } from './services/voice-service.js';

declare module 'fastify' {
  interface FastifyInstance {
    services: {
      sessionService: SessionService;
      messageService: MessageService;
      textService: TextService;
      voiceService: VoiceService;
    };
  }
}

const hasIssues = (error: unknown): error is { issues: unknown } =>
  typeof error === 'object' && error !== null && 'issues' in error;

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(currentDir, '../..');
const webDistDir = resolve(workspaceRoot, 'web/dist');

export const createApp = () => {
  const config = loadConfig();
  const { db, sqlite } = createDb();

  const sessionService = new SessionService(db, config);
  const messageService = new MessageService(db);
  const requestLogService = new RequestLogService(db);
  const audioFileService = new AudioFileService(db, config);
  const asrService = new AsrService(config);
  const llmService = new LlmService(config);
  const textService = new TextService(
    sessionService,
    messageService,
    requestLogService,
    llmService,
  );
  const voiceService = new VoiceService(
    sessionService,
    messageService,
    requestLogService,
    audioFileService,
    asrService,
    llmService,
  );

  const app = Fastify({ logger: createLoggerOptions() });
  app.decorate('services', {
    sessionService,
    messageService,
    textService,
    voiceService,
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  app.addHook('onClose', () => {
    sqlite.close();
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppException) {
      request.log.warn({ err: error, errorCode: error.payload.code }, 'request.failed');
      reply.status(error.statusCode).send(toErrorResponse(error.payload));
      return;
    }

    if (hasIssues(error)) {
      request.log.warn({ err: error }, 'request.validation_failed');
      reply.status(400).send(
        toErrorResponse({
          code: 'VALIDATION_FAILED',
          message: '请求参数不合法',
          retryable: false,
          details: { issues: error.issues },
        }),
      );
      return;
    }

    request.log.error({ err: error }, 'request.internal_error');
    reply.status(500).send(
      toErrorResponse({
        code: 'INTERNAL_ERROR',
        message: '服务内部错误',
        retryable: true,
      }),
    );
  });

  void app.register(cors, { origin: true });
  void app.register(multipart, {
    limits: {
      files: 1,
      fileSize: 10 * 1024 * 1024,
    },
  });
  void app.register(fastifyStatic, {
    root: webDistDir,
    prefix: '/',
    decorateReply: false,
  });
  void app.register(healthRoutes);
  void app.register(sessionRoutes);
  void app.register(textRoutes);
  void app.register(voiceRoutes);
  void app.register(messagesRoutes);
  app.setNotFoundHandler(async (request, reply) => {
    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      !request.url.startsWith('/api/')
    ) {
      await reply.sendFile('index.html');
      return;
    }

    reply.status(404).send({
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: '资源不存在',
        retryable: false,
      },
    });
  });

  return { app, config };
};
