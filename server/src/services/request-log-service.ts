import { eq } from 'drizzle-orm';

import type { DatabaseClient } from '../db/client.js';
import { requestLogs } from '../db/schema.js';
import { nowIso } from '../lib/utils.js';

export class RequestLogService {
  private readonly inFlightRequests = new Map<string, {
    sessionId: string;
    promise: Promise<unknown>;
  }>();

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

  public hasInFlightSession(sessionId: string): boolean {
    for (const request of this.inFlightRequests.values()) {
      if (request.sessionId === sessionId) {
        return true;
      }
    }

    return false;
  }

  public async clearSession(sessionId: string): Promise<void> {
    await this.db.delete(requestLogs).where(eq(requestLogs.sessionId, sessionId));
  }

  public async runOnce<T>(params: {
    requestId: string;
    sessionId: string;
    operation: () => Promise<T>;
  }): Promise<T> {
    const existing = this.inFlightRequests.get(params.requestId);
    if (existing) {
      return existing.promise as Promise<T>;
    }

    const pending = params.operation().finally(() => {
      this.inFlightRequests.delete(params.requestId);
    });
    this.inFlightRequests.set(params.requestId, {
      sessionId: params.sessionId,
      promise: pending,
    });

    return pending;
  }
}
