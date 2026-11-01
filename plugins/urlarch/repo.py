"""urlarch 插件 SQL 层：原始网址库资产 + 组别/链接 + 快捷键白名单。"""
from __future__ import annotations

import hashlib
import json
import secrets
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


# ------------------------------------------------------------
# 软件快捷入口白名单 / 组别（R4）：只做存储；启动在 backend.py，路径/参数一律取自本表
# ------------------------------------------------------------

_SHORTCUT_COLS = "id,name,path,args,hotkey,group_id,raw_json,live_json,created_at,updated_at"
_GROUP_COLS = "id,name,sort_order,raw_json,live_json,created_at,updated_at"


def _shortcut_json(name: str, path: str, args: list, hotkey: str, group_id: str) -> str:
    payload = {"name": name, "path": path, "group_id": group_id, "args": args, "hotkey": hotkey}
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def _group_json(name: str, sort_order: int) -> str:
    payload = {"name": name, "sort_order": sort_order}
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def list_shortcuts() -> list[dict]:
    rows = get_conn().execute(
        f"SELECT {_SHORTCUT_COLS} FROM urlarch_shortcuts ORDER BY created_at, id"
    ).fetchall()
    return [dict(row) for row in rows]


def get_shortcut(shortcut_id: str) -> dict | None:
    row = get_conn().execute(
        f"SELECT {_SHORTCUT_COLS} FROM urlarch_shortcuts WHERE id=?", (shortcut_id,)
    ).fetchone()
    return dict(row) if row else None


def create_shortcut(name: str, path: str, args_text: str, hotkey: str = "",
                    group_id: str = "") -> dict:
    """新增白名单条目；id/时间戳由后端生成，raw_json 与 live_json 同值双写。

    hotkey 为历史列（可选、可为空），不参与逻辑；group_id 空串表示未分组；
    同一 path 允许重复登记（常见用途：同一程序不同入口名）。
    """
    conn = get_conn()
    now = _now()
    payload = _shortcut_json(name, path, json.loads(args_text), hotkey, group_id)
    shortcut_id = "us_" + secrets.token_hex(8)
    conn.execute(
        "INSERT INTO urlarch_shortcuts"
        "(id,name,path,args,hotkey,group_id,raw_json,live_json,created_at,updated_at) "
        "VALUES(?,?,?,?,?,?,?,?,?,?)",
        (shortcut_id, name, path, args_text, hotkey, group_id, payload, payload, now, now),
    )
    conn.commit()
    return get_shortcut(shortcut_id) or {}


def delete_shortcut(shortcut_id: str) -> bool:
    conn = get_conn()
    cur = conn.execute("DELETE FROM urlarch_shortcuts WHERE id=?", (shortcut_id,))
    conn.commit()
    return cur.rowcount > 0


def set_shortcut_group(shortcut_id: str, group_id: str) -> dict | None:
    """只改 group_id（拖拽改组）：刷新 live_json 与 updated_at，raw_json 保留登记快照。

    不动 path/args/name/hotkey，也不触发任何启动逻辑。
    """
    row = get_shortcut(shortcut_id)
    if row is None:
        return None
    payload = _shortcut_json(row["name"], row["path"], json.loads(row["args"] or "[]"),
                             row["hotkey"], group_id)
    conn = get_conn()
    conn.execute(
        "UPDATE urlarch_shortcuts SET group_id=?, live_json=?, updated_at=? WHERE id=?",
        (group_id, payload, _now(), shortcut_id),
    )
    conn.commit()
    return get_shortcut(shortcut_id)


# ---------------- 软件快捷入口组别 ----------------

class GroupNameConflict(Exception):
    """同名组（由 backend 映射为 GROUP_NAME_CONFLICT 409）。"""


def list_shortcut_groups() -> list[dict]:
    rows = get_conn().execute(
        f"SELECT {_GROUP_COLS} FROM urlarch_shortcut_groups "
        "ORDER BY sort_order, created_at, id"
    ).fetchall()
    return [dict(row) for row in rows]


