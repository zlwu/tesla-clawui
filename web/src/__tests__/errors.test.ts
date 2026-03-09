import { describe, expect, it } from 'vitest';

import { toDisplayErrorMessage } from '../errors.js';

describe('error messages', () => {
  it('maps retryable network failures to offline copy when disconnected', () => {
    const message = toDisplayErrorMessage(
      {
        code: 'SERVICE_UNAVAILABLE',
        message: '网络不可用',
        retryable: true,
      },
      false,
    );

    expect(message).toContain('网络离线');
  });

  it('maps known error codes to stable copy', () => {
    const message = toDisplayErrorMessage(
      {
        code: 'ASR_FAILED',
        message: '识别失败',
        retryable: true,
      },
      true,
    );

    expect(message).toBe('语音识别失败，请重试。');
  });
});
