import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  token: text('token').notNull().unique(),
  status: text('status').notNull(),
  deviceType: text('device_type').notNull(),
  deviceLabel: text('device_label'),
  openclawSessionKey: text('openclaw_session_key'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  role: text('role').notNull(),
  content: text('content').notNull(),
  source: text('source').notNull(),
  requestId: text('request_id'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const requestLogs = sqliteTable('request_logs', {
  requestId: text('request_id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  kind: text('kind').notNull(),
  responseJson: text('response_json').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const audioFiles = sqliteTable('audio_files', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  requestId: text('request_id').notNull().unique(),
  filePath: text('file_path').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const openclawGatewayAuth = sqliteTable('openclaw_gateway_auth', {
  role: text('role').primaryKey(),
  deviceId: text('device_id').notNull(),
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key').notNull(),
  deviceToken: text('device_token'),
  scopesJson: text('scopes_json'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});
