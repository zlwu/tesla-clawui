import { randomBytes } from 'node:crypto';

import type { CreateSessionResponse, Session } from '@tesla-openclaw/shared';
import { eq } from 'drizzle-orm';

import type { DatabaseClient } from '../db/client.js';
import { sessions } from '../db/schema.js';
import type { AppConfig } from '../lib/config.js';
import { AppException } from '../lib/errors.js';
import { createId, nowIso } from '../lib/utils.js';

const toSession = (row: typeof sessions.$inferSelect): Session => ({
  sessionId: row.id,
  status: row.status as Session['status'],
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export class SessionService {
  public constructor(
    private readonly db: DatabaseClient,
    private readonly config: AppConfig,
  ) {}

  public async create(deviceLabel?: string): Promise<CreateSessionResponse> {
    const sessionId = createId('sess');
    const sessionToken = randomBytes(this.config.sessionTokenBytes).toString('hex');
    const createdAt = nowIso();

    await this.db.insert(sessions).values({
      id: sessionId,
      token: sessionToken,
      status: 'idle',
      deviceType: 'tesla-browser',
      deviceLabel,
      createdAt,
      updatedAt: createdAt,
    });

    return {
      session: {
        sessionId,
        status: 'idle',
        createdAt,
        updatedAt: createdAt,
      },
      sessionToken,
    };
  }

  public async getAuthorizedSession(sessionId: string, token: string): Promise<Session> {
    const row = await this.db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!row) {
      throw new AppException(404, {
        code: 'SESSION_NOT_FOUND',
        message: '会话不存在',
        retryable: false,
      });
    }

    if (row.token !== token) {
      throw new AppException(401, {
        code: 'SESSION_UNAUTHORIZED',
        message: '会话无权访问',
        retryable: false,
      });
    }

    return toSession(row);
  }

  public async touch(sessionId: string, status: Session['status']): Promise<void> {
    await this.db
      .update(sessions)
      .set({ status, updatedAt: nowIso() })
      .where(eq(sessions.id, sessionId));
  }
}
