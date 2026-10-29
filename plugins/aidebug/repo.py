"""aidebug 插件 SQL 层：接口调试历史。"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from db.connection import get_conn

HISTORY_KEY = "rt_ai_debug"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _canon(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def load_state():
    row = get_conn().execute(
        "SELECT COALESCE(NULLIF(live_json,''), raw_json) AS raw_json FROM aidebug_history WHERE history_key=?",
        (HISTORY_KEY,),
    ).fetchone()
    return json.loads(row["raw_json"]) if row else None


def import_state(raw: str) -> dict:
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("rt_ai_debug 必须是 JSON 对象")
    conn = get_conn()
    conn.execute(
        "INSERT INTO aidebug_history(history_key,url,prompt,raw_text,json_text,raw_json,live_json,updated_at) "
        "VALUES(?,?,?,?,?,?,?,?) "
        "ON CONFLICT(history_key) DO UPDATE SET url=excluded.url, prompt=excluded.prompt, "
        "raw_text=excluded.raw_text, json_text=excluded.json_text, live_json=excluded.live_json, "
        "updated_at=excluded.updated_at",
        (HISTORY_KEY, str(data.get("url") or ""), str(data.get("prompt") or ""),
         str(data.get("raw") or ""), str(data.get("json") or ""), raw, raw, _now()),
    )
    conn.commit()
    return {"root": 1}


def save_state(data: dict) -> dict:
    raw = _canon(data)
    conn = get_conn()
    conn.execute(
        "INSERT INTO aidebug_history(history_key,url,prompt,raw_text,json_text,raw_json,live_json,updated_at) "
        "VALUES(?,?,?,?,?,?,?,?) "
        "ON CONFLICT(history_key) DO UPDATE SET url=excluded.url, prompt=excluded.prompt, "
        "raw_text=excluded.raw_text, json_text=excluded.json_text, live_json=excluded.live_json, "
        "updated_at=excluded.updated_at",
        (HISTORY_KEY, str(data.get("url") or ""), str(data.get("prompt") or ""),
         str(data.get("raw") or ""), str(data.get("json") or ""), raw, raw, _now()),
    )
    conn.commit()
    return {"saved": 1}
