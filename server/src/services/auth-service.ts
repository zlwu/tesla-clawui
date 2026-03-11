import { createHmac, timingSafeEqual } from 'node:crypto';

import type { AuthConfigResponse, UnlockResponse } from '@tesla-openclaw/shared';

import type { AppConfig } from '../lib/config.js';
import { AppException } from '../lib/errors.js';

const encodeBase64Url = (value: string): string => Buffer.from(value, 'utf8').toString('base64url');

const decodeBase64Url = (value: string): string => Buffer.from(value, 'base64url').toString('utf8');

export class AuthService {
  private readonly pinLength = 6;
  private readonly signingSecret: string;

  public constructor(private readonly config: AppConfig) {
    this.signingSecret = config.authTokenSecret ?? `shared-pin:${config.authSharedPin ?? 'disabled'}`;
  }

  public getClientConfig(): AuthConfigResponse {
    return {
      enabled: this.config.authEnabled,
      pinLength: this.pinLength,
      sessionDays: this.config.authSessionDays,
    };
  }

  public unlock(pin: string): UnlockResponse {
    if (!this.config.authEnabled || !this.config.authSharedPin) {
      throw new AppException(404, {
        code: 'AUTH_REQUIRED',
        message: '当前服务未启用 PIN 登录',
        retryable: false,
      });
    }

    if (!/^\d{6}$/.test(pin) || pin !== this.config.authSharedPin) {
      throw new AppException(401, {
        code: 'AUTH_INVALID_PIN',
        message: 'PIN 码不正确',
        retryable: false,
      });
    }

    const expiresAt = new Date(Date.now() + this.config.authSessionDays * 24 * 60 * 60 * 1000);
    const payload = encodeBase64Url(
      JSON.stringify({
        exp: expiresAt.toISOString(),
      }),
    );
    const signature = this.sign(payload);

    return {
      authToken: `${payload}.${signature}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  public verifyAccess(token?: string): void {
    if (!this.config.authEnabled) {
      return;
    }

    if (!token) {
      throw new AppException(401, {
        code: 'AUTH_REQUIRED',
        message: '请先输入 PIN 码解锁',
        retryable: false,
      });
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      throw this.unauthorized();
    }

    const payload = parts[0];
    const signature = parts[1];
    if (!payload || !signature) {
      throw this.unauthorized();
    }
    const expectedSignature = this.sign(payload);

    if (
      signature.length !== expectedSignature.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      throw this.unauthorized();
    }

    let parsed: { exp?: string };
    try {
      parsed = JSON.parse(decodeBase64Url(payload)) as { exp?: string };
    } catch {
      throw this.unauthorized();
    }

    if (!parsed.exp || Number.isNaN(Date.parse(parsed.exp)) || Date.parse(parsed.exp) <= Date.now()) {
      throw this.unauthorized();
    }
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.signingSecret).update(payload).digest('base64url');
  }

  private unauthorized(): AppException {
    return new AppException(401, {
      code: 'AUTH_REQUIRED',
      message: '登录已失效，请重新输入 PIN 码',
      retryable: false,
    });
  }
}
