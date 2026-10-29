"""bg_library 插件后端：背景库 /api/bg/* 与文件预览 /api/files/*。"""
from __future__ import annotations

from plugins.bg_library import bg_library, file_preview


def handle(method: str, subpath: str, query: dict, body: dict):
    parts = [p for p in subpath.strip("/").split("/") if p]
    if not parts:
        return {"ok": False, "error": "not_found", "__status__": 404}
    if parts[0] == "bg":
        path = "/api/" + "/".join(parts)
        module = bg_library
    elif parts[0] == "files":
        path = "/api/" + "/".join(parts)
        module = file_preview
    else:
        return {"ok": False, "error": "not_found", "__status__": 404}
    try:
        return module.api(method, path, query, body)
    except LookupError as exc:
        return {"ok": False, "error": str(exc), "__status__": 404}
    except (ValueError, TypeError) as exc:
        return {"ok": False, "error": str(exc), "__status__": 400}
