-- schedule 内容资产（含原始 JSON 兜底）

CREATE TABLE IF NOT EXISTS schedule_assets (
  asset_key  TEXT PRIMARY KEY,
  raw_json   TEXT NOT NULL,
  live_json  TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule_week_plans (
  week_key   TEXT PRIMARY KEY,
  raw_json   TEXT NOT NULL,
  live_json  TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule_tasks (
  task_id    TEXT NOT NULL,
  week_key   TEXT NOT NULL,
  day_key    TEXT NOT NULL,
  title      TEXT NOT NULL DEFAULT '',
  note       TEXT NOT NULL DEFAULT '',
  done       INTEGER NOT NULL DEFAULT 0,
  raw_json   TEXT NOT NULL,
  live_json  TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (task_id, week_key, day_key)
);
CREATE INDEX IF NOT EXISTS idx_schedule_tasks_week ON schedule_tasks(week_key, day_key);