def get_shortcut_group(group_id: str) -> dict | None:
    row = get_conn().execute(
        f"SELECT {_GROUP_COLS} FROM urlarch_shortcut_groups WHERE id=?", (group_id,)
    ).fetchone()
    return dict(row) if row else None


def find_shortcut_group_by_name(name: str, exclude_id: str = "") -> dict | None:
    row = get_conn().execute(
        f"SELECT {_GROUP_COLS} FROM urlarch_shortcut_groups "
        "WHERE name=? AND id<>? ORDER BY created_at, id LIMIT 1",
        (name, exclude_id),
    ).fetchone()
    return dict(row) if row else None


def create_shortcut_group(name: str, sort_order: int = 0) -> dict:
    """新建组别：事务内查同名（历史同名数据保留，但不再新增重复）。"""
    conn = get_conn()
    now = _now()
    payload = _group_json(name, sort_order)
    group_id = "ug_" + secrets.token_hex(8)
    conn.execute("BEGIN IMMEDIATE")
    try:
        if conn.execute("SELECT 1 FROM urlarch_shortcut_groups WHERE name=?",
                        (name,)).fetchone():
            conn.rollback()
            raise GroupNameConflict(name)
        conn.execute(
            "INSERT INTO urlarch_shortcut_groups"
            "(id,name,sort_order,raw_json,live_json,created_at,updated_at) "
            "VALUES(?,?,?,?,?,?,?)",
            (group_id, name, sort_order, payload, payload, now, now),
        )
        conn.commit()
    except GroupNameConflict:
        raise
    except Exception:
        conn.rollback()
        raise
    return get_shortcut_group(group_id) or {}


def update_shortcut_group(group_id: str, name: str | None = None,
                          sort_order: int | None = None) -> dict | None:
    """改名 / 改排序：只更新指定列，同步 live_json 与 updated_at；raw_json 保留建组快照。"""
    conn = get_conn()
    conn.execute("BEGIN IMMEDIATE")
    try:
        row = conn.execute(
            f"SELECT {_GROUP_COLS} FROM urlarch_shortcut_groups WHERE id=?", (group_id,)
        ).fetchone()
        if row is None:
            conn.rollback()
            return None
        new_name = row["name"] if name is None else name
        new_sort = row["sort_order"] if sort_order is None else sort_order
        if name is not None:
            clash = conn.execute(
                "SELECT 1 FROM urlarch_shortcut_groups WHERE name=? AND id<>?",
                (new_name, group_id),
            ).fetchone()
            if clash:
                conn.rollback()
                raise GroupNameConflict(new_name)
        payload = _group_json(new_name, new_sort)
        conn.execute(
            "UPDATE urlarch_shortcut_groups "
            "SET name=?, sort_order=?, live_json=?, updated_at=? WHERE id=?",
            (new_name, new_sort, payload, _now(), group_id),
        )
        conn.commit()
    except GroupNameConflict:
        raise
    except Exception:
        conn.rollback()
        raise
    return get_shortcut_group(group_id)


def delete_shortcut_group(group_id: str) -> bool:
    """删除组别：组内条目改到未分组（group_id=''），条目不删。

    组内条目的 live_json 按当前列刷新，raw_json 保留为登记时快照（项目口径）。
    """
    conn = get_conn()
    conn.execute("BEGIN IMMEDIATE")
    try:
        cur = conn.execute("DELETE FROM urlarch_shortcut_groups WHERE id=?", (group_id,))
        if cur.rowcount == 0:
            conn.rollback()
            return False
        moved = conn.execute(
            "SELECT id,name,path,args,hotkey,created_at,updated_at "
            "FROM urlarch_shortcuts WHERE group_id=?", (group_id,)
        ).fetchall()
        for row in moved:
            payload = _shortcut_json(row["name"], row["path"], json.loads(row["args"] or "[]"),
                                     row["hotkey"], "")
            conn.execute(
                "UPDATE urlarch_shortcuts SET group_id='', live_json=? WHERE id=?",
                (payload, row["id"]),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return True
