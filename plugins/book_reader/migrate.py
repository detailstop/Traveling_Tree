"""book_reader 旧库兼容迁移（reader_* 补列/回填）。

由 manifest.db.migrate 声明；只补列，不重复建表。
"""
from __future__ import annotations

import sqlite3


def _supports_drop_column() -> bool:
    return sqlite3.sqlite_version_info >= (3, 35, 0)


def migrate(conn) -> None:
    reader_mark_cols = {r["name"] for r in conn.execute("PRAGMA table_info(reader_marks)")}
    if reader_mark_cols and "source" not in reader_mark_cols:
        conn.execute("ALTER TABLE reader_marks ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'")

    cleaning_task_cols = {r["name"] for r in conn.execute("PRAGMA table_info(reader_cleaning_tasks)")}
    for column in ("range_start", "range_end", "range_total"):
        if cleaning_task_cols and column not in cleaning_task_cols:
            conn.execute(f"ALTER TABLE reader_cleaning_tasks ADD COLUMN {column} INTEGER")

    for table in ("reader_words", "reader_phrases"):
        cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
        if cols and "memorize_round" not in cols:
            conn.execute(
                f"ALTER TABLE {table} ADD COLUMN memorize_round INTEGER NOT NULL DEFAULT 1")
        cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
        if cols and "learning_status" in cols and _supports_drop_column():
            conn.execute(f"ALTER TABLE {table} DROP COLUMN learning_status")
        if cols:
            conn.execute(
                f"UPDATE {table} SET memorize_round=1 "
                "WHERE memorize_round IS NULL OR memorize_round NOT IN (1,2,3,4)")
    for table in ("reader_words", "reader_phrases"):
        cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
        if cols and "stress" not in cols:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN stress INTEGER")
        if cols and "examples" not in cols:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN examples TEXT")
    for table in ("reader_words", "reader_phrases"):
        cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
        if cols and "export_selected" not in cols:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN export_selected INTEGER NOT NULL DEFAULT 0")
        if cols:
            conn.execute(
                f"UPDATE {table} SET export_selected=0 "
                "WHERE export_selected IS NULL OR export_selected NOT IN (0,1)")
    conn.commit()
