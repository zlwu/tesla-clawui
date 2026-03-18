import { AppException } from '../../lib/errors.js';
import type { AppConfig } from '../../lib/config.js';
import type { LlmGenerateInput, LlmProvider, LlmStreamCallbacks, LlmStreamResult } from './provider.js';
import type { OpenClawGatewayAuthStore } from './openclaw-gateway-auth-store.js';
import { OpenClawGatewayClient } from './openclaw-gateway-client.js';

export class OpenClawProvider implements LlmProvider {
  private readonly client: OpenClawGatewayClient;

  public constructor(
    private readonly config: AppConfig,
    authStore: OpenClawGatewayAuthStore,
  ) {
    this.client = new OpenClawGatewayClient(config, authStore);
  }

  public async generateReply(input: LlmGenerateInput): Promise<string> {
    if (!this.config.llmBaseUrl || !this.config.llmApiKey) {
      throw new AppException(500, {
        code: 'LLM_FAILED',
        message: '缺少 OpenClaw 配置',
        retryable: false,
      });
    }

    const result = await this.client.sendChat({
      requestId: input.requestId,
      sessionKey: this.requireUpstreamSessionKey(input),
      text: input.text,
      callbacks: {
        onDelta: () => {},
      },
    });

    return result.replyText;
  }

  public async generateReplyStream(
    input: LlmGenerateInput,
    callbacks: LlmStreamCallbacks,
  ): Promise<LlmStreamResult> {
    if (!this.config.llmBaseUrl || !this.config.llmApiKey) {
      throw new AppException(500, {
        code: 'LLM_FAILED',
        message: '缺少 OpenClaw 配置',
        retryable: false,
      });
    }

    return this.client.sendChat({
      requestId: input.requestId,
      sessionKey: this.requireUpstreamSessionKey(input),
      text: input.text,
      callbacks,
    });
  }

  public async resetSession(input: {
    sessionId: string;
    upstreamSessionKey?: string;
  }): Promise<void> {
    const sessionKey = input.upstreamSessionKey ?? this.client.resolveSessionKey(input.sessionId);
    await this.client.resetSession(sessionKey);
  }

  private requireUpstreamSessionKey(input: LlmGenerateInput): string {
    if (!input.upstreamSessionKey) {
      throw new AppException(500, {
        code: 'LLM_FAILED',
        message: '缺少 OpenClaw 上游会话映射',
        retryable: false,
        details: { sessionId: input.sessionId },
      });
    }

    return input.upstreamSessionKey;
  }
}
