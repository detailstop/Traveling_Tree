"""urlarch 插件 SQL 层：原始网址库资产 + 组别/链接。"""
from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from db.connection import get_conn

ASSET_KEY = "url_archive_v1"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _canon(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _link_id(group_id: str, idx: int, url: str) -> str:
    digest = hashlib.sha1(f"{group_id}\0{idx}\0{url}".encode("utf-8")).hexdigest()[:16]
    return "ua_" + digest


def load_state():
    row = get_conn().execute(
        "SELECT COALESCE(NULLIF(live_json, ''), raw_json) AS raw_json FROM urlarch_assets WHERE asset_key=?", (ASSET_KEY,)
    ).fetchone()
    return json.loads(row["raw_json"]) if row else None


def import_state(raw: str) -> dict:
    data = json.loads(raw)
    if not isinstance(data, dict) or not isinstance(data.get("groups"), list) \
            or not isinstance(data.get("items"), list):
        raise ValueError("url_archive_v1 必须包含 groups/items 数组")
    now = _now()
    conn = get_conn()
    conn.execute("BEGIN IMMEDIATE")
    try:
        conn.execute(
            "INSERT INTO urlarch_assets(asset_key,raw_json,live_json,updated_at) VALUES(?,?,?,?) "
            "ON CONFLICT(asset_key) DO UPDATE SET live_json=excluded.live_json, updated_at=excluded.updated_at",
            (ASSET_KEY, raw, raw, now),
        )
        conn.execute("DELETE FROM urlarch_groups")
        conn.execute("DELETE FROM urlarch_links")
        groups = 0
        links = 0
        for group in data.get("groups") or []:
            if not isinstance(group, dict) or not group.get("id"):
                continue
            conn.execute(
                "INSERT INTO urlarch_groups(id,name,group_type,order_index,raw_json,live_json) VALUES(?,?,?,?,?,?)",
                (str(group["id"]), str(group.get("name") or ""),
                 str(group.get("type") or "normal"), int(group.get("order") or 0), _canon(group), _canon(group)),
            )
            groups += 1
        for idx, item in enumerate(data.get("items") or []):
            if not isinstance(item, dict) or not item.get("url"):
                continue
            group_id = str(item.get("groupId") or "ungrouped")
            conn.execute(
                "INSERT INTO urlarch_links(link_id,title,url,note,ts,group_id,raw_json,live_json) "
                "VALUES(?,?,?,?,?,?,?,?)",
                (_link_id(group_id, idx, str(item["url"])), str(item.get("title") or ""),
                 str(item["url"]), str(item.get("note") or ""), str(item.get("ts") or ""),
                 group_id, _canon(item), _canon(item)),
            )
            links += 1
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {"root": 1, "groups": groups, "links": links}


def save_state(data: dict) -> dict:
    return import_state(_canon(data))
