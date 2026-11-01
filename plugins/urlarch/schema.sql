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

-- 白名单：用户登记的本地软件快捷方式（R4 轮启动能力的数据层）。
-- 本轮只有表，不含任何读写/启动逻辑；数据落在本机 SQLite（data/ 下），不进 Git。
-- 内容表：raw_json 为登记时快照，live_json 由 SQL 层显式双写（与本插件其余三表一致，不建触发器）；
-- 白名单是用户登记数据、无法重建，故不豁免 live_json。
CREATE TABLE IF NOT EXISTS urlarch_shortcuts (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT '',
  path       TEXT NOT NULL,
  args       TEXT NOT NULL DEFAULT '[]',
  hotkey     TEXT NOT NULL DEFAULT '',
  raw_json   TEXT NOT NULL,
  live_json  TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_urlarch_shortcuts_hotkey ON urlarch_shortcuts(hotkey);
