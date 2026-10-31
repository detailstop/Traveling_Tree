-- pm 模块
-- 由 db/schema.sql 按业务域拆分；db/schema/*.sql 为唯一建表源。
-- 表结构不得在此之外重复定义；禁用模块时由 db/connection.py 跳过本文件。

-- 项目管理器（PM v1）：模板快照、项目阶段、提示词草稿与阶段结果
CREATE TABLE IF NOT EXISTS pm_stage_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_index INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  prompt_template TEXT NOT NULL,
  variable_spec TEXT NOT NULL,
  summary_schema TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  raw_json TEXT NOT NULL DEFAULT '',
  live_json TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS pm_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  raw_json TEXT NOT NULL DEFAULT '',
  live_json TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS pm_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  template_id INTEGER NOT NULL,
  order_index INTEGER NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  prompt_template TEXT NOT NULL,
  variable_spec TEXT NOT NULL,
  summary_schema TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'empty',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  raw_json TEXT NOT NULL DEFAULT '',
  live_json TEXT NOT NULL DEFAULT '',
  UNIQUE(project_id, order_index)
);
CREATE TABLE IF NOT EXISTS pm_prompt_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stage_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  variables TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  raw_json TEXT NOT NULL DEFAULT '',
  live_json TEXT NOT NULL DEFAULT '',
  UNIQUE(stage_id, version)
);
CREATE TABLE IF NOT EXISTS pm_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stage_id INTEGER NOT NULL,
  prompt_draft_id INTEGER,
  context_header TEXT NOT NULL,
  body TEXT NOT NULL,
  summary_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  raw_json TEXT NOT NULL DEFAULT '',
  live_json TEXT NOT NULL DEFAULT ''
);
