-- pixel 插件表结构
-- 由 plugins/pixel_art/manifest.json 的 db.schema 声明；本文件为唯一建表源。
-- 禁用 modules.enabled.pixel_art 时由 db/connection.py 跳过本文件。

CREATE TABLE IF NOT EXISTS pixel_artworks (
  artwork_id TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  width      INTEGER NOT NULL,
  height     INTEGER NOT NULL,
  palette    TEXT NOT NULL DEFAULT '[]',
  pixels     TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  raw_json   TEXT NOT NULL DEFAULT '',
  live_json  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_pixel_artworks_updated ON pixel_artworks(updated_at DESC);

-- raw_json 为迁移时快照；live_json 豁免：资产引用索引可由作品/资产重建
CREATE TABLE IF NOT EXISTS pixel_asset_refs (
  ref_key    TEXT PRIMARY KEY,
  artwork_id TEXT REFERENCES pixel_artworks(artwork_id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL,
  raw_json   TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_pixel_asset_refs_artwork ON pixel_asset_refs(artwork_id);


-- 共享视觉设置：pixel_art 与 book_reader 都声明（CREATE IF NOT EXISTS 幂等）。
-- raw_json 为迁移时快照；live_json 豁免：视觉设置可按默认值重建
CREATE TABLE IF NOT EXISTS visual_settings (
  settings_key TEXT PRIMARY KEY,
  value        TEXT NOT NULL DEFAULT '{}',
  updated_at   TEXT NOT NULL,
  raw_json     TEXT NOT NULL DEFAULT ''
);
