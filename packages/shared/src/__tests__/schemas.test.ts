import { describe, expect, it } from 'vitest';

import { clearSessionContextRequestSchema, clearSessionContextResponseSchema, textInputRequestSchema } from '../schemas.js';

describe('textInputRequestSchema', () => {
  it('accepts the MVP text payload', () => {
    const parsed = textInputRequestSchema.parse({
      sessionId: 'sess_123',
      text: '你好',
      requestId: 'req_123',
      openclawSessionKey: 'oc_123',
    });

    expect(parsed.text).toBe('你好');
    expect(parsed.openclawSessionKey).toBe('oc_123');
  });
});

describe('clearSessionContext schemas', () => {
  it('accepts a clear-context request payload', () => {
    const parsed = clearSessionContextRequestSchema.parse({
      sessionId: 'sess_123',
    });

    expect(parsed.sessionId).toBe('sess_123');
  });

  it('accepts a clear-context response payload', () => {
    const parsed = clearSessionContextResponseSchema.parse({
      sessionId: 'sess_123',
      cleared: true,
    });

    expect(parsed.cleared).toBe(true);
  });
});
