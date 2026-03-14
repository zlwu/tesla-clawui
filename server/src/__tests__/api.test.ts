import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../app.js';

const testDbPath = resolve(process.cwd(), 'server/data/test-openclaw-api.db');

const createRequestId = (prefix: string): string =>
  `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;

describe('server api', () => {
  beforeEach(() => {
    rmSync(testDbPath, { force: true });
    process.env.DATABASE_URL = './server/data/test-openclaw-api.db';
    process.env.AUTH_ENABLED = 'false';
    delete process.env.AUTH_SHARED_PIN;
    process.env.LLM_PROVIDER = 'mock';
    delete process.env.LLM_BASE_URL;
    delete process.env.LLM_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('keeps the latest conversation turns in LLM context', async () => {
    const { app } = createApp();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/session/create',
      payload: {
        device: { type: 'tesla-browser', label: 'tesla-mcu2' },
      },
    });
    const createPayload = createResponse.json<{ data: { session: { sessionId: string }; sessionToken: string } }>();

    for (let round = 1; round <= 8; round += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/text/input',
        headers: {
          authorization: `Bearer ${createPayload.data.sessionToken}`,
        },
        payload: {
          sessionId: createPayload.data.session.sessionId,
          text: `第 ${round} 轮`,
          requestId: createRequestId('req_text'),
        },
      });

      expect(response.statusCode).toBe(200);
    }

    const history = await app.services.messageService.listHistory(createPayload.data.session.sessionId, 12);

    expect(history).toHaveLength(12);
    expect(history[0]?.role).toBe('user');
    expect(history[0]?.content).toBe('第 3 轮');
    expect(history.at(-2)?.role).toBe('user');
    expect(history.at(-2)?.content).toBe('第 8 轮');

    await app.close();
  });

  it('streams text deltas and final response over SSE', async () => {
    const { app } = createApp();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/session/create',
      payload: {
        device: { type: 'tesla-browser', label: 'tesla-mcu2' },
      },
    });
    const createPayload = createResponse.json<{ data: { session: { sessionId: string }; sessionToken: string } }>();

    const streamResponse = await app.inject({
      method: 'POST',
      url: '/api/text/input/stream',
      headers: {
        authorization: `Bearer ${createPayload.data.sessionToken}`,
      },
      payload: {
        sessionId: createPayload.data.session.sessionId,
        text: '流式测试',
        requestId: createRequestId('req_text_stream'),
      },
    });

    expect(streamResponse.statusCode).toBe(200);
    expect(streamResponse.headers['content-type']).toContain('text/event-stream');
    expect(streamResponse.body).toContain('event: start');
    expect(streamResponse.body).toContain('event: delta');
    expect(streamResponse.body).toContain('event: done');
    expect(streamResponse.body).toContain('MVP mock 回复');

    await app.close();
  });

  it('requires shared pin auth before creating a session when auth is enabled', async () => {
    process.env.AUTH_ENABLED = 'true';
    process.env.AUTH_SHARED_PIN = '123456';

    const { app } = createApp();

    const blockedResponse = await app.inject({
      method: 'POST',
      url: '/api/session/create',
      payload: {
        device: { type: 'tesla-browser', label: 'tesla-mcu2' },
      },
    });
    expect(blockedResponse.statusCode).toBe(401);
    expect(blockedResponse.body).toContain('AUTH_REQUIRED');

    const authConfigResponse = await app.inject({
      method: 'GET',
      url: '/api/auth/config',
    });
    expect(authConfigResponse.statusCode).toBe(200);
    expect(authConfigResponse.body).toContain('"enabled":true');

    const unlockResponse = await app.inject({
      method: 'POST',
      url: '/api/auth/unlock',
      payload: { pin: '123456' },
    });
    expect(unlockResponse.statusCode).toBe(200);
    const unlockPayload = unlockResponse.json<{ data: { authToken: string } }>();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/session/create',
      headers: {
        'x-app-auth': unlockPayload.data.authToken,
      },
      payload: {
        device: { type: 'tesla-browser', label: 'tesla-mcu2' },
      },
    });
    expect(createResponse.statusCode).toBe(200);

    await app.close();
  });

  it('returns SSE error and does not persist partial replies when upstream stream truncates', async () => {
    process.env.LLM_PROVIDER = 'openai-compatible';
    process.env.LLM_BASE_URL = 'http://127.0.0.1:8899/v1/chat/completions';
    process.env.LLM_API_KEY = 'test-token';

    const truncatedStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"半句"}}]}\n\n'));
        controller.close();
      },
    });
    const completeStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"完整"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"回复"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(truncatedStream, {
          status: 200,
          headers: {
            'content-type': 'text/event-stream; charset=utf-8',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(completeStream, {
          status: 200,
          headers: {
            'content-type': 'text/event-stream; charset=utf-8',
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const { app } = createApp();
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/session/create',
      payload: {
        device: { type: 'tesla-browser', label: 'tesla-mcu2' },
      },
    });
    const createPayload = createResponse.json<{ data: { session: { sessionId: string }; sessionToken: string } }>();
    const requestId = createRequestId('req_text_stream_retry');

    const firstTry = await app.inject({
      method: 'POST',
      url: '/api/text/input/stream',
      headers: {
        authorization: `Bearer ${createPayload.data.sessionToken}`,
      },
      payload: {
        sessionId: createPayload.data.session.sessionId,
        text: '第一次',
        requestId,
      },
    });

    expect(firstTry.statusCode).toBe(200);
    expect(firstTry.body).toContain('event: start');
    expect(firstTry.body).toContain('event: delta');
    expect(firstTry.body).toContain('event: error');
    expect(firstTry.body).not.toContain('event: done');
    expect(firstTry.body).toContain('"code":"LLM_FAILED"');

    const messagesAfterFail = await app.services.messageService.listRecent(
      createPayload.data.session.sessionId,
      8,
    );
    expect(messagesAfterFail).toHaveLength(0);

    const secondTry = await app.inject({
      method: 'POST',
      url: '/api/text/input/stream',
      headers: {
        authorization: `Bearer ${createPayload.data.sessionToken}`,
      },
      payload: {
        sessionId: createPayload.data.session.sessionId,
        text: '第一次',
        requestId,
      },
    });

    expect(secondTry.statusCode).toBe(200);
    expect(secondTry.body).toContain('event: done');
    expect(secondTry.body).toContain('完整回复');

    const messagesAfterSuccess = await app.services.messageService.listRecent(
      createPayload.data.session.sessionId,
      8,
    );
    expect(messagesAfterSuccess).toHaveLength(2);
    expect(messagesAfterSuccess[0]?.role).toBe('user');
    expect(messagesAfterSuccess[1]?.role).toBe('assistant');

    await app.close();
  });
});
