import { AppException } from '../../lib/errors.js';
import type { AppConfig } from '../../lib/config.js';
import { readOpenAiCompatibleStream } from './openai-stream.js';
import type { LlmGenerateInput, LlmProvider, LlmStreamCallbacks, LlmStreamResult } from './provider.js';

const systemPrompt = '你是 Tesla 车机里的 OpenClaw 助手。回答简洁、清晰、适合大字文本显示。';

type OpenAiCompatibleResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

export class OpenClawProvider implements LlmProvider {
  public constructor(private readonly config: AppConfig) {}

  public async generateReply(input: LlmGenerateInput): Promise<string> {
    if (!this.config.llmBaseUrl || !this.config.llmApiKey) {
      throw new AppException(500, {
        code: 'LLM_FAILED',
        message: '缺少 OpenClaw 配置',
        retryable: false,
      });
    }

    const headers: HeadersInit = {
      Authorization: `Bearer ${this.config.llmApiKey}`,
      'Content-Type': 'application/json',
    };
    const model = this.resolveModel();

    const response = await fetch(this.config.llmBaseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        user: input.sessionId,
        messages: [
          { role: 'system', content: systemPrompt },
          ...input.history,
          { role: 'user', content: input.text },
        ],
      }),
    });

    if (!response.ok) {
      throw new AppException(502, {
        code: 'LLM_FAILED',
        message: 'OpenClaw 服务调用失败',
        retryable: true,
        details: { status: response.status },
      });
    }

    const payload = (await response.json()) as OpenAiCompatibleResponse;
    const content = payload.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new AppException(502, {
        code: 'LLM_FAILED',
        message: 'OpenClaw 返回为空',
        retryable: true,
      });
    }

    return content;
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

    const response = await fetch(this.config.llmBaseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.llmApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.resolveModel(),
        user: input.sessionId,
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          ...input.history,
          { role: 'user', content: input.text },
        ],
      }),
    });

    if (!response.ok) {
      throw new AppException(502, {
        code: 'LLM_FAILED',
        message: 'OpenClaw 服务调用失败',
        retryable: true,
        details: { status: response.status },
      });
    }

    return readOpenAiCompatibleStream({
      provider: 'openclaw',
      response,
      onDelta: (delta) => callbacks.onDelta(delta),
      emptyMessage: 'OpenClaw 返回为空',
    });
  }

  private resolveModel(): string {
    if (!this.config.openclawAgentId) {
      return this.config.llmModel;
    }

    if (this.config.llmModel.includes(':')) {
      return this.config.llmModel;
    }

    return `${this.config.llmModel}:${this.config.openclawAgentId}`;
  }
}
