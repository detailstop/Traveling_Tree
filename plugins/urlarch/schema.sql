-- urlarch 内容资产（含原始 JSON 兜底）

CREATE TABLE IF NOT EXISTS urlarch_assets (
  asset_key  TEXT PRIMARY KEY,
  raw_json   TEXT NOT NULL,
  live_json  TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS urlarch_groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT '',
  group_type  TEXT NOT NULL DEFAULT 'normal',
  order_index INTEGER NOT NULL DEFAULT 0,
  raw_json    TEXT NOT NULL,
  live_json   TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS urlarch_links (
  link_id    TEXT PRIMARY KEY,
  title      TEXT NOT NULL DEFAULT '',
  url        TEXT NOT NULL,
  note       TEXT NOT NULL DEFAULT '',
  ts         TEXT NOT NULL DEFAULT '',
  group_id   TEXT NOT NULL DEFAULT 'ungrouped',
  raw_json   TEXT NOT NULL,
  live_json  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_urlarch_links_group ON urlarch_links(group_id);
