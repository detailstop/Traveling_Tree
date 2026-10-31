"""pixel_art 旧库迁移：补 raw_json/live_json（迁移时快照），幂等。

pixel_artworks：raw+live；pixel_asset_refs / visual_settings：仅 raw（豁免 live，可重建）。
"""
from __future__ import annotations

import json

_LIVE_TABLES = ("pixel_artworks",)
_RAW_ONLY_TABLES = ("pixel_asset_refs", "visual_settings")


def _add(conn, table: str, with_live: bool) -> None:
    cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
    if not cols:
        return
    for column in (("raw_json", "live_json") if with_live else ("raw_json",)):
        if column not in cols:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} TEXT NOT NULL DEFAULT ''")
    business = [c["name"] for c in conn.execute(f"PRAGMA table_info({table})")
                if c["name"] not in ("raw_json", "live_json")]
    where = "raw_json='' OR live_json=''" if with_live else "raw_json=''"
    rows = conn.execute(
        f"SELECT rowid AS _rid, {', '.join(business)} FROM {table} WHERE {where}"
    ).fetchall()
    for row in rows:
        payload = json.dumps({c: row[c] for c in business}, ensure_ascii=False, default=str)
        if with_live:
            conn.execute(f"UPDATE {table} SET raw_json=?, live_json=? WHERE rowid=?",
                         (payload, payload, row["_rid"]))
        else:
            conn.execute(f"UPDATE {table} SET raw_json=? WHERE rowid=?", (payload, row["_rid"]))


def migrate(conn) -> None:
    for table in _LIVE_TABLES:
        _add(conn, table, with_live=True)
    for table in _RAW_ONLY_TABLES:
        _add(conn, table, with_live=False)
    conn.commit()
