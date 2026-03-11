import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import type { AppConfig } from '../lib/config.js';
import { QwenAsrProvider } from '../providers/asr/qwen-asr-provider.js';

const createConfig = (): AppConfig => ({
  port: 3000,
  host: '0.0.0.0',
  databaseUrl: '/tmp/openclaw-test.db',
  uploadDir: '/tmp',
  sessionTokenBytes: 24,
  authEnabled: false,
  authSessionDays: 90,
  messageLimitDefault: 8,
  messageLimitMax: 20,
  llmProvider: 'mock',
  llmModel: 'openai/gpt-4o-mini',
  asrProvider: 'qwen',
  asrBaseUrl: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
  asrApiKey: 'test-key',
  asrModel: 'qwen3-asr-flash',
});

describe('QwenAsrProvider', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'qwen-asr-provider-'));
  const audioPath = join(tempDir, 'sample.webm');

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('extracts transcript text from DashScope response', async () => {
    writeFileSync(audioPath, Buffer.from('fake-audio'));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        output: {
          choices: [
            {
              message: {
                content: [{ text: '阿里云识别结果' }],
              },
            },
          ],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new QwenAsrProvider(createConfig());
    const result = await provider.transcribe({
      filePath: audioPath,
      mimeType: 'audio/webm',
      language: 'zh-CN',
      sizeBytes: 10,
    });
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const requestBody = typeof requestInit?.body === 'string' ? requestInit.body : '';

    expect(result.transcript).toBe('阿里云识别结果');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(createConfig().asrBaseUrl);
    expect(requestBody).toContain('"model":"qwen3-asr-flash"');
    expect(requestBody).toContain('"language":"zh"');
    expect(requestBody).toContain('data:audio/webm;base64,');
  });

  it('throws a stable error when transcript is empty', async () => {
    writeFileSync(audioPath, Buffer.from('fake-audio'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        request_id: 'req_dashscope_1',
        output: {
          choices: [
            {
              message: {
                content: [{ text: '   ' }],
              },
            },
          ],
        },
      }),
    }));

    const provider = new QwenAsrProvider(createConfig());

    await expect(
      provider.transcribe({
        filePath: audioPath,
        mimeType: 'audio/webm',
        language: 'zh-CN',
        sizeBytes: 10,
      }),
    ).rejects.toMatchObject({
      payload: {
        code: 'ASR_FAILED',
        message: 'Qwen ASR 返回为空',
      },
    });
  });
});
