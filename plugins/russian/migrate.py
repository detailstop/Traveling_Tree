"""russian 插件旧库兼容迁移。

由 manifest.db.migrate 声明，db/connection.py 在插件 schema 之后调用。
只做补列/回填/默认主题，不重复建表，幂等。
"""
from __future__ import annotations

import config


def _table_exists(conn, table: str) -> bool:
    return conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1", (table,)
    ).fetchone() is not None


def migrate(conn) -> None:
    if _table_exists(conn, "items"):
        cols = {r["name"] for r in conn.execute("PRAGMA table_info(items)")}
        if "tag" not in cols:
            conn.execute("ALTER TABLE items ADD COLUMN tag TEXT")
        conn.execute(
            "UPDATE items SET tag = COALESCE(NULLIF(theme, ''), substr(russian, 1, 12)) "
            "WHERE tag IS NULL OR tag = ''"
        )
    if _table_exists(conn, "themes"):
        tcols = {r["name"] for r in conn.execute("PRAGMA table_info(themes)")}
        if "default_type" not in tcols:
            conn.execute("ALTER TABLE themes ADD COLUMN default_type TEXT NOT NULL DEFAULT 'daily'")
        conn.execute(
            "UPDATE themes SET default_type='daily' WHERE default_type IS NULL OR default_type=''"
        )
        conn.execute(
            "INSERT OR IGNORE INTO themes (name, category, default_type) VALUES (?, 'daily', 'daily')",
            (config.DEFAULT_THEME,),
        )
    conn.commit()
