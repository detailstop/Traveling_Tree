-- model_usage 插件表结构
-- 由 plugins/model_usage/manifest.json 的 db.schema 声明；本文件为唯一建表源。
-- 禁用 modules.enabled.model_usage 时由 db/connection.py 跳过本文件。

-- ============================================================
-- 模型用量与消费（新增，只增不改旧表）
-- 独立记录表：与记账本、SRS、词库等既有数据无外键、无写入关联。
-- ============================================================
CREATE TABLE IF NOT EXISTS model_usage_logs (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  called_at            TEXT    NOT NULL,               -- 莫斯科本地调用时间 YYYY-MM-DD HH:MM:SS
  conversation_label   TEXT    NOT NULL,               -- 对话标签（自由文本）
  turn_index           INTEGER NOT NULL CHECK(turn_index > 0),  -- 对话内序号（正整数）
  feature_label        TEXT    NOT NULL,               -- 功能/用途标签（自由文本）
  model_name           TEXT    NOT NULL,               -- 标准模型名（来自价目配置）
  uncached_input_tokens INTEGER NOT NULL CHECK(uncached_input_tokens >= 0),
  cache_read_tokens    INTEGER NOT NULL CHECK(cache_read_tokens >= 0),
  cache_write_tokens   INTEGER NOT NULL CHECK(cache_write_tokens >= 0),
  output_tokens        INTEGER NOT NULL CHECK(output_tokens >= 0),
  calculated_cost      REAL    NOT NULL CHECK(calculated_cost >= 0),
  actual_cost          REAL    NOT NULL CHECK(actual_cost >= 0),
  price_tier           TEXT    NOT NULL CHECK(price_tier IN ('peak','offpeak')),
  currency             TEXT    NOT NULL DEFAULT 'CNY',
  interval_seconds     INTEGER CHECK(interval_seconds IS NULL OR interval_seconds >= 0),
  created_at           TEXT    NOT NULL,
  updated_at           TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_model_usage_called_at ON model_usage_logs(called_at);
CREATE INDEX IF NOT EXISTS idx_model_usage_conversation ON model_usage_logs(conversation_label);
CREATE INDEX IF NOT EXISTS idx_model_usage_feature ON model_usage_logs(feature_label);
CREATE INDEX IF NOT EXISTS idx_model_usage_model ON model_usage_logs(model_name);
CREATE INDEX IF NOT EXISTS idx_model_usage_currency ON model_usage_logs(currency);
