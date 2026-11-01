"""urlarch 插件后端：网址库状态读写 + 软件快捷入口白名单/组别 CRUD 与启动（R4）。

安全边界（守则第 21 条）：
- 启动接口只接受白名单 id，path/args 一律从 `urlarch_shortcuts` 读取，忽略请求体里的路径/命令；
- 启动前重新校验路径（存在、绝对、无 `..`、非脚本类扩展名）并解析 args；
- `subprocess.Popen([path] + args, shell=False)`：不拼接命令字符串、不经过 shell、不阻塞请求；
- 任何异常都转成稳定错误码，不向宿主抛 Traceback。
"""
from __future__ import annotations

import subprocess

from plugins.urlarch import repo, security


def _err(code: str, message: str = "", status: int = 400) -> dict:
    return {"ok": False, "error": code, "message": message or code, "__status__": status}


def _public(row: dict) -> dict:
    return {
        "id": row.get("id", ""),
        "name": row.get("name", ""),
        "path": row.get("path", ""),
        "args": row.get("args", "[]"),
        "hotkey": row.get("hotkey", ""),
        "group_id": row.get("group_id", ""),
        "created_at": row.get("created_at", ""),
        "updated_at": row.get("updated_at", ""),
    }


def _public_group(row: dict) -> dict:
    return {
        "id": row.get("id", ""),
        "name": row.get("name", ""),
        "sort_order": row.get("sort_order", 0),
        "created_at": row.get("created_at", ""),
        "updated_at": row.get("updated_at", ""),
    }


def _state(method: str, body: dict) -> dict:
    if method == "GET":
        return {"ok": True, "state": repo.load_state()}
    if method in ("PUT", "POST"):
        state = body.get("state", body)
        try:
            return {"ok": True, "state": state, "counts": repo.save_state(state)}
        except (ValueError, TypeError) as exc:
            return _err(str(exc), str(exc), 400)
    return _err("method_not_allowed", "", 405)


def _list_shortcuts() -> dict:
    items = [_public(row) for row in repo.list_shortcuts()]
    return {"ok": True, "items": items, "count": len(items)}


def _create_shortcut(body: dict) -> dict:
    try:
        name = security.validate_name(body.get("name"))
        path = security.validate_path(body.get("path"))
        # 前端不再提供参数输入：未传/空 → 默认 '[]'（仍走同一套参数校验）
        args = security.validate_args(body.get("args"))
        hotkey = security.sanitize_hotkey(body.get("hotkey"))
        group_id = body.get("group_id") or ""
        if not isinstance(group_id, str):
            return _err("GROUP_NOT_FOUND", "group_id 必须是字符串", 404)
        group_id = group_id.strip()
        if group_id and repo.get_shortcut_group(group_id) is None:
            return _err("GROUP_NOT_FOUND", "组别不存在", 404)
    except security.ShortcutError as exc:
        return _err(exc.code, exc.message, 400)
    row = repo.create_shortcut(name, path, args, hotkey, group_id)
    return {"ok": True, "item": _public(row)}


def _list_groups() -> dict:
    items = [_public_group(row) for row in repo.list_shortcut_groups()]
    return {"ok": True, "items": items, "count": len(items)}


def _create_group(body: dict) -> dict:
    try:
        name = security.validate_group_name(body.get("name"))
        sort_order = security.validate_sort_order(body.get("sort_order"))
    except security.ShortcutError as exc:
        return _err(exc.code, exc.message, 400)
    try:
        row = repo.create_shortcut_group(name, sort_order)
    except repo.GroupNameConflict:
        return _err("GROUP_NAME_CONFLICT", "组名已存在，请换一个", 409)
    return {"ok": True, "item": _public_group(row)}


def _patch_group(group_id: str, body: dict) -> dict:
    """改名 / 调序：只接受 name 与 sort_order，其余字段忽略；组名唯一（排除自身）。"""
    if not security.valid_group_id(group_id):
        return _err("GROUP_NOT_FOUND", "组别不存在", 404)
    has_name = "name" in body
    has_sort = "sort_order" in body
    if not has_name and not has_sort:
        return _err("INVALID_REQUEST", "至少提供 name 或 sort_order", 400)
    name = None
    sort_order = None
    try:
        if has_name:
            name = security.validate_group_name(body.get("name"))
        if has_sort:
            sort_order = security.validate_sort_order_strict(body.get("sort_order"))
    except security.ShortcutError as exc:
        return _err(exc.code, exc.message, 400)
    try:
        row = repo.update_shortcut_group(group_id, name=name, sort_order=sort_order)
    except repo.GroupNameConflict:
        return _err("GROUP_NAME_CONFLICT", "组名已存在，请换一个", 409)
    if row is None:
        return _err("GROUP_NOT_FOUND", "组别不存在", 404)
    return {"ok": True, "item": _public_group(row)}


