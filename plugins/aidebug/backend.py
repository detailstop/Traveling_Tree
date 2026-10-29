"""aidebug 插件后端：调试历史。"""
from __future__ import annotations

from plugins.aidebug import repo


def handle(method: str, subpath: str, query: dict, body: dict):
    if subpath.strip("/") != "state":
        return {"ok": False, "error": "not_found", "__status__": 404}
    if method == "GET":
        return {"ok": True, "state": repo.load_state()}
    if method in ("PUT", "POST"):
        state = body.get("state", body)
        try:
            return {"ok": True, "state": state, "counts": repo.save_state(state)}
        except (ValueError, TypeError) as exc:
            return {"ok": False, "error": str(exc), "__status__": 400}
    return {"ok": False, "error": "method_not_allowed", "__status__": 405}
