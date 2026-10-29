"""schedule 插件 SQL 层：原始周计划资产 + 周/任务。"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from db.connection import get_conn

ASSET_KEY = "rt_week_plan"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _canon(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def load_state():
    row = get_conn().execute(
        "SELECT COALESCE(NULLIF(live_json, ''), raw_json) AS raw_json FROM schedule_assets WHERE asset_key=?", (ASSET_KEY,)
    ).fetchone()
    return json.loads(row["raw_json"]) if row else None


def import_state(raw: str) -> dict:
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("rt_week_plan 必须是对象")
    now = _now()
    conn = get_conn()
    conn.execute("BEGIN IMMEDIATE")
    try:
        conn.execute(
            "INSERT INTO schedule_assets(asset_key, raw_json, live_json, updated_at) VALUES(?,?,?,?) "
            "ON CONFLICT(asset_key) DO UPDATE SET live_json=excluded.live_json, updated_at=excluded.updated_at",
            (ASSET_KEY, raw, raw, now),
        )
        conn.execute("DELETE FROM schedule_week_plans")
        conn.execute("DELETE FROM schedule_tasks")
        weeks = 0
        tasks = 0
        for week_key, plan in data.items():
            if not isinstance(plan, dict):
                continue
            weeks += 1
            conn.execute(
                "INSERT INTO schedule_week_plans(week_key,raw_json,updated_at) VALUES(?,?,?)",
                (str(week_key), _canon(plan), now),
            )
            for day_key, arr in plan.items():
                if not isinstance(arr, list):
                    continue
                for idx, task in enumerate(arr):
                    if not isinstance(task, dict):
                        continue
                    task_id = str(task.get("id") or f"{week_key}:{day_key}:{idx}")
                    conn.execute(
                        "INSERT OR REPLACE INTO schedule_tasks(task_id,week_key,day_key,title,note,done,raw_json) "
                        "VALUES(?,?,?,?,?,?,?)",
                        (task_id, str(week_key), str(day_key), str(task.get("t") or ""),
                         str(task.get("note") or ""), 1 if task.get("done") else 0, _canon(task)),
                    )
                    tasks += 1
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {"root": 1, "weeks": weeks, "tasks": tasks}


def save_state(data: dict) -> dict:
    return import_state(_canon(data))
