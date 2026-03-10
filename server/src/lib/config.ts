import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { z } from 'zod';

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(currentDir, '../../..');

dotenv.config({ path: resolve(workspaceRoot, '.env') });

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  UPLOAD_DIR: z.string().min(1).default('./server/uploads'),
  SESSION_TOKEN_BYTES: z.coerce.number().int().min(16).max(64).default(24),
  MESSAGE_LIMIT_DEFAULT: z.coerce.number().int().min(1).max(20).default(8),
  MESSAGE_LIMIT_MAX: z.coerce.number().int().min(1).max(20).default(20),
  LLM_PROVIDER: z.enum(['mock', 'openai-compatible', 'openclaw']).default('mock'),
  LLM_BASE_URL: z.string().optional(),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().min(1).default('openai/gpt-4o-mini'),
  OPENCLAW_AGENT_ID: z.string().min(1).optional(),
  ASR_PROVIDER: z.enum(['mock', 'openai-compatible', 'qwen']).default('mock'),
  ASR_BASE_URL: z.string().optional(),
  ASR_API_KEY: z.string().optional(),
  ASR_MODEL: z.string().min(1).default('whisper-1'),
});

export type AppConfig = {
  port: number;
  host: string;
  databaseUrl: string;
  uploadDir: string;
  sessionTokenBytes: number;
  messageLimitDefault: number;
  messageLimitMax: number;
  llmProvider: 'mock' | 'openai-compatible' | 'openclaw';
  llmBaseUrl?: string;
  llmApiKey?: string;
  llmModel: string;
  openclawAgentId?: string;
  asrProvider: 'mock' | 'openai-compatible' | 'qwen';
  asrBaseUrl?: string;
  asrApiKey?: string;
  asrModel: string;
};

export const loadConfig = (): AppConfig => {
  const env = configSchema.parse(process.env);
  const databaseUrl = resolve(workspaceRoot, env.DATABASE_URL);
  const uploadDir = resolve(workspaceRoot, env.UPLOAD_DIR);

  mkdirSync(dirname(databaseUrl), { recursive: true });
  mkdirSync(uploadDir, { recursive: true });

  return {
    port: env.PORT,
    host: env.HOST,
    databaseUrl,
    uploadDir,
    sessionTokenBytes: env.SESSION_TOKEN_BYTES,
    messageLimitDefault: env.MESSAGE_LIMIT_DEFAULT,
    messageLimitMax: env.MESSAGE_LIMIT_MAX,
    llmProvider: env.LLM_PROVIDER,
    ...(env.LLM_BASE_URL ? { llmBaseUrl: env.LLM_BASE_URL } : {}),
    ...(env.LLM_API_KEY ? { llmApiKey: env.LLM_API_KEY } : {}),
    llmModel: env.LLM_MODEL,
    ...(env.OPENCLAW_AGENT_ID ? { openclawAgentId: env.OPENCLAW_AGENT_ID } : {}),
    asrProvider: env.ASR_PROVIDER,
    ...(env.ASR_BASE_URL ? { asrBaseUrl: env.ASR_BASE_URL } : {}),
    ...(env.ASR_API_KEY ? { asrApiKey: env.ASR_API_KEY } : {}),
    asrModel: env.ASR_MODEL,
  };
};
