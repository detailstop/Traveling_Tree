"""urlarch 插件后端：网址库状态读写 + 软件快捷入口白名单/组别 CRUD 与启动（R4）
+ 卡片图片上传/读取 + 网址/软件条目编辑（round 105）。

安全边界（守则第 21 条）：
- 启动接口只接受白名单 id，path/args 一律从 `urlarch_shortcuts` 读取，忽略请求体里的路径/命令；
- 启动前重新校验路径（存在、绝对、无 `..`、非脚本类扩展名）并解析 args；
- `subprocess.Popen([path] + args, shell=False)`：不拼接命令字符串、不经过 shell、不阻塞请求；
- 图片：扩展名白名单 + 文件头 magic + ≤2MB，文件名后端生成，只存本地 images 目录；
- 任何异常都转成稳定错误码，不向宿主抛 Traceback。
"""
from __future__ import annotations

import base64
import binascii
import os
import secrets
import subprocess

import config
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
        "image": row.get("image", ""),
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
        state = repo.load_state()
        # link_ids：state.items 下标 → 后端 link_id（前端编辑/删除单条网址卡时用）。
        ids = repo.link_ids(state) if isinstance(state, dict) else []
        return {"ok": True, "state": state, "link_ids": ids}
    if method in ("PUT", "POST"):
        state = body.get("state", body)
        try:
            return {"ok": True, "state": state, "counts": repo.save_state(state)}
        except security.ShortcutError as exc:
            return _err(exc.code, exc.message, 400)
        except (ValueError, TypeError) as exc:
            return _err(str(exc), str(exc), 400)
    return _err("method_not_allowed", "", 405)


# ---------------- 卡片图片（仅本地文件；库里只存文件名） ----------------

def _images_dir():
    """data/plugins/urlarch/images/（由 manifest.data_dirs 交付的插件私有目录）。"""
    path = config.plugin_data_dir("urlarch") / "images"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _remove_image_file(name: str) -> bool:
    """删除图片文件；名字非法或文件不存在都不报错（幂等）。"""
    if not security.valid_image_name(name):
        return False
    try:
        (_images_dir() / name).unlink(missing_ok=True)
        return True
    except OSError:
        return False


def _upload_image(body: dict) -> dict:
    """上传图片：body {filename, data(base64)}；扩展名+文件头+大小三重校验，文件名后端生成。"""
    filename = body.get("filename")
    data_b64 = body.get("data")
    if not isinstance(filename, str) or not isinstance(data_b64, str):
        return _err("IMAGE_TYPE_INVALID", "需要 filename 与 data（base64）", 400)
    try:
        ext = security.image_extension(filename)
    except security.ShortcutError as exc:
        return _err(exc.code, exc.message, 400)
    try:
        raw = base64.b64decode(data_b64, validate=True)
    except (binascii.Error, ValueError):
        return _err("IMAGE_HEADER_INVALID", "图片数据无法解码", 400)
    if len(raw) > security.MAX_IMAGE_BYTES:
        return _err("IMAGE_TOO_LARGE", "图片不能超过 2MB", 400)
    try:
        security.validate_image_bytes(ext, raw)
    except security.ShortcutError as exc:
        return _err(exc.code, exc.message, 400)
    name = "img_" + secrets.token_hex(8) + "." + ext
    target = _images_dir() / name
    tmp = target.with_name(target.name + ".tmp")
    try:
        tmp.write_bytes(raw)
        os.replace(tmp, target)
    except OSError:
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass
        return _err("IMAGE_WRITE_FAILED", "图片写入失败", 500)
    return {"ok": True, "filename": name, "size": len(raw)}


def _get_image(name: str) -> dict:
    if not security.valid_image_name(name):
        return _err("IMAGE_NOT_FOUND", "图片不存在", 404)
    path = _images_dir() / name
    if not path.is_file():
        return _err("IMAGE_NOT_FOUND", "图片不存在", 404)
    try:
        data = path.read_bytes()
    except OSError:
        return _err("IMAGE_NOT_FOUND", "图片不存在", 404)
    return {"ok": True, "__binary__": True, "body": data,
            "mime": security.image_mime(name), "filename": name,
            "headers": {"Cache-Control": "no-store"}}


# ---------------- 网址卡片编辑 / 删除 ----------------

