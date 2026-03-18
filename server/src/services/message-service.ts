import type { Message, MessageRole, MessageSource } from '@tesla-openclaw/shared';
import { asc, desc, eq } from 'drizzle-orm';

import type { DatabaseClient } from '../db/client.js';
import { messages } from '../db/schema.js';
import { createId } from '../lib/utils.js';

const toMessage = (row: typeof messages.$inferSelect): Message => ({
  messageId: row.id,
  sessionId: row.sessionId,
  role: row.role as MessageRole,
  content: row.content,
  source: row.source as MessageSource,
  createdAt: row.createdAt,
});

export class MessageService {
  private lastCreatedAtMs = 0;

  public constructor(private readonly db: DatabaseClient) {}

  public async listRecent(sessionId: string, limit: number): Promise<Message[]> {
    const rows = await this.db.query.messages.findMany({
      where: eq(messages.sessionId, sessionId),
      orderBy: [asc(messages.createdAt)],
    });

    return rows.slice(-limit).map(toMessage);
  }

  public async listHistory(sessionId: string, limit: number): Promise<Message[]> {
    const rows = await this.db.query.messages.findMany({
      where: eq(messages.sessionId, sessionId),
      orderBy: [desc(messages.createdAt)],
      limit,
    });

    return rows.reverse().map(toMessage);
  }

  public async create(params: {
    sessionId: string;
    role: MessageRole;
    content: string;
    source: MessageSource;
    requestId?: string;
  }): Promise<Message> {
    const createdAt = this.createMonotonicTimestamp();
    const message: Message = {
      messageId: createId('msg'),
      sessionId: params.sessionId,
      role: params.role,
      content: params.content,
      source: params.source,
      createdAt,
    };

    await this.db.insert(messages).values({
      id: message.messageId,
      sessionId: params.sessionId,
      role: params.role,
      content: params.content,
      source: params.source,
      requestId: params.requestId,
      createdAt,
    });

    return message;
  }

  public async clearSession(sessionId: string): Promise<void> {
    await this.db.delete(messages).where(eq(messages.sessionId, sessionId));
  }

  private createMonotonicTimestamp(): string {
    const nowMs = Date.now();
    this.lastCreatedAtMs = Math.max(nowMs, this.lastCreatedAtMs + 1);
    return new Date(this.lastCreatedAtMs).toISOString();
  }
}
