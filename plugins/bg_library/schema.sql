-- bg 模块
-- 由 db/schema.sql 按业务域拆分；db/schema/*.sql 为唯一建表源。
-- 表结构不得在此之外重复定义；禁用模块时由 db/connection.py 跳过本文件。

-- ============================================================
-- 功能背景信息库（项目优化与当前综述）
-- ============================================================
CREATE TABLE IF NOT EXISTS bg_nodes (
  id          TEXT PRIMARY KEY,
  parent_id   TEXT,
  path        TEXT NOT NULL,
  node_type   TEXT NOT NULL CHECK(node_type IN ('project','module','feature','flow','interface','other')),
  name        TEXT NOT NULL,
  status      TEXT NOT NULL CHECK(status IN ('planned','active','deprecated','broken','unknown')),
  summary     TEXT NOT NULL DEFAULT '',
  payload     TEXT NOT NULL DEFAULT '{}',
  version_tag TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'import' CHECK(source IN ('import','manual')),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bg_nodes_parent ON bg_nodes(parent_id, path);
CREATE INDEX IF NOT EXISTS idx_bg_nodes_status ON bg_nodes(status);

CREATE TABLE IF NOT EXISTS bg_versions (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  kind      TEXT NOT NULL CHECK(kind IN ('import','manual')),
  mode      TEXT NOT NULL,
  node_id   TEXT,
  summary   TEXT NOT NULL DEFAULT '',
  data      TEXT NOT NULL DEFAULT '{}',
  at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bg_versions_at ON bg_versions(at DESC);
CREATE INDEX IF NOT EXISTS idx_bg_versions_node ON bg_versions(node_id);

-- file_notes 模块
-- 由 db/schema.sql 按业务域拆分；db/schema/*.sql 为唯一建表源。
-- 表结构不得在此之外重复定义；禁用模块时由 db/connection.py 跳过本文件。

-- ============================================================
-- 文件预览与说明卡片（项目优化与当前综述）
-- 只存说明元数据，不写源码文件；路径均为工作区相对 POSIX 路径。
-- ============================================================
CREATE TABLE IF NOT EXISTS file_notes (
  path       TEXT PRIMARY KEY,
  feature    TEXT NOT NULL DEFAULT '',   -- 关联背景节点 / 涉及功能
  details    TEXT NOT NULL DEFAULT '',   -- 细节说明
  rules      TEXT NOT NULL DEFAULT '',   -- 规则 / 约束
  source     TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('suggested','manual')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS db_rules (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  db_path        TEXT NOT NULL,          -- 数据库文件相对路径
  table_name     TEXT NOT NULL,
  key_fields     TEXT NOT NULL DEFAULT '', -- 关键字段 / 含义
  writers        TEXT NOT NULL DEFAULT '', -- 写入方
  readers        TEXT NOT NULL DEFAULT '', -- 读方
  migration_rule TEXT NOT NULL DEFAULT '', -- 更新 / 迁移规则
  version        TEXT NOT NULL DEFAULT '', -- 版本或更新时间说明
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  UNIQUE(db_path, table_name)
);
CREATE INDEX IF NOT EXISTS idx_db_rules_db_path ON db_rules(db_path);
CREATE INDEX IF NOT EXISTS idx_file_notes_updated ON file_notes(updated_at DESC);
