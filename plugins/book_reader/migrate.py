"""book_reader 旧库兼容迁移（reader_* 补列/回填）。

由 manifest.db.migrate 声明；只补列，不重复建表。
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

_SCHEMA_PATH = Path(__file__).with_name("schema.sql")

_JSON_TABLES = (
    "reader_books", "reader_sections", "reader_sentences", "reader_words",
    "reader_phrases", "reader_translation_pairs", "reader_marks",
    "reader_import_batches", "reader_cleaning_tasks", "reader_cleaning_records",
    "reader_return_errors",
)


def _add_raw_live(conn) -> None:
    """补 raw_json/live_json 并按当前行回填（raw 为迁移时快照，live=raw）。"""
    for table in _JSON_TABLES:
        cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
        if not cols:
            continue
        for column in ("raw_json", "live_json"):
            if column not in cols:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} TEXT NOT NULL DEFAULT ''")
        business = [c["name"] for c in conn.execute(f"PRAGMA table_info({table})")
                    if c["name"] not in ("raw_json", "live_json")]
        rows = conn.execute(
            f"SELECT rowid AS _rid, {', '.join(business)} FROM {table} "
            "WHERE raw_json='' OR live_json=''"
        ).fetchall()
        for row in rows:
            payload = json.dumps({c: row[c] for c in business}, ensure_ascii=False, default=str)
            conn.execute(f"UPDATE {table} SET raw_json=?, live_json=? WHERE rowid=?",
                         (payload, payload, row["_rid"]))


def _drop_json_triggers(conn) -> None:
    for row in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_reader%'"
    ).fetchall():
        conn.execute(f"DROP TRIGGER IF EXISTS {row['name']}")


def _install_triggers(conn) -> None:
    """按当前列安装 JSON 同步触发器（raw=插入快照，live=当前状态）。"""
    for table in _JSON_TABLES:
        cols = [c["name"] for c in conn.execute(f"PRAGMA table_info({table})")
                if c["name"] not in ("raw_json", "live_json")]
        if not cols:
            continue
        j = "json_object(" + ", ".join(f"'{c}', NEW.{c}" for c in cols) + ")"
        conn.execute(
            f"CREATE TRIGGER IF NOT EXISTS trg_{table}_json_ins AFTER INSERT ON {table} BEGIN "
            f"UPDATE {table} SET raw_json={j}, live_json={j} WHERE rowid=NEW.rowid; END"
        )
        conn.execute(
            f"CREATE TRIGGER IF NOT EXISTS trg_{table}_json_upd AFTER UPDATE ON {table} BEGIN "
            f"UPDATE {table} SET live_json={j} WHERE rowid=NEW.rowid; END"
        )


def _supports_drop_column() -> bool:
    return sqlite3.sqlite_version_info >= (3, 35, 0)


def migrate(conn) -> None:
    _drop_json_triggers(conn)
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
    _add_raw_live(conn)
    _install_triggers(conn)
    conn.commit()
