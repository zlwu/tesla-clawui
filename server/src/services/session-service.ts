import { randomBytes } from 'node:crypto';

import type { CreateSessionResponse, Session } from '@tesla-openclaw/shared';
import { and, eq } from 'drizzle-orm';

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

export type AuthorizedSessionState = Session & {
  openclawSessionKey: string | null;
};

const resolveOpenClawAgentId = (config: AppConfig): string => {
  if (config.openclawAgentId) {
    return config.openclawAgentId;
  }

  if (config.llmModel.startsWith('openclaw:')) {
    const [, agentId] = config.llmModel.split(':', 2);
    if (agentId) {
      return agentId;
    }
  }

  return 'main';
};

export class SessionService {
  public constructor(
    private readonly db: DatabaseClient,
    private readonly config: AppConfig,
  ) {}

  public async create(deviceLabel?: string): Promise<CreateSessionResponse> {
    const sessionId = createId('sess');
    const sessionToken = randomBytes(this.config.sessionTokenBytes).toString('hex');
    const createdAt = nowIso();
    const openclawSessionKey =
      this.config.llmProvider === 'openclaw'
        ? `agent:${resolveOpenClawAgentId(this.config)}:${sessionId}`
        : null;

    await this.db.insert(sessions).values({
      id: sessionId,
      token: sessionToken,
      status: 'idle',
      deviceType: 'tesla-browser',
      deviceLabel,
      ...(openclawSessionKey ? { openclawSessionKey } : {}),
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
    const row = await this.getAuthorizedSessionRow(sessionId, token);

    return toSession(row);
  }

  public async getAuthorizedSessionState(sessionId: string, token: string): Promise<AuthorizedSessionState> {
    const row = await this.getAuthorizedSessionRow(sessionId, token);

    return {
      ...toSession(row),
      openclawSessionKey: row.openclawSessionKey,
    };
  }

  public async acquireAuthorizedBusySession(
    sessionId: string,
    token: string,
  ): Promise<AuthorizedSessionState> {
    const row = await this.getAuthorizedSessionRow(sessionId, token);
    if (row.status !== 'idle') {
      throw this.createBusySessionConflict();
    }

    const updatedAt = nowIso();
    const result = this.db
      .update(sessions)
      .set({ status: 'thinking', updatedAt })
      .where(and(
        eq(sessions.id, sessionId),
        eq(sessions.token, token),
        eq(sessions.status, 'idle'),
      ))
      .run();

    if (result.changes === 0) {
      throw this.createBusySessionConflict();
    }

    return {
      sessionId: row.id,
      status: 'thinking',
      createdAt: row.createdAt,
      updatedAt,
      openclawSessionKey: row.openclawSessionKey,
    };
  }

  public async touch(sessionId: string, status: Session['status']): Promise<void> {
    await this.db
      .update(sessions)
      .set({ status, updatedAt: nowIso() })
      .where(eq(sessions.id, sessionId));
  }

  private async getAuthorizedSessionRow(sessionId: string, token: string): Promise<typeof sessions.$inferSelect> {
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

    return row;
  }

  private createBusySessionConflict(): AppException {
    return new AppException(409, {
      code: 'REQUEST_CONFLICT',
      message: '当前回复尚未完成，请稍后再试',
      retryable: true,
    });
  }
}
