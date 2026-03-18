import { createHash, createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';

import { eq } from 'drizzle-orm';

import type { DatabaseClient } from '../../db/client.js';
import { openclawGatewayAuth } from '../../db/schema.js';
import { nowIso } from '../../lib/utils.js';

export type OpenClawGatewayAuthState = {
  role: string;
  deviceId: string;
  publicKey: string;
  privateKey: string;
  deviceToken: string | null;
  scopes: string[];
};

export type OpenClawGatewayAuthStore = {
  getState(role: string): Promise<OpenClawGatewayAuthState>;
  saveDeviceToken(params: {
    role: string;
    deviceToken: string;
    scopes: string[];
  }): Promise<void>;
  clearDeviceToken(role: string): Promise<void>;
};

const createDeviceIdentity = (): Pick<
  OpenClawGatewayAuthState,
  'deviceId' | 'publicKey' | 'privateKey'
> => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicJwk = publicKey.export({ format: 'jwk' });
  const privateJwk = privateKey.export({ format: 'jwk' });

  if (
    publicJwk.kty !== 'OKP' ||
    publicJwk.crv !== 'Ed25519' ||
    typeof publicJwk.x !== 'string' ||
    privateJwk.kty !== 'OKP' ||
    privateJwk.crv !== 'Ed25519' ||
    typeof privateJwk.d !== 'string'
  ) {
    throw new Error('failed to generate OpenClaw device identity');
  }

  return {
    deviceId: createHash('sha256').update(Buffer.from(publicJwk.x, 'base64url')).digest('hex'),
    publicKey: publicJwk.x,
    privateKey: privateJwk.d,
  };
};

const normalizeScopes = (value: string[] | null | undefined): string[] =>
  Array.from(
    new Set(
      (value ?? [])
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ).sort();

const parseScopes = (value: string | null): string[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? normalizeScopes(parsed) : [];
  } catch {
    return [];
  }
};

const serializeScopes = (value: string[]): string =>
  JSON.stringify(normalizeScopes(value));

export const signOpenClawDevicePayload = (
  privateKey: string,
  publicKey: string,
  payload: string,
): string =>
  sign(
    null,
    Buffer.from(payload, 'utf8'),
    createPrivateKey({
      key: {
        kty: 'OKP',
        crv: 'Ed25519',
        x: publicKey,
        d: privateKey,
      },
      format: 'jwk',
    }),
  ).toString('base64url');

export class SqliteOpenClawGatewayAuthStore implements OpenClawGatewayAuthStore {
  public constructor(private readonly db: DatabaseClient) {}

  public async getState(role: string): Promise<OpenClawGatewayAuthState> {
    const existing = await this.db.query.openclawGatewayAuth.findFirst({
      where: eq(openclawGatewayAuth.role, role),
    });

    if (existing) {
      return {
        role: existing.role,
        deviceId: existing.deviceId,
        publicKey: existing.publicKey,
        privateKey: existing.privateKey,
        deviceToken: existing.deviceToken,
        scopes: parseScopes(existing.scopesJson),
      };
    }

    const identity = createDeviceIdentity();
    const timestamp = nowIso();
    await this.db.insert(openclawGatewayAuth).values({
      role,
      ...identity,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    return {
      role,
      ...identity,
      deviceToken: null,
      scopes: [],
    };
  }

  public async saveDeviceToken(params: {
    role: string;
    deviceToken: string;
    scopes: string[];
  }): Promise<void> {
    const state = await this.getState(params.role);
    await this.db
      .update(openclawGatewayAuth)
      .set({
        deviceToken: params.deviceToken,
        scopesJson: serializeScopes(params.scopes),
        updatedAt: nowIso(),
      })
      .where(eq(openclawGatewayAuth.role, state.role));
  }

  public async clearDeviceToken(role: string): Promise<void> {
    const state = await this.getState(role);
    await this.db
      .update(openclawGatewayAuth)
      .set({
        deviceToken: null,
        scopesJson: serializeScopes([]),
        updatedAt: nowIso(),
      })
      .where(eq(openclawGatewayAuth.role, state.role));
  }
}

export class MemoryOpenClawGatewayAuthStore implements OpenClawGatewayAuthStore {
  private readonly byRole = new Map<string, OpenClawGatewayAuthState>();

  public getState(role: string): Promise<OpenClawGatewayAuthState> {
    const existing = this.byRole.get(role);
    if (existing) {
      return Promise.resolve(existing);
    }

    const created: OpenClawGatewayAuthState = {
      role,
      ...createDeviceIdentity(),
      deviceToken: null,
      scopes: [],
    };
    this.byRole.set(role, created);
    return Promise.resolve(created);
  }

  public async saveDeviceToken(params: {
    role: string;
    deviceToken: string;
    scopes: string[];
  }): Promise<void> {
    const state = await this.getState(params.role);
    this.byRole.set(params.role, {
      ...state,
      deviceToken: params.deviceToken,
      scopes: normalizeScopes(params.scopes),
    });
  }

  public async clearDeviceToken(role: string): Promise<void> {
    const state = await this.getState(role);
    this.byRole.set(role, {
      ...state,
      deviceToken: null,
      scopes: [],
    });
  }
}
