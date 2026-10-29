-- aidebug 接口调试历史

CREATE TABLE IF NOT EXISTS aidebug_history (
  history_key TEXT PRIMARY KEY,
  url         TEXT NOT NULL DEFAULT '',
  prompt      TEXT NOT NULL DEFAULT '',
  raw_text    TEXT NOT NULL DEFAULT '',
  json_text   TEXT NOT NULL DEFAULT '',
  raw_json    TEXT NOT NULL,
  live_json   TEXT NOT NULL DEFAULT '',
  updated_at  TEXT NOT NULL
);
