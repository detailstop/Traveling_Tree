"""css_exp 表迁移：确保收藏表与索引存在，补齐缺列并回填 raw/live。

约定（同 urlarch/book_reader 等）：由 manifest.db.migrate 声明，init_db 在插件 schema
之后调用 migrate(conn)；全部为加性语句（IF NOT EXISTS / 缺列才 ALTER），不删除、
不改写既有数据，失败由 init_db 统一回滚。
"""
from __future__ import annotations

import json

_TABLE = "css_exp_favorites"
# 与 schema.sql 保持一致；旧库/被跳过建表时由此补齐。
_TABLE_DDL = (
    "CREATE TABLE IF NOT EXISTS css_exp_favorites ("
    " id TEXT PRIMARY KEY,"
    " title TEXT NOT NULL,"
    " category TEXT NOT NULL,"
    " made_by TEXT NOT NULL DEFAULT '',"
    " css TEXT NOT NULL DEFAULT '',"
    " html TEXT NOT NULL DEFAULT '',"
    " source_url TEXT NOT NULL DEFAULT '',"
    " raw_json TEXT NOT NULL,"
    " live_json TEXT NOT NULL DEFAULT '',"
    " created_at TEXT NOT NULL"
    ")"
)
_TABLE_INDEX = (
    "CREATE INDEX IF NOT EXISTS idx_css_exp_fav_url ON css_exp_favorites(source_url)"
)
# ALTER TABLE ADD COLUMN 的 NOT NULL 必须带默认值（SQLite 限制），故 title/category 在此给 ''。
_COLUMNS = (
    ("title", "TEXT NOT NULL DEFAULT ''"),
    ("category", "TEXT NOT NULL DEFAULT ''"),
    ("made_by", "TEXT NOT NULL DEFAULT ''"),
    ("css", "TEXT NOT NULL DEFAULT ''"),
    ("html", "TEXT NOT NULL DEFAULT ''"),
    ("source_url", "TEXT NOT NULL DEFAULT ''"),
    ("raw_json", "TEXT NOT NULL DEFAULT ''"),
    ("live_json", "TEXT NOT NULL DEFAULT ''"),
    ("created_at", "TEXT NOT NULL DEFAULT ''"),
)
_BUSINESS = ("id", "title", "category", "made_by", "css", "html", "source_url", "created_at")


def _backfill_raw_live(conn) -> None:
    """缺 raw/live 的行按当前列快照回填（无缺行时为 0 次更新）。"""
    rows = conn.execute(
        f"SELECT rowid AS _rid, {', '.join(_BUSINESS)} FROM {_TABLE} "
        "WHERE raw_json='' OR live_json=''"
    ).fetchall()
    for row in rows:
        payload = json.dumps({c: row[c] for c in _BUSINESS}, ensure_ascii=False, default=str)
        conn.execute(
            f"UPDATE {_TABLE} SET raw_json=?, live_json=? WHERE rowid=?",
            (payload, payload, row["_rid"]),
        )


def _ensure_favorites(conn) -> None:
    """建表（缺失时）并补缺列/索引；重复执行无变更。"""
    cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({_TABLE})")}
    if not cols:
        conn.execute(_TABLE_DDL)
        cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({_TABLE})")}
    for column, decl in _COLUMNS:
        if column not in cols:
            conn.execute(f"ALTER TABLE {_TABLE} ADD COLUMN {column} {decl}")
    conn.execute(_TABLE_INDEX)
    _backfill_raw_live(conn)


def migrate(conn) -> None:
    _ensure_favorites(conn)
    conn.commit()
