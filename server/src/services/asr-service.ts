import type { FastifyBaseLogger } from 'fastify';

import type { AppConfig } from '../lib/config.js';
import { MockAsrProvider } from '../providers/asr/mock-provider.js';
import { OpenAiCompatibleAsrProvider } from '../providers/asr/openai-compatible-provider.js';
import { QwenAsrProvider } from '../providers/asr/qwen-asr-provider.js';
import type { AsrProvider } from '../providers/asr/provider.js';
import { logStepFailure, logStepSuccess } from '../lib/observability.js';

export class AsrService {
  private readonly provider: AsrProvider;

  public constructor(config: AppConfig) {
    this.provider =
      config.asrProvider === 'openai-compatible'
        ? new OpenAiCompatibleAsrProvider(config)
        : config.asrProvider === 'qwen'
          ? new QwenAsrProvider(config)
          : new MockAsrProvider();
  }

  public async transcribe(params: {
    filePath: string;
    mimeType: string;
    language: string;
    sizeBytes: number;
    logger?: FastifyBaseLogger | undefined;
    sessionId: string;
    requestId: string;
  }): Promise<string> {
    const startedAt = Date.now();

    try {
      const result = await this.provider.transcribe(params);
      logStepSuccess({
        logger: params.logger,
        event: 'asr.completed',
        startedAt,
        context: {
          sessionId: params.sessionId,
          requestId: params.requestId,
          sizeBytes: params.sizeBytes,
        },
      });
      return result.transcript;
    } catch (error) {
      logStepFailure({
        logger: params.logger,
        event: 'asr.failed',
        startedAt,
        error,
        context: {
          sessionId: params.sessionId,
          requestId: params.requestId,
          sizeBytes: params.sizeBytes,
        },
      });
      throw error;
    }
  }
}
