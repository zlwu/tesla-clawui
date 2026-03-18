CREATE TABLE IF NOT EXISTS openclaw_gateway_auth (
  role TEXT PRIMARY KEY NOT NULL,
  device_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  private_key TEXT NOT NULL,
  device_token TEXT,
  scopes_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
