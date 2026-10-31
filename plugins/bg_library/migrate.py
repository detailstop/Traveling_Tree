"""bg_library 旧库迁移：补 raw_json/live_json（迁移时当前状态快照），幂等。

raw_json 为迁移时快照，非历史原文；live_json 初始等于 raw_json。
"""
from __future__ import annotations

import json

_TABLES = ("bg_nodes", "bg_versions", "file_notes", "db_rules")


def _add_raw_live(conn, table: str) -> None:
    cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
    if not cols:
        return
    added = False
    for column in ("raw_json", "live_json"):
        if column not in cols:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} TEXT NOT NULL DEFAULT ''")
            added = True
    business = [c["name"] for c in conn.execute(f"PRAGMA table_info({table})")
                if c["name"] not in ("raw_json", "live_json")]
    rows = conn.execute(
        f"SELECT rowid AS _rid, {', '.join(business)} FROM {table} WHERE raw_json='' OR live_json=''"
    ).fetchall()
    for row in rows:
        payload = json.dumps({c: row[c] for c in business}, ensure_ascii=False, default=str)
        conn.execute(
            f"UPDATE {table} SET raw_json=?, live_json=? WHERE rowid=?",
            (payload, payload, row["_rid"]),
        )


def migrate(conn) -> None:
    for table in _TABLES:
        _add_raw_live(conn, table)
    conn.commit()
