import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { z } from 'zod';

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(currentDir, '../../..');

dotenv.config({ path: resolve(workspaceRoot, '.env') });

const envBoolean = z.preprocess((value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }

    if (normalized === 'false' || normalized === '0' || normalized === '') {
      return false;
    }
  }

  return value;
}, z.boolean());

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  SESSION_TOKEN_BYTES: z.coerce.number().int().min(16).max(64).default(24),
  AUTH_ENABLED: envBoolean.default(false),
  AUTH_SHARED_PIN: z.string().regex(/^\d{6}$/).optional(),
  AUTH_SESSION_DAYS: z.coerce.number().int().min(1).max(365).default(90),
  AUTH_TOKEN_SECRET: z.string().min(16).optional(),
  MESSAGE_LIMIT_DEFAULT: z.coerce.number().int().min(1).max(20).default(8),
  MESSAGE_LIMIT_MAX: z.coerce.number().int().min(1).max(20).default(20),
  LLM_PROVIDER: z.enum(['mock', 'openai-compatible', 'openclaw']).default('mock'),
  LLM_BASE_URL: z.string().optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().min(1).default('openai/gpt-4o-mini'),
  OPENCLAW_AGENT_ID: z.string().min(1).optional(),
});

export type AppConfig = {
  port: number;
  host: string;
  databaseUrl: string;
  sessionTokenBytes: number;
  authEnabled: boolean;
  authSharedPin?: string;
  authSessionDays: number;
  authTokenSecret?: string;
  messageLimitDefault: number;
  messageLimitMax: number;
  llmProvider: 'mock' | 'openai-compatible' | 'openclaw';
  llmBaseUrl?: string;
  llmApiKey?: string;
  llmModel: string;
  openclawAgentId?: string;
};

export const loadConfig = (): AppConfig => {
  const env = configSchema.parse(process.env);
  if (env.AUTH_ENABLED && !env.AUTH_SHARED_PIN) {
    throw new Error('AUTH_SHARED_PIN is required when AUTH_ENABLED=true');
  }
  const databaseUrl = resolve(workspaceRoot, env.DATABASE_URL);

  mkdirSync(dirname(databaseUrl), { recursive: true });

  return {
    port: env.PORT,
    host: env.HOST,
    databaseUrl,
    sessionTokenBytes: env.SESSION_TOKEN_BYTES,
    authEnabled: env.AUTH_ENABLED,
    ...(env.AUTH_SHARED_PIN ? { authSharedPin: env.AUTH_SHARED_PIN } : {}),
    authSessionDays: env.AUTH_SESSION_DAYS,
    ...(env.AUTH_TOKEN_SECRET ? { authTokenSecret: env.AUTH_TOKEN_SECRET } : {}),
    messageLimitDefault: env.MESSAGE_LIMIT_DEFAULT,
    messageLimitMax: env.MESSAGE_LIMIT_MAX,
    llmProvider: env.LLM_PROVIDER,
    ...(env.LLM_BASE_URL ? { llmBaseUrl: env.LLM_BASE_URL } : {}),
    ...(env.LLM_API_KEY ? { llmApiKey: env.LLM_API_KEY } : {}),
    llmModel: env.LLM_MODEL,
    ...(env.OPENCLAW_AGENT_ID ? { openclawAgentId: env.OPENCLAW_AGENT_ID } : {}),
  };
};
