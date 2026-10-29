# -*- coding: utf-8 -*-
"""语音朗读插件后端：/api/plugin/tts/*。"""
from __future__ import annotations

from pathlib import Path

from plugins.tts import tts


def handle(method: str, subpath: str, query: dict, body: dict):
    route = subpath.strip("/")
    if route == "speak" and method == "GET":
        text = str((query or {}).get("text") or "").strip()
        if not text:
            return {"ok": False, "error": "缺少 text", "__status__": 400}
        path = tts.ensure_audio(text)
        if not path:
            return {"ok": False, "error": "语音合成失败（可能未联网）", "__status__": 502}
        try:
            data = Path(path).read_bytes()
        except OSError:
            return {"ok": False, "error": "读取音频失败", "__status__": 500}
        return {
            "__binary__": True,
            "body": data,
            "mime": "audio/mpeg",
            "headers": {"Cache-Control": "public, max-age=31536000"},
        }
    if route == "clear-cache" and method == "POST":
        n, mb = tts.clear_cache()
        return {"ok": True, "count": n, "mb": mb}
    if route in {"speak", "clear-cache"}:
        return {"ok": False, "error": "method_not_allowed", "__status__": 405}
    return {"ok": False, "error": "not_found", "__status__": 404}
