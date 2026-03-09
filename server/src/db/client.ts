import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { loadConfig } from '../lib/config.js';
import * as schema from './schema.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(currentDir, '../../drizzle/0000_init.sql');
const migrationSql = readFileSync(migrationPath, 'utf8');

export const createDb = () => {
  const config = loadConfig();
  const sqlite = new Database(config.databaseUrl);
  sqlite.pragma('journal_mode = WAL');
  sqlite.exec(migrationSql);

  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
  };
};

export type DatabaseClient = ReturnType<typeof createDb>['db'];
