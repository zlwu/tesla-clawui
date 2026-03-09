import { AppException } from '../../lib/errors.js';
import type { AppConfig } from '../../lib/config.js';
import type { LlmGenerateInput, LlmProvider } from './provider.js';

const systemPrompt = '你是 Tesla 车机里的 OpenClaw 助手。回答简洁、清晰、适合大字文本显示。';

export class OpenAiCompatibleProvider implements LlmProvider {
  public constructor(private readonly config: AppConfig) {}

  public async generateReply(input: LlmGenerateInput): Promise<string> {
    if (!this.config.llmBaseUrl || !this.config.llmApiKey) {
      throw new AppException(500, {
        code: 'LLM_FAILED',
        message: '缺少 LLM 配置',
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
        model: this.config.llmModel,
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
        message: 'LLM 服务调用失败',
        retryable: true,
        details: { status: response.status },
      });
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new AppException(502, {
        code: 'LLM_FAILED',
        message: 'LLM 返回为空',
        retryable: true,
      });
    }

    return content;
  }
}
