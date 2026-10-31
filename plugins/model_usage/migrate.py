"""model_usage 插件旧库兼容迁移（由 manifest.db.migrate 声明）。

只处理 `model_usage_logs` 的历史结构升级：补四 token / 计算花销 / 实际花销 /
峰谷档位列，回填旧列，再按 SQLite 版本清理旧列。新库由同目录 schema.sql
直接建新结构，本迁移会快速返回。
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path

_SCHEMA_PATH = Path(__file__).with_name("schema.sql")


def _ensure_raw_live_json(conn: sqlite3.Connection) -> None:
    """为旧 model_usage_logs 补 raw_json/live_json（G2 日志表双列），并回填当前行。"""
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(model_usage_logs)")}
    if not cols:
        return
    added = False
    for column in ("raw_json", "live_json"):
        if column not in cols:
            conn.execute(f"ALTER TABLE model_usage_logs ADD COLUMN {column} TEXT NOT NULL DEFAULT ''")
            added = True
    if not added:
        return
    data_cols = [c for c in (r["name"] for r in conn.execute("PRAGMA table_info(model_usage_logs)"))
                 if c not in ("raw_json", "live_json")]
    rows = conn.execute(
        "SELECT id, " + ", ".join(data_cols) + " FROM model_usage_logs"
    ).fetchall()
    for row in rows:
        text = json.dumps({c: row[c] for c in data_cols}, ensure_ascii=False, default=str)
        conn.execute(
            "UPDATE model_usage_logs SET raw_json=?, live_json=? WHERE id=?",
            (text, text, row["id"]),
        )


def _supports_drop_column() -> bool:
    return sqlite3.sqlite_version_info >= (3, 35, 0)


def _rebuild_from_schema(conn: sqlite3.Connection) -> None:
    """SQLite <3.35 无 DROP COLUMN：按插件 schema.sql 重建并保留数据。"""
    legacy = f"model_usage_logs_legacy_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    for index in ("idx_model_usage_called_at", "idx_model_usage_conversation",
                  "idx_model_usage_feature", "idx_model_usage_model",
                  "idx_model_usage_currency"):
        conn.execute(f"DROP INDEX IF EXISTS {index}")
    conn.execute(f"ALTER TABLE model_usage_logs RENAME TO {legacy}")
    conn.executescript(_SCHEMA_PATH.read_text(encoding="utf-8"))
    new_cols = [r["name"] for r in conn.execute("PRAGMA table_info(model_usage_logs)")]
    old_cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({legacy})")}
    copy_cols = [c for c in new_cols if c in old_cols]
    conn.execute(
        f"INSERT INTO model_usage_logs ({', '.join(copy_cols)}) "
        f"SELECT {', '.join(copy_cols)} FROM {legacy}")
    conn.execute(f"DROP TABLE {legacy}")


def migrate(conn: sqlite3.Connection) -> None:
    """升级旧 model_usage_logs；新结构或表不存在时直接返回。"""
    _ensure_raw_live_json(conn)
    usage_cols = {r["name"] for r in conn.execute("PRAGMA table_info(model_usage_logs)")}
    if not usage_cols or "uncached_input_tokens" in usage_cols:
        return
    for column, ddl in (
        ("uncached_input_tokens", "INTEGER NOT NULL DEFAULT 0"),
        ("cache_read_tokens", "INTEGER NOT NULL DEFAULT 0"),
        ("cache_write_tokens", "INTEGER NOT NULL DEFAULT 0"),
        ("calculated_cost", "REAL NOT NULL DEFAULT 0"),
        ("actual_cost", "REAL NOT NULL DEFAULT 0"),
        ("price_tier", "TEXT NOT NULL DEFAULT 'offpeak'"),
    ):
        conn.execute(f"ALTER TABLE model_usage_logs ADD COLUMN {column} {ddl}")
    conn.execute(
        "UPDATE model_usage_logs SET uncached_input_tokens=COALESCE(input_tokens,0), "
        "cache_read_tokens=0, cache_write_tokens=0, "
        "calculated_cost=COALESCE(cost_amount,0), actual_cost=COALESCE(cost_amount,0), "
        "price_tier='offpeak'"
    )
    if _supports_drop_column():
        old_columns = [c for c in ("input_tokens", "total_tokens", "cost_amount")
                       if c in usage_cols]
        for column in old_columns:
            conn.execute(f"ALTER TABLE model_usage_logs DROP COLUMN {column}")
    else:
        _rebuild_from_schema(conn)
