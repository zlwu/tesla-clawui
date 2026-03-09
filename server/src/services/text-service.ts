import type { FastifyBaseLogger } from 'fastify';
import type { TextInputResponse } from '@tesla-openclaw/shared';

import { AppException } from '../lib/errors.js';
import { logStepFailure, logStepSuccess } from '../lib/observability.js';
import type { LlmService } from './llm-service.js';
import type { MessageService } from './message-service.js';
import type { RequestLogService } from './request-log-service.js';
import type { SessionService } from './session-service.js';

export class TextService {
  public constructor(
    private readonly sessionService: SessionService,
    private readonly messageService: MessageService,
    private readonly requestLogService: RequestLogService,
    private readonly llmService: LlmService,
  ) {}

  public async handleInput(params: {
    sessionId: string;
    token: string;
    text: string;
    requestId: string;
    logger?: FastifyBaseLogger | undefined;
  }): Promise<TextInputResponse> {
    const startedAt = Date.now();
    await this.sessionService.getAuthorizedSession(params.sessionId, params.token);

    const existing = await this.requestLogService.get<TextInputResponse>(params.requestId);
    if (existing) {
      params.logger?.info(
        { sessionId: params.sessionId, requestId: params.requestId },
        'text.idempotency.hit',
      );
      return existing;
    }

    if (this.requestLogService.hasInFlight(params.requestId)) {
      params.logger?.info(
        { sessionId: params.sessionId, requestId: params.requestId },
        'text.idempotency.joined',
      );
    }

    return this.requestLogService.runOnce(params.requestId, async () => {
      const trimmed = params.text.trim();
      if (!trimmed) {
        throw new AppException(400, {
          code: 'VALIDATION_FAILED',
          message: '文本不能为空',
          retryable: false,
        });
      }

      try {
        await this.sessionService.touch(params.sessionId, 'thinking');

        const history = await this.messageService.listHistory(params.sessionId, 12);
        const userMessage = await this.messageService.create({
          sessionId: params.sessionId,
          role: 'user',
          content: trimmed,
          source: 'text',
          requestId: params.requestId,
        });

        const replyText = await this.llmService.generateReply({
          sessionId: params.sessionId,
          requestId: params.requestId,
          text: trimmed,
          history,
          logger: params.logger,
        });

        const assistantMessage = await this.messageService.create({
          sessionId: params.sessionId,
          role: 'assistant',
          content: replyText,
          source: 'llm',
          requestId: params.requestId,
        });

        await this.sessionService.touch(params.sessionId, 'idle');

        const response: TextInputResponse = {
          requestId: params.requestId,
          sessionId: params.sessionId,
          userMessage,
          assistantMessage,
          status: 'idle',
        };

        await this.requestLogService.save(params.requestId, params.sessionId, 'text', response);
        logStepSuccess({
          logger: params.logger,
          event: 'text.completed',
          startedAt,
          context: {
            sessionId: params.sessionId,
            requestId: params.requestId,
          },
        });

        return response;
      } catch (error) {
        await this.sessionService.touch(params.sessionId, 'idle');
        logStepFailure({
          logger: params.logger,
          event: 'text.failed',
          startedAt,
          error,
          context: {
            sessionId: params.sessionId,
            requestId: params.requestId,
          },
        });
        throw error;
      }
    });
  }
}
