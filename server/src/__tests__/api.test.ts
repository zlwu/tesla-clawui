import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';

const testDbPath = resolve(process.cwd(), 'server/data/test-openclaw.db');

const createRequestId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;

describe('server api', () => {
  beforeEach(() => {
    rmSync(testDbPath, { force: true });
    process.env.DATABASE_URL = './server/data/test-openclaw.db';
    process.env.LLM_PROVIDER = 'mock';
    process.env.ASR_PROVIDER = 'mock';
  });

  it('handles text input and recent messages', async () => {
    const { app } = createApp();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/session/create',
      payload: {
        device: { type: 'tesla-browser', label: 'tesla-mcu2' },
      },
    });

    expect(createResponse.statusCode).toBe(200);
    const createPayload = createResponse.json<{ data: { session: { sessionId: string }; sessionToken: string } }>();

    const textResponse = await app.inject({
      method: 'POST',
      url: '/api/text/input',
      headers: {
        authorization: `Bearer ${createPayload.data.sessionToken}`,
      },
      payload: {
        sessionId: createPayload.data.session.sessionId,
        text: '帮我记住这是第一轮',
        requestId: createRequestId('req_text'),
      },
    });

    expect(textResponse.statusCode).toBe(200);
    const textPayload = textResponse.json<{ data: { assistantMessage: { content: string } } }>();
    expect(textPayload.data.assistantMessage.content).toContain('MVP mock 回复');

    const messagesResponse = await app.inject({
      method: 'GET',
      url: `/api/messages?sessionId=${createPayload.data.session.sessionId}&limit=8`,
      headers: {
        authorization: `Bearer ${createPayload.data.sessionToken}`,
      },
    });

    expect(messagesResponse.statusCode).toBe(200);
    const messagesPayload = messagesResponse.json<{ data: { messages: Array<{ role: string }> } }>();
    expect(messagesPayload.data.messages).toHaveLength(2);
    expect(messagesPayload.data.messages[0]?.role).toBe('user');
    expect(messagesPayload.data.messages[1]?.role).toBe('assistant');
    expect(createResponse.headers['x-request-id']).toBeTruthy();

    await app.close();
  });

  it('reuses the same text result for duplicate requestId', async () => {
    const { app } = createApp();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/session/create',
      payload: {
        device: { type: 'tesla-browser', label: 'tesla-mcu2' },
      },
    });
    const createPayload = createResponse.json<{ data: { session: { sessionId: string }; sessionToken: string } }>();
    const requestId = createRequestId('req_text');

    const firstResponse = await app.inject({
      method: 'POST',
      url: '/api/text/input',
      headers: {
        authorization: `Bearer ${createPayload.data.sessionToken}`,
      },
      payload: {
        sessionId: createPayload.data.session.sessionId,
        text: '重复请求测试',
        requestId,
      },
    });
    const secondResponse = await app.inject({
      method: 'POST',
      url: '/api/text/input',
      headers: {
        authorization: `Bearer ${createPayload.data.sessionToken}`,
      },
      payload: {
        sessionId: createPayload.data.session.sessionId,
        text: '重复请求测试',
        requestId,
      },
    });

    expect(secondResponse.statusCode).toBe(200);
    expect(secondResponse.body).toBe(firstResponse.body);

    const messages = await app.services.messageService.listRecent(createPayload.data.session.sessionId, 8);
    expect(messages).toHaveLength(2);

    await app.close();
  });
});
