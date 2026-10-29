# -*- coding: utf-8 -*-
"""网页会话插件后端：/api/plugin/webchat/*。"""
from __future__ import annotations

from plugins.webchat import web_chat


def handle(method: str, subpath: str, query: dict, body: dict):
    route = subpath.strip("/")
    body = body if isinstance(body, dict) else {}
    if route == "status" and method == "GET":
        return web_chat.status()
    if route == "sessions" and method == "GET":
        return web_chat.list_sessions()
    if route == "chat" and method == "POST":
        return web_chat.chat(body.get("url", ""), body.get("message", ""), body.get("expect", ""))
    if route == "restart" and method == "POST":
        return web_chat.restart()
    if route == "new" and method == "POST":
        return web_chat.new_chat()
    if route == "login" and method == "POST":
        return web_chat.login()
    if route == "sessions" and method == "POST":
        return web_chat.add_session(body.get("name", ""), body.get("url", ""))
    if route == "sessions/delete" and method == "POST":
        return web_chat.delete_session(body.get("id", ""))
    if route in {"status", "sessions"} or route in {"chat", "restart", "new", "login", "sessions/delete"}:
        return {"ok": False, "error": "method_not_allowed", "__status__": 405}
    return {"ok": False, "error": "not_found", "__status__": 404}
