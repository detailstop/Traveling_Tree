"""urlarch 表迁移：为旧表补 live_json，保留 raw_json 原始值。"""
from __future__ import annotations


def migrate(conn) -> None:
    cols = {r["name"] for r in conn.execute("PRAGMA table_info(urlarch_assets)")}
    if "live_json" not in cols:
        conn.execute("ALTER TABLE urlarch_assets ADD COLUMN live_json TEXT NOT NULL DEFAULT ''")
    conn.execute("UPDATE urlarch_assets SET live_json=raw_json WHERE live_json IS NULL OR live_json=''")
    conn.commit()
