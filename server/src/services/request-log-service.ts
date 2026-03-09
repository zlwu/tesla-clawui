import { eq } from 'drizzle-orm';

import type { DatabaseClient } from '../db/client.js';
import { requestLogs } from '../db/schema.js';
import { nowIso } from '../lib/utils.js';

export class RequestLogService {
  private readonly inFlightRequests = new Map<string, Promise<unknown>>();

  public constructor(private readonly db: DatabaseClient) {}

  public async get<T>(requestId: string): Promise<T | null> {
    const row = await this.db.query.requestLogs.findFirst({
      where: eq(requestLogs.requestId, requestId),
    });

    return row ? (JSON.parse(row.responseJson) as T) : null;
  }

  public async save(requestId: string, sessionId: string, kind: string, response: unknown): Promise<void> {
    await this.db.insert(requestLogs).values({
      requestId,
      sessionId,
      kind,
      responseJson: JSON.stringify(response),
      createdAt: nowIso(),
    });
  }

  public hasInFlight(requestId: string): boolean {
    return this.inFlightRequests.has(requestId);
  }

  public async runOnce<T>(requestId: string, operation: () => Promise<T>): Promise<T> {
    const existing = this.inFlightRequests.get(requestId);
    if (existing) {
      return existing as Promise<T>;
    }

    const pending = operation().finally(() => {
      this.inFlightRequests.delete(requestId);
    });
    this.inFlightRequests.set(requestId, pending);

    return pending;
  }
}
