-- screeps 内容资产（含原始 JSON 兜底）

CREATE TABLE IF NOT EXISTS screeps_assets (
  asset_key  TEXT PRIMARY KEY,
  raw_json   TEXT NOT NULL,
  live_json  TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS screeps_units (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT '',
  role_name  TEXT NOT NULL DEFAULT '',
  raw_json   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS screeps_modules (
  path       TEXT PRIMARY KEY,
  content    TEXT NOT NULL DEFAULT '',
  raw_json   TEXT NOT NULL
);
