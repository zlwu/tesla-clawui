import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { loadConfig } from '../lib/config.js';
import * as schema from './schema.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationDir = resolve(currentDir, '../../drizzle');

const loadMigrationFiles = (): Array<{ name: string; sql: string }> =>
  readdirSync(migrationDir)
    .filter((entry) => entry.endsWith('.sql'))
    .sort()
    .map((entry) => ({
      name: entry,
      sql: readFileSync(resolve(migrationDir, entry), 'utf8'),
    }));

const ensureMigrationsTable = (sqlite: Database.Database): void => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS __codex_migrations (
      name TEXT PRIMARY KEY NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

const hasColumn = (sqlite: Database.Database, tableName: string, columnName: string): boolean => {
  const rows = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name?: string }>;
  return rows.some((row) => row.name === columnName);
};

const isMigrationAlreadySatisfied = (sqlite: Database.Database, migrationName: string): boolean => {
  if (migrationName === '0001_openclaw_session_key.sql') {
    return hasColumn(sqlite, 'sessions', 'openclaw_session_key');
  }

  return false;
};

const applyMigrations = (sqlite: Database.Database): void => {
  ensureMigrationsTable(sqlite);

  const applied = new Set(
    (
      sqlite.prepare('SELECT name FROM __codex_migrations ORDER BY name').all() as Array<{ name: string }>
    ).map((row) => row.name),
  );

  for (const migration of loadMigrationFiles()) {
    if (applied.has(migration.name)) {
      continue;
    }

    if (isMigrationAlreadySatisfied(sqlite, migration.name)) {
      sqlite
        .prepare('INSERT OR IGNORE INTO __codex_migrations (name) VALUES (?)')
        .run(migration.name);
      continue;
    }

    sqlite.transaction(() => {
      sqlite.exec(migration.sql);
      sqlite.prepare('INSERT INTO __codex_migrations (name) VALUES (?)').run(migration.name);
    })();
  }
};

export const createDb = () => {
  const config = loadConfig();
  const sqlite = new Database(config.databaseUrl);
  sqlite.pragma('journal_mode = WAL');
  applyMigrations(sqlite);

  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
  };
};

export type DatabaseClient = ReturnType<typeof createDb>['db'];
