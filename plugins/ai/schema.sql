-- ai 插件内容资产（AI 历史 / 接口日志）

CREATE TABLE IF NOT EXISTS ai_sessions (
  session_key TEXT PRIMARY KEY,
  tab         TEXT NOT NULL DEFAULT '',
  wsess_id    TEXT,
  raw_json    TEXT NOT NULL,
  live_json   TEXT NOT NULL DEFAULT '',
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_tx_logs (
  log_key    TEXT PRIMARY KEY,
  raw_json   TEXT NOT NULL,
  live_json  TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
