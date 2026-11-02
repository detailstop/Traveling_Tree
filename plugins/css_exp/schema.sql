-- css_exp（CSS 动效组件库）内容表：用户收藏的外部组件代码。
-- 外部项目 AWA UI（MIT）为只读静态产物，本表只保存用户主动收藏的条目快照。
-- 内容表：raw_json 为收藏时快照（不可重建），live_json 由 SQL 层显式双写（不建触发器）。

CREATE TABLE IF NOT EXISTS css_exp_favorites (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  category   TEXT NOT NULL,
  made_by    TEXT NOT NULL DEFAULT '',
  css        TEXT NOT NULL DEFAULT '',
  html       TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  raw_json   TEXT NOT NULL,
  live_json  TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_css_exp_fav_url ON css_exp_favorites(source_url);
