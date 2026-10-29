# -*- coding: utf-8 -*-
"""多 AI 共建插件后端：/api/plugin/cobuild/*。"""
from __future__ import annotations

from plugins.cobuild import cobuild


def handle(method: str, subpath: str, query: dict, body: dict):
    route = subpath.strip("/")
    body = body if isinstance(body, dict) else {}
    if route == "data" and method == "GET":
        return cobuild.data()
    if route == "checkin" and method == "POST":
        return cobuild.checkin(
            body.get("agent"),
            body.get("action"),
            body.get("files"),
            body.get("note"),
            body.get("kind"),
        )
    if route == "void" and method == "POST":
        return cobuild.void_entry(body.get("id"), body.get("reason"))
    if route in {"data", "checkin", "void"}:
        return {"ok": False, "error": "method_not_allowed", "__status__": 405}
    return {"ok": False, "error": "not_found", "__status__": 404}
