"""urlarch 表迁移：为旧表补 live_json，保留 raw_json 原始值；补白名单表。

约定（同 book_reader/finance/project_manager）：由 manifest.db.migrate 声明，
init_db 在插件 schema 之后调用 migrate(conn)；全部为加性语句（IF NOT EXISTS /
缺列才 ALTER），不删除、不改写既有数据，失败由 init_db 统一回滚。
"""
from __future__ import annotations

import json

_SHORTCUTS_TABLE = "urlarch_shortcuts"
# 与 schema.sql 保持一致；旧库/被跳过建表时由此补齐。
_SHORTCUTS_DDL = (
    "CREATE TABLE IF NOT EXISTS urlarch_shortcuts ("
    " id TEXT PRIMARY KEY,"
    " name TEXT NOT NULL DEFAULT '',"
    " path TEXT NOT NULL,"
    " args TEXT NOT NULL DEFAULT '[]',"
    " hotkey TEXT NOT NULL DEFAULT '',"
    " raw_json TEXT NOT NULL,"
    " live_json TEXT NOT NULL DEFAULT '',"
    " created_at TEXT NOT NULL,"
    " updated_at TEXT NOT NULL"
    ")"
)
_SHORTCUTS_INDEX = (
    "CREATE INDEX IF NOT EXISTS idx_urlarch_shortcuts_hotkey ON urlarch_shortcuts(hotkey)"
)
# ALTER TABLE ADD COLUMN 的 NOT NULL 必须带默认值（SQLite 限制），故 path 在此给 ''。
_SHORTCUTS_COLUMNS = (
    ("name", "TEXT NOT NULL DEFAULT ''"),
    ("path", "TEXT NOT NULL DEFAULT ''"),
    ("args", "TEXT NOT NULL DEFAULT '[]'"),
    ("hotkey", "TEXT NOT NULL DEFAULT ''"),
    ("raw_json", "TEXT NOT NULL DEFAULT ''"),
    ("live_json", "TEXT NOT NULL DEFAULT ''"),
    ("created_at", "TEXT NOT NULL DEFAULT ''"),
    ("updated_at", "TEXT NOT NULL DEFAULT ''"),
)
_SHORTCUTS_BUSINESS = ("id", "name", "path", "args", "hotkey", "created_at", "updated_at")


def _add_live_json(conn, table: str) -> None:
    cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
    if "live_json" not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN live_json TEXT NOT NULL DEFAULT ''")
    conn.execute(f"UPDATE {table} SET live_json=raw_json WHERE live_json IS NULL OR live_json=''")


def _ensure_shortcuts(conn) -> None:
    """建白名单表（缺失时）并补缺列/索引；重复执行无变更。"""
    cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({_SHORTCUTS_TABLE})")}
    if not cols:
        conn.execute(_SHORTCUTS_DDL)
        cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({_SHORTCUTS_TABLE})")}
    for column, decl in _SHORTCUTS_COLUMNS:
        if column not in cols:
            conn.execute(f"ALTER TABLE {_SHORTCUTS_TABLE} ADD COLUMN {column} {decl}")
    conn.execute(_SHORTCUTS_INDEX)
    rows = conn.execute(
        f"SELECT rowid AS _rid, {', '.join(_SHORTCUTS_BUSINESS)} FROM {_SHORTCUTS_TABLE} "
        "WHERE raw_json='' OR live_json=''"
    ).fetchall()
    for row in rows:
        payload = json.dumps({c: row[c] for c in _SHORTCUTS_BUSINESS},
                             ensure_ascii=False, default=str)
        conn.execute(f"UPDATE {_SHORTCUTS_TABLE} SET raw_json=?, live_json=? WHERE rowid=?",
                     (payload, payload, row["_rid"]))


def migrate(conn) -> None:
    for table in ("urlarch_assets", "urlarch_groups", "urlarch_links"):
        _add_live_json(conn, table)
    _ensure_shortcuts(conn)
    conn.commit()
