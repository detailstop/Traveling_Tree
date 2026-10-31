"""urlarch 表迁移：为旧表补 live_json，保留 raw_json 原始值。"""
from __future__ import annotations


def _add_live_json(conn, table: str) -> None:
    cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
    if "live_json" not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN live_json TEXT NOT NULL DEFAULT ''")
    conn.execute(f"UPDATE {table} SET live_json=raw_json WHERE live_json IS NULL OR live_json=''")


def migrate(conn) -> None:
    for table in ("urlarch_assets", "urlarch_groups", "urlarch_links"):
        _add_live_json(conn, table)
    conn.commit()
