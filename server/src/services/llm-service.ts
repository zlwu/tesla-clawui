import type { FastifyBaseLogger } from 'fastify';
import type { Message } from '@tesla-openclaw/shared';

import type { DatabaseClient } from '../db/client.js';
import type { AppConfig } from '../lib/config.js';
import { logStepFailure, logStepSuccess } from '../lib/observability.js';
import { MockLlmProvider } from '../providers/llm/mock-provider.js';
import { SqliteOpenClawGatewayAuthStore } from '../providers/llm/openclaw-gateway-auth-store.js';
import { OpenClawProvider } from '../providers/llm/openclaw-provider.js';
import { OpenAiCompatibleProvider } from '../providers/llm/openai-compatible-provider.js';
import type { LlmProvider, LlmStreamResult } from '../providers/llm/provider.js';

export class LlmService {
  private readonly provider: LlmProvider;
  private readonly providerName: AppConfig['llmProvider'];

  public constructor(config: AppConfig, db: DatabaseClient) {
    this.providerName = config.llmProvider;
    this.provider =
      config.llmProvider === 'openclaw'
        ? new OpenClawProvider(config, new SqliteOpenClawGatewayAuthStore(db))
        : config.llmProvider === 'openai-compatible'
          ? new OpenAiCompatibleProvider(config)
          : new MockLlmProvider();
  }

  public async generateReply(params: {
    sessionId: string;
    requestId: string;
    text: string;
    history: Message[];
    upstreamSessionKey?: string;
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
        ...(params.upstreamSessionKey ? { upstreamSessionKey: params.upstreamSessionKey } : {}),
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

  public async generateReplyStream(params: {
    sessionId: string;
    requestId: string;
    text: string;
    history: Message[];
    upstreamSessionKey?: string;
    onDelta(delta: string): Promise<void> | void;
    logger?: FastifyBaseLogger | undefined;
  }): Promise<LlmStreamResult> {
    const startedAt = Date.now();

    try {
      const streamResult = await this.provider.generateReplyStream(
        {
          sessionId: params.sessionId,
          requestId: params.requestId,
          text: params.text,
          history: params.history.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          ...(params.upstreamSessionKey ? { upstreamSessionKey: params.upstreamSessionKey } : {}),
        },
        { onDelta: (delta) => params.onDelta(delta) },
      );

      logStepSuccess({
        logger: params.logger,
        event: 'llm.completed',
        startedAt,
        context: {
          sessionId: params.sessionId,
          requestId: params.requestId,
          historyCount: params.history.length,
          mode: 'stream',
          provider: this.providerName,
          completionMarkerObserved: streamResult.diagnostics.completionMarkerObserved,
          finishReason: streamResult.diagnostics.finishReason,
          deltaCount: streamResult.diagnostics.deltaCount,
          characterCount: streamResult.diagnostics.characterCount,
          terminationReason: streamResult.diagnostics.terminationReason,
          streamOutcome: 'success',
        },
      });

      return streamResult;
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
          mode: 'stream',
          provider: this.providerName,
          streamOutcome: 'error',
        },
      });
      throw error;
    }
  }

  public async resetSession(params: {
    sessionId: string;
    upstreamSessionKey?: string;
  }): Promise<void> {
    await this.provider.resetSession({
      sessionId: params.sessionId,
      ...(params.upstreamSessionKey ? { upstreamSessionKey: params.upstreamSessionKey } : {}),
    });
  }
}
