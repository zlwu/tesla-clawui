import { readFile } from 'node:fs/promises';

import type { AppConfig } from '../../lib/config.js';
import { AppException } from '../../lib/errors.js';
import type { AsrProvider, AsrTranscribeInput, AsrTranscribeResult } from './provider.js';

const toDashScopeLanguage = (language: string): string | undefined => {
  const normalized = language.trim().toLowerCase();

  if (normalized.startsWith('zh')) {
    return 'zh';
  }

  if (normalized.startsWith('yue')) {
    return 'yue';
  }

  if (normalized.startsWith('en')) {
    return 'en';
  }

  if (normalized.startsWith('ja')) {
    return 'ja';
  }

  if (normalized.startsWith('ko')) {
    return 'ko';
  }

  return undefined;
};

const toDataUrl = (buffer: Buffer, mimeType: string): string =>
  `data:${mimeType};base64,${buffer.toString('base64')}`;

type QwenAsrResponse = {
  output?: {
    choices?: Array<{
      message?: {
        content?: Array<{
          text?: string;
        }>;
      };
    }>;
  };
  request_id?: string;
};

export class QwenAsrProvider implements AsrProvider {
  public constructor(private readonly config: AppConfig) {}

  public async transcribe(input: AsrTranscribeInput): Promise<AsrTranscribeResult> {
    if (!this.config.asrBaseUrl || !this.config.asrApiKey) {
      throw new AppException(500, {
        code: 'ASR_FAILED',
        message: '缺少 Qwen ASR 配置',
        retryable: false,
      });
    }

    const fileBuffer = await readFile(input.filePath);
    const language = toDashScopeLanguage(input.language);
    const payload = {
      model: this.config.asrModel,
      input: {
        messages: [
          {
            role: 'user',
            content: [
              {
                audio: toDataUrl(fileBuffer, input.mimeType),
              },
            ],
          },
        ],
      },
      parameters: {
        asr_options: {
          enable_itn: false,
          ...(language ? { language } : {}),
        },
      },
    };

    const response = await fetch(this.config.asrBaseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.asrApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new AppException(502, {
        code: 'ASR_FAILED',
        message: 'Qwen ASR 服务调用失败',
        retryable: true,
        details: {
          status: response.status,
        },
      });
    }

    const result = (await response.json()) as QwenAsrResponse;
    const transcript = result.output?.choices?.[0]?.message?.content?.[0]?.text?.trim();

    if (!transcript) {
      throw new AppException(502, {
        code: 'ASR_FAILED',
        message: 'Qwen ASR 返回为空',
        retryable: true,
        ...(result.request_id
          ? {
              details: {
                requestId: result.request_id,
              },
            }
          : {}),
      });
    }

    return { transcript };
  }
}