def _patch_link(link_id: str, body: dict) -> dict:
    """编辑网址卡：接受 title / url / image（至少一项）；其他字段忽略。"""
    fields = {}
    try:
        if "title" in body:
            fields["title"] = security.validate_link_title(body.get("title"))
        if "url" in body:
            fields["url"] = security.validate_link_url(body.get("url"))
        if "image" in body:
            fields["image"] = security.validate_image_name(body.get("image"))
    except security.ShortcutError as exc:
        return _err(exc.code, exc.message, 400)
    if not fields:
        return _err("INVALID_REQUEST", "至少提供 title / url / image 之一", 400)
    result = repo.patch_link(link_id, fields)
    if result is None:
        return _err("LINK_NOT_FOUND", "网址条目不存在", 404)
    old_image = result["old_image"]
    new_image = str(result["item"].get("image") or "")
    if old_image and old_image != new_image:
        _remove_image_file(old_image)
    return {"ok": True, "id": result["id"], "item": result["item"]}


def _delete_link(link_id: str) -> dict:
    result = repo.delete_link(link_id)
    if result is None:
        return _err("LINK_NOT_FOUND", "网址条目不存在", 404)
    image = result.get("image") or ""
    removed = _remove_image_file(image) if image else False
    return {"ok": True, "id": link_id, "image_removed": removed}


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
        image = security.validate_image_name(body.get("image"))
        group_id = body.get("group_id") or ""
        if not isinstance(group_id, str):
            return _err("GROUP_NOT_FOUND", "group_id 必须是字符串", 404)
        group_id = group_id.strip()
        if group_id and repo.get_shortcut_group(group_id) is None:
            return _err("GROUP_NOT_FOUND", "组别不存在", 404)
    except security.ShortcutError as exc:
        return _err(exc.code, exc.message, 400)
    row = repo.create_shortcut(name, path, args, hotkey, group_id, image)
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
    """编辑软件卡片：接受 name / path / image / group_id（至少一项）；忽略 args/hotkey/cmd。"""
    if not security.valid_id(shortcut_id):
        return _err("SHORTCUT_NOT_FOUND", "白名单中找不到该条目", 404)
    row = repo.get_shortcut(shortcut_id)
    if not row:
        return _err("SHORTCUT_NOT_FOUND", "白名单中找不到该条目", 404)
    fields: dict = {}
    try:
        if "name" in body:
            fields["name"] = security.validate_name(body.get("name"))
        if "path" in body:
            fields["path"] = security.validate_path(body.get("path"))
        if "image" in body:
            fields["image"] = security.validate_image_name(body.get("image"))
        if "group_id" in body:
            group_id = body.get("group_id") or ""
            if not isinstance(group_id, str):
                return _err("GROUP_NOT_FOUND", "group_id 必须是字符串", 404)
            group_id = group_id.strip()
            if group_id and repo.get_shortcut_group(group_id) is None:
                return _err("GROUP_NOT_FOUND", "组别不存在", 404)
            fields["group_id"] = group_id
    except security.ShortcutError as exc:
        return _err(exc.code, exc.message, 400)
    if not fields:
        return _err("INVALID_REQUEST", "至少提供 name / path / image / group_id 之一", 400)
    old_image = row.get("image") or ""
    updated = repo.update_shortcut(shortcut_id, **fields)
    if updated is None:
        return _err("SHORTCUT_NOT_FOUND", "白名单中找不到该条目", 404)
    new_image = updated.get("image") or ""
    if old_image and old_image != new_image:
        _remove_image_file(old_image)
    return {"ok": True, "item": _public(updated)}


def _delete_group(group_id: str) -> dict:
    if not security.valid_group_id(group_id) or not repo.delete_shortcut_group(group_id):
        return _err("GROUP_NOT_FOUND", "组别不存在", 404)
    return {"ok": True, "id": group_id, "moved_to_ungrouped": True}


def _delete_shortcut(shortcut_id: str) -> dict:
    row = repo.get_shortcut(shortcut_id)
    if not security.valid_id(shortcut_id) or not row or not repo.delete_shortcut(shortcut_id):
        return _err("SHORTCUT_NOT_FOUND", "白名单中找不到该条目", 404)
    image = row.get("image") or ""
    removed = _remove_image_file(image) if image else False
    return {"ok": True, "id": shortcut_id, "image_removed": removed}


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
    if parts == ["images"]:
        if method == "POST":
            return _upload_image(body)
        return _err("method_not_allowed", "", 405)
    if len(parts) == 2 and parts[0] == "images":
        if method == "GET":
            return _get_image(parts[1])
        return _err("method_not_allowed", "", 405)
    if len(parts) == 2 and parts[0] == "links":
        if method == "PATCH":
            return _patch_link(parts[1], body)
        if method == "DELETE":
            return _delete_link(parts[1])
        return _err("method_not_allowed", "", 405)
    return _err("not_found", "未知子路径", 404)


def handle(method: str, subpath: str, query: dict, body: dict):
    try:
        return _dispatch(method, subpath, query, body if isinstance(body, dict) else {})
    except Exception:  # noqa: BLE001 - 任何异常都不向宿主抛 Traceback
        return _err("INTERNAL_ERROR", "后端内部错误", 500)
