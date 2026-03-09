import { describe, expect, it } from 'vitest';

import { textInputRequestSchema } from '../schemas.js';

describe('textInputRequestSchema', () => {
  it('accepts the MVP text payload', () => {
    const parsed = textInputRequestSchema.parse({
      sessionId: 'sess_123',
      text: '你好',
      requestId: 'req_123',
    });

    expect(parsed.text).toBe('你好');
  });
});
