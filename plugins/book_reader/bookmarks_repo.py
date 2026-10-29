"""book_reader 插件 SQL 层：书籍书签。"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from db.connection import get_conn

PREFIX = "rt_book_bm_"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _canon(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def load_bookmarks() -> dict:
    rows = get_conn().execute(
        "SELECT book_id, COALESCE(NULLIF(live_json,''), raw_json) AS raw_json FROM reader_bookmarks"
    ).fetchall()
    return {r["book_id"]: json.loads(r["raw_json"]) for r in rows}


def import_mark(book_id: str, raw: str) -> None:
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("书签必须是 JSON 对象")
    conn = get_conn()
    idx = data.get("index")
    conn.execute(
        "INSERT INTO reader_bookmarks(book_id,mark_id,sentence_index,raw_json,live_json,updated_at) "
        "VALUES(?,?,?,?,?,?) "
        "ON CONFLICT(book_id) DO UPDATE SET mark_id=excluded.mark_id, "
        "sentence_index=excluded.sentence_index, live_json=excluded.live_json, updated_at=excluded.updated_at",
        (book_id, str(data.get("id") or ""), int(idx) if isinstance(idx, (int, float)) else None,
         raw, raw, _now()),
    )
    conn.commit()


def save_mark(book_id: str, data: dict) -> None:
    import_mark(book_id, _canon(data))
