"""screeps 插件 SQL 层：原始工作区资产 + 单位/模块。"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from db.connection import get_conn

ASSET_KEY = "sc_sas_workspace_v1"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _canon(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def load_state():
    row = get_conn().execute(
        "SELECT COALESCE(NULLIF(live_json, ''), raw_json) AS raw_json FROM screeps_assets WHERE asset_key=?", (ASSET_KEY,)
    ).fetchone()
    return json.loads(row["raw_json"]) if row else None


def import_state(raw: str) -> dict:
    data = json.loads(raw)
    if not isinstance(data, dict) or not isinstance(data.get("units"), list):
        raise ValueError("sc_sas_workspace_v1 必须包含 units 数组")
    now = _now()
    conn = get_conn()
    conn.execute("BEGIN IMMEDIATE")
    try:
        conn.execute(
            "INSERT INTO screeps_assets(asset_key,raw_json,live_json,updated_at) VALUES(?,?,?,?) "
            "ON CONFLICT(asset_key) DO UPDATE SET live_json=excluded.live_json, updated_at=excluded.updated_at",
            (ASSET_KEY, raw, raw, now),
        )
        conn.execute("DELETE FROM screeps_units")
        conn.execute("DELETE FROM screeps_modules")
        units = 0
        modules = 0
        for unit in data.get("units") or []:
            if not isinstance(unit, dict) or not unit.get("id"):
                continue
            conn.execute(
                "INSERT INTO screeps_units(id,name,role_name,raw_json,live_json) VALUES(?,?,?,?,?)",
                (str(unit["id"]), str(unit.get("name") or ""),
                 str(unit.get("roleName") or ""), _canon(unit), _canon(unit)),
            )
            units += 1
        for path, content in (data.get("modules") or {}).items():
            conn.execute(
                "INSERT INTO screeps_modules(path,content,raw_json,live_json) VALUES(?,?,?,?)",
                (str(path), str(content or ""), _canon({"path": path, "content": content}),
                 _canon({"path": path, "content": content})),
            )
            modules += 1
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {"root": 1, "units": units, "modules": modules}


def save_state(data: dict) -> dict:
    return import_state(_canon(data))
