import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';

const testDbPath = resolve(process.cwd(), 'server/data/test-openclaw-voice.db');

const createRequestId = (): string => `req_voice_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;

describe('voice service', () => {
  beforeEach(() => {
    rmSync(testDbPath, { force: true });
    process.env.DATABASE_URL = './server/data/test-openclaw-voice.db';
    process.env.LLM_PROVIDER = 'mock';
    process.env.ASR_PROVIDER = 'mock';
  });

  it('stores transcript and assistant reply for voice input', async () => {
    const { app } = createApp();
    const session = await app.services.sessionService.create('tesla-mcu2');

    const response = await app.services.voiceService.handleInput({
      sessionId: session.session.sessionId,
      token: session.sessionToken,
      requestId: createRequestId(),
      audioBuffer: Buffer.from('fake-webm-audio'),
      mimeType: 'audio/webm',
      language: 'zh-CN',
      filename: 'voice.webm',
    });

    expect(response.transcript).toContain('语音输入已收到');
    expect(response.userMessage.source).toBe('voice_asr');
    expect(response.assistantMessage.source).toBe('llm');
    expect(response.assistantMessage.content).toContain('MVP mock 回复');

    const messages = await app.services.messageService.listRecent(session.session.sessionId, 8);
    expect(messages).toHaveLength(2);
    expect(messages[0]?.source).toBe('voice_asr');
    expect(messages[1]?.source).toBe('llm');

    await app.close();
  });

  it('reuses the same voice result for duplicate requestId', async () => {
    const { app } = createApp();
    const session = await app.services.sessionService.create('tesla-mcu2');
    const requestId = createRequestId();

    const first = await app.services.voiceService.handleInput({
      sessionId: session.session.sessionId,
      token: session.sessionToken,
      requestId,
      audioBuffer: Buffer.from('fake-webm-audio'),
      mimeType: 'audio/webm',
      language: 'zh-CN',
      filename: 'voice.webm',
    });
    const second = await app.services.voiceService.handleInput({
      sessionId: session.session.sessionId,
      token: session.sessionToken,
      requestId,
      audioBuffer: Buffer.from('fake-webm-audio'),
      mimeType: 'audio/webm',
      language: 'zh-CN',
      filename: 'voice.webm',
    });

    expect(second).toEqual(first);

    const messages = await app.services.messageService.listRecent(session.session.sessionId, 8);
    expect(messages).toHaveLength(2);

    await app.close();
  });
});
