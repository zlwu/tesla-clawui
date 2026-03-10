import type { FastifyBaseLogger } from 'fastify';
import type { Message } from '@tesla-openclaw/shared';

import type { AppConfig } from '../lib/config.js';
import { logStepFailure, logStepSuccess } from '../lib/observability.js';
import { MockLlmProvider } from '../providers/llm/mock-provider.js';
import { OpenClawProvider } from '../providers/llm/openclaw-provider.js';
import { OpenAiCompatibleProvider } from '../providers/llm/openai-compatible-provider.js';
import type { LlmProvider } from '../providers/llm/provider.js';

export class LlmService {
  private readonly provider: LlmProvider;

  public constructor(config: AppConfig) {
    this.provider =
      config.llmProvider === 'openclaw'
        ? new OpenClawProvider(config)
        : config.llmProvider === 'openai-compatible'
          ? new OpenAiCompatibleProvider(config)
          : new MockLlmProvider();
  }

  public async generateReply(params: {
    sessionId: string;
    requestId: string;
    text: string;
    history: Message[];
    logger?: FastifyBaseLogger | undefined;
  }): Promise<string> {
    const startedAt = Date.now();

    try {
      const reply = await this.provider.generateReply({
        sessionId: params.sessionId,
        requestId: params.requestId,
        text: params.text,
        history: params.history.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      });

      logStepSuccess({
        logger: params.logger,
        event: 'llm.completed',
        startedAt,
        context: {
          sessionId: params.sessionId,
          requestId: params.requestId,
          historyCount: params.history.length,
        },
      });

      return reply;
    } catch (error) {
      logStepFailure({
        logger: params.logger,
        event: 'llm.failed',
        startedAt,
        error,
        context: {
          sessionId: params.sessionId,
          requestId: params.requestId,
          historyCount: params.history.length,
        },
      });
      throw error;
    }
  }
}
