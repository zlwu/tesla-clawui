import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import type { AppConfig } from '../../lib/config.js';
import { AppException } from '../../lib/errors.js';
import type { AsrProvider, AsrTranscribeInput, AsrTranscribeResult } from './provider.js';

export class OpenAiCompatibleAsrProvider implements AsrProvider {
  public constructor(private readonly config: AppConfig) {}

  public async transcribe(input: AsrTranscribeInput): Promise<AsrTranscribeResult> {
    if (!this.config.asrBaseUrl || !this.config.asrApiKey) {
      throw new AppException(500, {
        code: 'ASR_FAILED',
        message: '缺少 ASR 配置',
        retryable: false,
      });
    }

    const fileBuffer = await readFile(input.filePath);
    const blob = new Blob([fileBuffer], { type: input.mimeType });
    const formData = new FormData();
    formData.set('file', blob, basename(input.filePath));
    formData.set('model', this.config.asrModel);
    formData.set('language', input.language);

    const response = await fetch(this.config.asrBaseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.asrApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new AppException(502, {
        code: 'ASR_FAILED',
        message: 'ASR 服务调用失败',
        retryable: true,
        details: { status: response.status },
      });
    }

    const payload = (await response.json()) as { text?: string };
    const transcript = payload.text?.trim();
    if (!transcript) {
      throw new AppException(502, {
        code: 'ASR_FAILED',
        message: 'ASR 返回为空',
        retryable: true,
      });
    }

    return { transcript };
  }
}
