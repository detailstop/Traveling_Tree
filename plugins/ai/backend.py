"""ai 插件后端：AI 历史与接口日志。"""
from __future__ import annotations

from plugins.ai import ai_bridge, repo


def handle(method: str, subpath: str, query: dict, body: dict):
    route = subpath.strip("/")
    if route == "keys":
        if method == "GET":
            return ai_bridge.status()
        if method in ("PUT", "POST"):
            prov = body.get("provider")
            if not prov:
                prov = "deepseek" if body.get("deepseek") else "kimi"
            return ai_bridge.save_keys(
                prov,
                body.get(prov) or body.get("deepseek"),
                body.get(prov + "_model") or body.get("deepseek_model"),
            )
        return {"ok": False, "error": "method_not_allowed", "__status__": 405}
    if route == "chat":
        if method != "POST":
            return {"ok": False, "error": "method_not_allowed", "__status__": 405}
        return ai_bridge.chat(
            body.get("provider") or "deepseek",
            body.get("message", ""),
            body.get("history") or [],
        )
    if route != "state":
        return {"ok": False, "error": "not_found", "__status__": 404}
    if method == "GET":
        return {"ok": True, **repo.load_state()}
    if method in ("PUT", "POST"):
        state = body.get("state")
        txlog = body.get("txlog")
        if not isinstance(state, dict) or not isinstance(txlog, dict):
            return {"ok": False, "error": "state/txlog 必须是对象", "__status__": 400}
        try:
            return {"ok": True, **repo.save_state(state, txlog)}
        except (ValueError, TypeError) as exc:
            return {"ok": False, "error": str(exc), "__status__": 400}
    return {"ok": False, "error": "method_not_allowed", "__status__": 405}
