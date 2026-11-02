"""urlarch 插件 SQL 层：原始网址库资产 + 组别/链接 + 快捷键白名单。"""
from __future__ import annotations

import hashlib
import json
import secrets
from datetime import datetime, timezone

from db.connection import get_conn
from plugins.urlarch import security

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
            image = str(item.get("image") or "")
            if image:
                image = security.validate_image_name(image)
            conn.execute(
                "INSERT INTO urlarch_links(link_id,title,url,note,ts,group_id,image,raw_json,live_json) "
                "VALUES(?,?,?,?,?,?,?,?,?)",
                (_link_id(group_id, idx, str(item["url"])), str(item.get("title") or ""),
                 str(item["url"]), str(item.get("note") or ""), str(item.get("ts") or ""),
                 group_id, image, _canon(item), _canon(item)),
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
# 网址条目（state JSON 为唯一真源，urlarch_links 为镜像；image 存文件名）
# ------------------------------------------------------------

def _link_items(state) -> list[tuple[str, int, dict]]:
    out = []
    for idx, item in enumerate(state.get("items") or []):
        if not isinstance(item, dict) or not item.get("url"):
            continue
        group_id = str(item.get("groupId") or "ungrouped")
        out.append((_link_id(group_id, idx, str(item["url"])), idx, item))
    return out


def find_link(link_id: str):
    state = load_state()
    if not isinstance(state, dict):
        return None
    for lid, idx, item in _link_items(state):
        if lid == link_id:
            return state, idx, item
    return None


def get_link(link_id: str) -> dict | None:
    found = find_link(link_id)
    return found[2] if found else None


def link_ids(state) -> list[dict]:
    """供 GET /state 附带：items 下标 → link_id（不落库，仅接口返回）。"""
    return [{"index": idx, "id": lid} for lid, idx, _item in _link_items(state)]


def patch_link(link_id: str, fields: dict) -> dict | None:
    """更新单条网址卡（title/url/image），返回新 id、条目与旧图片名。"""
    found = find_link(link_id)
    if found is None:
        return None
    state, idx, item = found
    old_image = str(item.get("image") or "")
    if "title" in fields:
        item["title"] = fields["title"]
    if "url" in fields:
        item["url"] = fields["url"]
    if "image" in fields:
        item["image"] = fields["image"]
    save_state(state)
    new_id = _link_id(str(item.get("groupId") or "ungrouped"), idx, str(item["url"]))
    return {"id": new_id, "item": item, "old_image": old_image}


def delete_link(link_id: str) -> dict | None:
    """删除单条网址卡，返回其图片文件名（由 backend 清理文件）。"""
    found = find_link(link_id)
    if found is None:
        return None
    state, idx, item = found
    image = str(item.get("image") or "")
    items = state.get("items") or []
    del items[idx]
    state["items"] = items
    save_state(state)
    return {"id": link_id, "image": image}


# ------------------------------------------------------------
# 软件快捷入口白名单 / 组别（R4）：只做存储；启动在 backend.py，路径/参数一律取自本表
# ------------------------------------------------------------

_SHORTCUT_COLS = ("id,name,path,args,hotkey,group_id,image,raw_json,live_json,"
                  "created_at,updated_at")
_GROUP_COLS = "id,name,sort_order,raw_json,live_json,created_at,updated_at"


def _shortcut_json(name: str, path: str, args: list, hotkey: str, group_id: str,
                   image: str = "") -> str:
    payload = {"name": name, "path": path, "group_id": group_id, "image": image,
               "args": args, "hotkey": hotkey}
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
                    group_id: str = "", image: str = "") -> dict:
    """新增白名单条目；id/时间戳由后端生成，raw_json 与 live_json 同值双写。

    hotkey 为历史列（可选、可为空），不参与逻辑；group_id 空串表示未分组；
    image 为卡片图片文件名（空串 = 无图）；同一 path 允许重复登记。
    """
    conn = get_conn()
    now = _now()
    payload = _shortcut_json(name, path, json.loads(args_text), hotkey, group_id, image)
    shortcut_id = "us_" + secrets.token_hex(8)
    conn.execute(
        "INSERT INTO urlarch_shortcuts"
        "(id,name,path,args,hotkey,group_id,image,raw_json,live_json,created_at,updated_at) "
        "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        (shortcut_id, name, path, args_text, hotkey, group_id, image, payload, payload, now, now),
    )
    conn.commit()
    return get_shortcut(shortcut_id) or {}


def delete_shortcut(shortcut_id: str) -> bool:
    conn = get_conn()
    cur = conn.execute("DELETE FROM urlarch_shortcuts WHERE id=?", (shortcut_id,))
    conn.commit()
    return cur.rowcount > 0


def update_shortcut(shortcut_id: str, name: str | None = None, path: str | None = None,
                    image: str | None = None, group_id: str | None = None) -> dict | None:
    """编辑卡片：只更新传入的字段，刷新 live_json 与 updated_at（raw 保留登记快照）。"""
    row = get_shortcut(shortcut_id)
    if row is None:
        return None
    new_name = row["name"] if name is None else name
    new_path = row["path"] if path is None else path
    new_image = row["image"] if image is None else image
    new_group = row["group_id"] if group_id is None else group_id
    payload = _shortcut_json(new_name, new_path, json.loads(row["args"] or "[]"),
                             row["hotkey"], new_group, new_image)
    conn = get_conn()
    conn.execute(
        "UPDATE urlarch_shortcuts SET name=?, path=?, group_id=?, image=?, live_json=?, "
        "updated_at=? WHERE id=?",
        (new_name, new_path, new_group, new_image, payload, _now(), shortcut_id),
    )
    conn.commit()
    return get_shortcut(shortcut_id)


def set_shortcut_group(shortcut_id: str, group_id: str) -> dict | None:
    """只改 group_id（拖拽改组）：刷新 live_json 与 updated_at，raw_json 保留登记快照。

    不动 path/args/name/image/hotkey，也不触发任何启动逻辑。
    """
    row = get_shortcut(shortcut_id)
    if row is None:
        return None
    payload = _shortcut_json(row["name"], row["path"], json.loads(row["args"] or "[]"),
                             row["hotkey"], group_id, row.get("image") or "")
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
            "SELECT id,name,path,args,hotkey,image,created_at,updated_at "
            "FROM urlarch_shortcuts WHERE group_id=?", (group_id,)
        ).fetchall()
        for row in moved:
            payload = _shortcut_json(row["name"], row["path"], json.loads(row["args"] or "[]"),
                                     row["hotkey"], "", row["image"] or "")
            conn.execute(
                "UPDATE urlarch_shortcuts SET group_id='', live_json=? WHERE id=?",
                (payload, row["id"]),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return True