def _patch_shortcut(shortcut_id: str, body: dict) -> dict:
    """只改 group_id（拖拽改组）：忽略 path/args/name/hotkey/cmd 等任何其他字段。"""
    if not security.valid_id(shortcut_id):
        return _err("SHORTCUT_NOT_FOUND", "白名单中找不到该条目", 404)
    if "group_id" not in body:
        return _err("INVALID_REQUEST", "只接受 group_id", 400)
    group_id = body.get("group_id") or ""
    if not isinstance(group_id, str):
        return _err("GROUP_NOT_FOUND", "group_id 必须是字符串", 404)
    group_id = group_id.strip()
    if group_id and repo.get_shortcut_group(group_id) is None:
        return _err("GROUP_NOT_FOUND", "组别不存在", 404)
    row = repo.set_shortcut_group(shortcut_id, group_id)
    if row is None:
        return _err("SHORTCUT_NOT_FOUND", "白名单中找不到该条目", 404)
    return {"ok": True, "item": _public(row)}


def _delete_group(group_id: str) -> dict:
    if not security.valid_group_id(group_id) or not repo.delete_shortcut_group(group_id):
        return _err("GROUP_NOT_FOUND", "组别不存在", 404)
    return {"ok": True, "id": group_id, "moved_to_ungrouped": True}


def _delete_shortcut(shortcut_id: str) -> dict:
    if not security.valid_id(shortcut_id) or not repo.delete_shortcut(shortcut_id):
        return _err("SHORTCUT_NOT_FOUND", "白名单中找不到该条目", 404)
    return {"ok": True, "id": shortcut_id}


def _launch(body: dict) -> dict:
    shortcut_id = body.get("id")
    if not security.valid_id(shortcut_id):
        return _err("SHORTCUT_NOT_FOUND", "需要白名单 id", 404)
    row = repo.get_shortcut(shortcut_id)
    if not row:
        return _err("SHORTCUT_NOT_FOUND", "白名单中找不到该条目", 404)
    try:
        path = security.validate_path(row.get("path"))
        args = security.parse_stored_args(row.get("args"))
    except security.ShortcutError as exc:
        return _err(exc.code, exc.message, 400)
    try:
        proc = subprocess.Popen([path] + args, shell=False, close_fds=True)
    except (OSError, ValueError):
        return _err("LAUNCH_FAILED", "进程创建失败", 500)
    return {"ok": True, "id": shortcut_id, "name": row.get("name") or "", "pid": proc.pid}


def _dispatch(method: str, subpath: str, query: dict, body: dict) -> dict:
    parts = [part for part in str(subpath or "").strip("/").split("/") if part]
    if parts == ["state"]:
        return _state(method, body)
    if parts == ["shortcuts"]:
        if method == "GET":
            return _list_shortcuts()
        if method == "POST":
            return _create_shortcut(body)
        return _err("method_not_allowed", "", 405)
    if len(parts) == 2 and parts[0] == "shortcuts":
        if method == "DELETE":
            return _delete_shortcut(parts[1])
        if method == "PATCH":
            return _patch_shortcut(parts[1], body)
        return _err("method_not_allowed", "", 405)
    if parts == ["shortcut-groups"]:
        if method == "GET":
            return _list_groups()
        if method == "POST":
            return _create_group(body)
        return _err("method_not_allowed", "", 405)
    if len(parts) == 2 and parts[0] == "shortcut-groups":
        if method == "DELETE":
            return _delete_group(parts[1])
        if method == "PATCH":
            return _patch_group(parts[1], body)
        return _err("method_not_allowed", "", 405)
    if parts == ["launch"]:
        if method == "POST":
            return _launch(body)
        return _err("method_not_allowed", "", 405)
    return _err("not_found", "未知子路径", 404)


def handle(method: str, subpath: str, query: dict, body: dict):
    try:
        return _dispatch(method, subpath, query, body if isinstance(body, dict) else {})
    except Exception:  # noqa: BLE001 - 任何异常都不向宿主抛 Traceback
        return _err("INTERNAL_ERROR", "后端内部错误", 500)
