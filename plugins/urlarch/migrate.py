"""urlarch 表迁移：为旧表补 live_json，保留 raw_json 原始值；补白名单/组别表。

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
    " group_id TEXT NOT NULL DEFAULT '',"
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
    ("group_id", "TEXT NOT NULL DEFAULT ''"),
    ("raw_json", "TEXT NOT NULL DEFAULT ''"),
    ("live_json", "TEXT NOT NULL DEFAULT ''"),
    ("created_at", "TEXT NOT NULL DEFAULT ''"),
    ("updated_at", "TEXT NOT NULL DEFAULT ''"),
)
_SHORTCUTS_BUSINESS = (
    "id", "name", "path", "group_id", "args", "hotkey", "created_at", "updated_at",
)

_SHORTCUT_GROUPS_TABLE = "urlarch_shortcut_groups"
_SHORTCUT_GROUPS_DDL = (
    "CREATE TABLE IF NOT EXISTS urlarch_shortcut_groups ("
    " id TEXT PRIMARY KEY,"
    " name TEXT NOT NULL DEFAULT '',"
    " sort_order INTEGER NOT NULL DEFAULT 0,"
    " raw_json TEXT NOT NULL,"
    " live_json TEXT NOT NULL DEFAULT '',"
    " created_at TEXT NOT NULL,"
    " updated_at TEXT NOT NULL"
    ")"
)
_SHORTCUT_GROUPS_INDEX = (
    "CREATE INDEX IF NOT EXISTS idx_urlarch_shortcut_groups_sort "
    "ON urlarch_shortcut_groups(sort_order)"
)
_SHORTCUT_GROUPS_COLUMNS = (
    ("name", "TEXT NOT NULL DEFAULT ''"),
    ("sort_order", "INTEGER NOT NULL DEFAULT 0"),
    ("raw_json", "TEXT NOT NULL DEFAULT ''"),
    ("live_json", "TEXT NOT NULL DEFAULT ''"),
    ("created_at", "TEXT NOT NULL DEFAULT ''"),
    ("updated_at", "TEXT NOT NULL DEFAULT ''"),
)
_SHORTCUT_GROUPS_BUSINESS = ("id", "name", "sort_order", "created_at", "updated_at")


def _add_live_json(conn, table: str) -> None:
    cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
    if "live_json" not in cols:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN live_json TEXT NOT NULL DEFAULT ''")
    conn.execute(f"UPDATE {table} SET live_json=raw_json WHERE live_json IS NULL OR live_json=''")


def _backfill_raw_live(conn, table: str, business: tuple[str, ...]) -> None:
    """缺 raw/live 的行按当前列快照回填（无缺行时为 0 次更新）。"""
    rows = conn.execute(
        f"SELECT rowid AS _rid, {', '.join(business)} FROM {table} "
        "WHERE raw_json='' OR live_json=''"
    ).fetchall()
    for row in rows:
        payload = json.dumps({c: row[c] for c in business}, ensure_ascii=False, default=str)
        conn.execute(f"UPDATE {table} SET raw_json=?, live_json=? WHERE rowid=?",
                     (payload, payload, row["_rid"]))


def _ensure_shortcuts(conn) -> None:
    """建白名单表（缺失时）并补缺列/索引；重复执行无变更。

    round 101 起多补 group_id（旧数据默认空串 = 未分组）。
    """
    cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({_SHORTCUTS_TABLE})")}
    if not cols:
        conn.execute(_SHORTCUTS_DDL)
        cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({_SHORTCUTS_TABLE})")}
    for column, decl in _SHORTCUTS_COLUMNS:
        if column not in cols:
            conn.execute(f"ALTER TABLE {_SHORTCUTS_TABLE} ADD COLUMN {column} {decl}")
    conn.execute(_SHORTCUTS_INDEX)
    _backfill_raw_live(conn, _SHORTCUTS_TABLE, _SHORTCUTS_BUSINESS)


def _ensure_shortcut_groups(conn) -> None:
    """建软件快捷入口组别表（缺失时）并补缺列/索引；重复执行无变更。"""
    cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({_SHORTCUT_GROUPS_TABLE})")}
    if not cols:
        conn.execute(_SHORTCUT_GROUPS_DDL)
        cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({_SHORTCUT_GROUPS_TABLE})")}
    for column, decl in _SHORTCUT_GROUPS_COLUMNS:
        if column not in cols:
            conn.execute(f"ALTER TABLE {_SHORTCUT_GROUPS_TABLE} ADD COLUMN {column} {decl}")
    conn.execute(_SHORTCUT_GROUPS_INDEX)
    _backfill_raw_live(conn, _SHORTCUT_GROUPS_TABLE, _SHORTCUT_GROUPS_BUSINESS)


def migrate(conn) -> None:
    for table in ("urlarch_assets", "urlarch_groups", "urlarch_links"):
        _add_live_json(conn, table)
    _ensure_shortcuts(conn)
    _ensure_shortcut_groups(conn)
    conn.commit()
