-- promptgen 内容资产（含原始 JSON 兜底）
-- 由 manifest.db.schema 声明；raw_json 保存迁移时原始完整字符串。

CREATE TABLE IF NOT EXISTS pg_assets (
  asset_key      TEXT PRIMARY KEY,
  raw_json       TEXT NOT NULL,
  live_json      TEXT NOT NULL DEFAULT '',
  schema_version INTEGER NOT NULL DEFAULT 0,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pg_flows (
  id         TEXT PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  archived    INTEGER NOT NULL DEFAULT 0,
  created    TEXT NOT NULL DEFAULT '',
  updated    TEXT NOT NULL DEFAULT '',
  raw_json   TEXT NOT NULL,
  live_json  TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS pg_modules (
  id         TEXT PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  raw_json    TEXT NOT NULL,
  live_json   TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS pg_tasks (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT '',
  raw_json   TEXT NOT NULL,
  live_json  TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS pg_flow_groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT '',
  order_index INTEGER NOT NULL DEFAULT 0,
  raw_json    TEXT NOT NULL,
  live_json   TEXT NOT NULL DEFAULT ''
);
