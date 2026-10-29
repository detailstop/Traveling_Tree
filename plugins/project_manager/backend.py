"""project_manager 插件后端：/api/plugin/project_manager/* → pm_service。"""
from __future__ import annotations

import re

from plugins.project_manager import pm_service


def _ok(value):
    if isinstance(value, dict):
        return {"ok": True, **value}
    return {"ok": True, "data": value}


def _not_found(message: str = "未找到接口"):
    return {"ok": False, "error": str(message), "__status__": 404}


def _bad(message: str):
    return {"ok": False, "error": str(message), "__status__": 400}


def _text(body: str, filename: str):
    return {
        "__binary__": True,
        "body": body.encode("utf-8"),
        "mime": "text/plain; charset=utf-8",
        "filename": filename,
    }


def _project_id(parts) -> int | None:
    return int(parts[0]) if parts and parts[0].isdigit() else None


def _dispatch(method: str, subpath: str, query: dict, body: dict):
    parts = [p for p in subpath.strip("/").split("/") if p]
    if not parts:
        return _not_found()

    if method == "GET":
        if parts == ["projects"]:
            return _ok({"projects": pm_service.list_projects()})
        if parts == ["templates"]:
            return _ok({"templates": pm_service.list_templates()})
        if len(parts) == 2 and parts[0] == "projects":
            pid = _project_id(parts[1:])
            if pid is None:
                return _not_found()
            return _ok(pm_service.get_project(pid))
        if len(parts) == 3 and parts[0] == "stages" and parts[2] == "export-prompt":
            return _text(pm_service.export_prompt(int(parts[1])), "prompt.md")
        if len(parts) == 3 and parts[0] == "stages" and parts[2] == "export-context":
            return _text(pm_service.export_context(int(parts[1])), "context.md")
        if len(parts) == 3 and parts[0] == "results" and parts[2] == "export-context":
            return _text(pm_service.export_result_context(int(parts[1])), "result-context.md")
        if len(parts) == 2 and parts[0] == "stages":
            return _ok(pm_service.get_stage(int(parts[1])))
        if len(parts) == 2 and parts[0] == "results":
            return _ok(pm_service.get_result(int(parts[1])))
    elif method == "POST":
        if parts == ["projects"]:
            return _ok(pm_service.create_project(body.get("name"), body.get("description")))
        if len(parts) == 3 and parts[0] == "stages" and parts[2] == "prompt-drafts":
            return _ok(pm_service.create_prompt_draft(int(parts[1]), body))
        if len(parts) == 3 and parts[0] == "stages" and parts[2] == "results":
            return _ok(pm_service.create_result(int(parts[1]), body))
    elif method == "PATCH":
        if len(parts) == 2 and parts[0] == "projects":
            return _ok(pm_service.update_project(int(parts[1]), body))
        if len(parts) == 3 and parts[0] == "stages" and parts[2] == "status":
            return _ok(pm_service.update_stage_status(int(parts[1]), body.get("status")))
        if len(parts) == 2 and parts[0] == "prompt-drafts":
            return _ok(pm_service.activate_draft(int(parts[1]), body))
    elif method == "DELETE":
        if len(parts) == 2 and parts[0] == "projects":
            return _ok(pm_service.delete_project(int(parts[1])))
        if len(parts) == 2 and parts[0] == "prompt-drafts":
            return _ok(pm_service.delete_draft(int(parts[1])))
        if len(parts) == 2 and parts[0] == "results":
            return _ok(pm_service.delete_result(int(parts[1])))
    return _not_found()


def handle(method: str, subpath: str, query: dict, body: dict):
    try:
        return _dispatch(method, subpath, query, body)
    except pm_service.PMNotFoundError as exc:
        return _not_found(str(exc))
    except (ValueError, TypeError) as exc:
        return _bad(str(exc))
