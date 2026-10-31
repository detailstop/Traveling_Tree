-- 插件市场安装记录（内容表：raw_json + live_json）
CREATE TABLE IF NOT EXISTS market_installed (
  id           TEXT PRIMARY KEY,
  version      TEXT NOT NULL DEFAULT '',
  source       TEXT NOT NULL DEFAULT 'local',
  installed_at TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'installed',
  raw_json     TEXT NOT NULL,
  live_json    TEXT NOT NULL DEFAULT ''
);
