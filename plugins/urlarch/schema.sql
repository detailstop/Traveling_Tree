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
  image      TEXT NOT NULL DEFAULT '',
  raw_json   TEXT NOT NULL,
  live_json  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_urlarch_links_group ON urlarch_links(group_id);

-- 白名单：用户登记的本地软件快捷方式（R4 轮启动能力的数据层）。
-- 数据落在本机 SQLite（data/ 下），不进 Git；软件入口按组别展示、点击卡片启动。
-- 内容表：raw_json 为登记时快照，live_json 由 SQL 层显式双写（与本插件其余三表一致，不建触发器）；
-- 白名单是用户登记数据、无法重建，故不豁免 live_json。
-- group_id 为空字符串表示「未分组」（round 101 新增，旧数据迁移后默认空串）。
-- image 为卡片图片文件名（round 105 新增，空串 = 无图；图片文件落 data/plugins/urlarch/images/）。
CREATE TABLE IF NOT EXISTS urlarch_shortcuts (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT '',
  path       TEXT NOT NULL,
  args       TEXT NOT NULL DEFAULT '[]',
  hotkey     TEXT NOT NULL DEFAULT '',
  group_id   TEXT NOT NULL DEFAULT '',
  image      TEXT NOT NULL DEFAULT '',
  raw_json   TEXT NOT NULL,
  live_json  TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_urlarch_shortcuts_hotkey ON urlarch_shortcuts(hotkey);

-- 软件快捷入口的组别（round 101）。内容表，同口径双写 raw/live；
-- 组别删除时组内条目的 group_id 置空串（由 SQL 层处理），条目不删。
CREATE TABLE IF NOT EXISTS urlarch_shortcut_groups (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  raw_json   TEXT NOT NULL,
  live_json  TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_urlarch_shortcut_groups_sort ON urlarch_shortcut_groups(sort_order);
