"""russian 插件旧库兼容迁移。

由 manifest.db.migrate 声明，db/connection.py 在插件 schema 之后调用。
只做补列/回填/默认主题，不重复建表，幂等。
"""
from __future__ import annotations

import json

import config


def _table_exists(conn, table: str) -> bool:
    return conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1", (table,)
    ).fetchone() is not None


def _add_raw_live(conn, table: str, with_live: bool = True) -> None:
    """补 raw_json（及可选 live_json），按当前行生成 JSON 快照回填；幂等。"""
    if not _table_exists(conn, table):
        return
    cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
    added = False
    for column in (("raw_json", "live_json") if with_live else ("raw_json",)):
        if column not in cols:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} TEXT NOT NULL DEFAULT ''")
            added = True
    business = [c["name"] for c in conn.execute(f"PRAGMA table_info({table})")
                if c["name"] not in ("raw_json", "live_json")]
    where = "raw_json='' OR live_json=''" if with_live else "raw_json=''"
    rows = conn.execute(
        f"SELECT rowid AS _rid, {', '.join(business)} FROM {table} WHERE {where}"
    ).fetchall()
    if not rows:
        return
    for row in rows:
        payload = json.dumps({c: row[c] for c in business}, ensure_ascii=False, default=str)
        if with_live:
            conn.execute(f"UPDATE {table} SET raw_json=?, live_json=? WHERE rowid=?",
                         (payload, payload, row["_rid"]))
        else:
            conn.execute(f"UPDATE {table} SET raw_json=? WHERE rowid=?", (payload, row["_rid"]))


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
    for table in ("items", "themes", "review_logs", "daily_logs"):
        _add_raw_live(conn, table, with_live=True)
    _add_raw_live(conn, "item_stats", with_live=False)
    conn.commit()
