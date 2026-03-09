import { describe, expect, it } from 'vitest';
import type { Message } from '@tesla-openclaw/shared';

import { MAX_VISIBLE_MESSAGES, buildVisibleMessages, limitMessages, transitionStatus } from '../state-machine.js';

describe('state machine', () => {
  it('allows valid status transitions', () => {
    expect(transitionStatus('idle', 'recording')).toBe('recording');
    expect(transitionStatus('recording', 'uploading')).toBe('uploading');
    expect(transitionStatus('uploading', 'transcribing')).toBe('transcribing');
  });

  it('blocks invalid status transitions', () => {
    expect(transitionStatus('idle', 'transcribing')).toBe('idle');
  });

  it('clips very long message content for rendering', () => {
    const messages = buildVisibleMessages([
      {
        messageId: 'msg_1',
        sessionId: 'sess_1',
        role: 'assistant',
        content: 'a'.repeat(1400),
        source: 'llm',
        createdAt: new Date().toISOString(),
      },
    ]);

    expect(messages[0]?.content.endsWith('…')).toBe(true);
  });

  it('keeps only the latest visible messages', () => {
    const messages: Message[] = [];
    for (let index = 0; index < MAX_VISIBLE_MESSAGES + 3; index += 1) {
      messages.push({
        messageId: `msg_${index}`,
        sessionId: 'sess_1',
        role: index % 2 === 0 ? 'assistant' : 'user',
        content: `message_${index}`,
        source: 'llm',
        createdAt: new Date().toISOString(),
      });
    }

    const limited = limitMessages(messages);

    expect(limited).toHaveLength(MAX_VISIBLE_MESSAGES);
    expect(limited[0]?.messageId).toBe('msg_3');
  });
});
