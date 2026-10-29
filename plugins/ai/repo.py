"""ai 插件 SQL 层：AI 状态与接口日志。"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from db.connection import get_conn

STATE_KEY = "rt_ai_state"
LOG_KEY = "rt_ai_txlog"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _canon(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def load_state():
    conn = get_conn()
    s = conn.execute(
        "SELECT COALESCE(NULLIF(live_json,''), raw_json) AS raw_json FROM ai_sessions WHERE session_key=?",
        (STATE_KEY,),
    ).fetchone()
    t = conn.execute(
        "SELECT COALESCE(NULLIF(live_json,''), raw_json) AS raw_json FROM ai_tx_logs WHERE log_key=?",
        (LOG_KEY,),
    ).fetchone()
    return {
        "state": json.loads(s["raw_json"]) if s else None,
        "txlog": json.loads(t["raw_json"]) if t else None,
    }


def _put(table: str, key_col: str, key: str, raw: str, live: str, extra_col: str = "", extra_val=None) -> None:
    conn = get_conn()
    if extra_col:
        conn.execute(
            f"INSERT INTO {table}({key_col},{extra_col},raw_json,live_json,updated_at) VALUES(?,?,?,?,?) "
            f"ON CONFLICT({key_col}) DO UPDATE SET {extra_col}=excluded.{extra_col}, "
            "live_json=excluded.live_json, updated_at=excluded.updated_at",
            (key, extra_val, raw, live, _now()),
        )
    else:
        conn.execute(
            f"INSERT INTO {table}({key_col},raw_json,live_json,updated_at) VALUES(?,?,?,?) "
            f"ON CONFLICT({key_col}) DO UPDATE SET live_json=excluded.live_json, updated_at=excluded.updated_at",
            (key, raw, live, _now()),
        )


def import_assets(state_raw: str, txlog_raw: str) -> dict:
    state = json.loads(state_raw)
    txlog = json.loads(txlog_raw)
    if not isinstance(state, dict) or not isinstance(txlog, dict):
        raise ValueError("AI 状态与日志必须是 JSON 对象")
    conn = get_conn()
    conn.execute("BEGIN IMMEDIATE")
    try:
        conn.execute(
            "INSERT INTO ai_sessions(session_key,tab,wsess_id,raw_json,live_json,updated_at) VALUES(?,?,?,?,?,?) "
            "ON CONFLICT(session_key) DO UPDATE SET tab=excluded.tab, wsess_id=excluded.wsess_id, "
            "live_json=excluded.live_json, updated_at=excluded.updated_at",
            (STATE_KEY, str(state.get("tab") or ""), state.get("wsessId"), state_raw, state_raw, _now()),
        )
        conn.execute(
            "INSERT INTO ai_tx_logs(log_key,raw_json,live_json,updated_at) VALUES(?,?,?,?) "
            "ON CONFLICT(log_key) DO UPDATE SET live_json=excluded.live_json, updated_at=excluded.updated_at",
            (LOG_KEY, txlog_raw, txlog_raw, _now()),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {"root": 2, "history_messages": sum(len(v) for v in (state.get("hist") or {}).values() if isinstance(v, list))}


def save_state(state: dict, txlog: dict) -> dict:
    state_raw = _canon(state)
    txlog_raw = _canon(txlog)
    conn = get_conn()
    conn.execute("BEGIN IMMEDIATE")
    try:
        conn.execute(
            "INSERT INTO ai_sessions(session_key,tab,wsess_id,raw_json,live_json,updated_at) VALUES(?,?,?,?,?,?) "
            "ON CONFLICT(session_key) DO UPDATE SET tab=excluded.tab, wsess_id=excluded.wsess_id, "
            "live_json=excluded.live_json, updated_at=excluded.updated_at",
            (STATE_KEY, str(state.get("tab") or ""), state.get("wsessId"), state_raw, state_raw, _now()),
        )
        conn.execute(
            "INSERT INTO ai_tx_logs(log_key,raw_json,live_json,updated_at) VALUES(?,?,?,?) "
            "ON CONFLICT(log_key) DO UPDATE SET live_json=excluded.live_json, updated_at=excluded.updated_at",
            (LOG_KEY, txlog_raw, txlog_raw, _now()),
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {"saved": 2}
