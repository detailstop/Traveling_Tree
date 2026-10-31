"""project_manager 旧库迁移：补 raw_json/live_json（迁移时快照）并安装同步触发器。

5 张内容表均需双列：INSERT 填 raw/live，UPDATE 刷 live、保留 raw。
触发器不写入 schema.sql（旧库先补列，再由本迁移创建）。
"""
from __future__ import annotations

import json

_TABLES = ("pm_stage_templates", "pm_projects", "pm_stages", "pm_prompt_drafts", "pm_results")


def _drop_triggers(conn) -> None:
    for row in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_pm%'"
    ).fetchall():
        conn.execute(f"DROP TRIGGER IF EXISTS {row['name']}")


def _business_cols(conn, table: str) -> list[str]:
    return [c["name"] for c in conn.execute(f"PRAGMA table_info({table})")
            if c["name"] not in ("raw_json", "live_json")]


def _add_and_backfill(conn, table: str) -> None:
    cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
    if not cols:
        return
    for column in ("raw_json", "live_json"):
        if column not in cols:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} TEXT NOT NULL DEFAULT ''")
    business = _business_cols(conn, table)
    rows = conn.execute(
        f"SELECT rowid AS _rid, {', '.join(business)} FROM {table} "
        "WHERE raw_json='' OR live_json=''"
    ).fetchall()
    for row in rows:
        payload = json.dumps({c: row[c] for c in business}, ensure_ascii=False, default=str)
        conn.execute(f"UPDATE {table} SET raw_json=?, live_json=? WHERE rowid=?",
                     (payload, payload, row["_rid"]))


def _install_triggers(conn) -> None:
    for table in _TABLES:
        cols = _business_cols(conn, table)
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


def migrate(conn) -> None:
    _drop_triggers(conn)
    for table in _TABLES:
        _add_and_backfill(conn, table)
    _install_triggers(conn)
    conn.commit()
