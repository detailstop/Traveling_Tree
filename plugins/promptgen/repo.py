"""promptgen 插件 SQL 层：原始资产 + 工作流/模块/任务/组别。"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from db.connection import get_conn

ASSET_KEY = "rt_pg_v1"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _canon(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def load_state():
    row = get_conn().execute(
        "SELECT COALESCE(NULLIF(live_json, ''), raw_json) AS raw_json FROM pg_assets WHERE asset_key=?", (ASSET_KEY,)
    ).fetchone()
    return json.loads(row["raw_json"]) if row else None


def import_state(raw: str) -> dict:
    data = json.loads(raw)
    if not isinstance(data, dict) or not isinstance(data.get("flows"), list):
        raise ValueError("rt_pg_v1 必须是包含 flows 数组的对象")
    now = _now()
    conn = get_conn()
    conn.execute("BEGIN IMMEDIATE")
    try:
        conn.execute(
            "INSERT INTO pg_assets(asset_key, raw_json, live_json, schema_version, updated_at) VALUES(?,?,?,?,?) "
            "ON CONFLICT(asset_key) DO UPDATE SET live_json=excluded.live_json, "
            "schema_version=excluded.schema_version, updated_at=excluded.updated_at",
            (ASSET_KEY, raw, raw, int(data.get("schema") or 0), now),
        )
        conn.execute("DELETE FROM pg_flows")
        conn.execute("DELETE FROM pg_modules")
        conn.execute("DELETE FROM pg_tasks")
        conn.execute("DELETE FROM pg_flow_groups")
        for flow in data.get("flows") or []:
            if not isinstance(flow, dict) or not flow.get("id"):
                continue
            conn.execute(
                "INSERT INTO pg_flows(id,name,description,archived,created,updated,raw_json,live_json) "
                "VALUES(?,?,?,?,?,?,?,?)",
                (str(flow["id"]), str(flow.get("name") or ""), str(flow.get("desc") or flow.get("description") or ""),
                 1 if flow.get("archived") else 0, str(flow.get("created") or ""),
                 str(flow.get("updated") or ""), _canon(flow), _canon(flow)),
            )
        for mod in data.get("modules") or []:
            if not isinstance(mod, dict) or not mod.get("id"):
                continue
            conn.execute(
                "INSERT INTO pg_modules(id,name,description,raw_json,live_json) VALUES(?,?,?,?,?)",
                (str(mod["id"]), str(mod.get("name") or ""), str(mod.get("desc") or mod.get("description") or ""),
                 _canon(mod), _canon(mod)),
            )
        for task in data.get("tasks") or []:
            if not isinstance(task, dict) or not task.get("id"):
                continue
            conn.execute(
                "INSERT INTO pg_tasks(id,name,raw_json,live_json) VALUES(?,?,?,?)",
                (str(task["id"]), str(task.get("name") or task.get("title") or ""), _canon(task), _canon(task)),
            )
        for group in data.get("flowGroups") or []:
            if not isinstance(group, dict) or not group.get("id"):
                continue
            conn.execute(
                "INSERT INTO pg_flow_groups(id,name,order_index,raw_json,live_json) VALUES(?,?,?,?,?)",
                (str(group["id"]), str(group.get("name") or ""),
                 int(group.get("order") or 0), _canon(group), _canon(group)),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {
        "root": 1,
        "flows": len(data.get("flows") or []),
        "modules": len(data.get("modules") or []),
        "tasks": len(data.get("tasks") or []),
        "flow_groups": len(data.get("flowGroups") or []),
    }


def save_state(data: dict) -> dict:
    return import_state(_canon(data))
