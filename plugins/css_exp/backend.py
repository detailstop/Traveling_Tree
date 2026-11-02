"""css_exp 后端：AWA UI 静态产物兜底服务 + 收藏条目 CRUD。

- 静态产物：`/api/plugin/css_exp/app/<path>` → `plugins/css_exp/static/app/<path>`，
  以 `__binary__` 返回（宿主的二进制响应会带 Content-Disposition: attachment，
  浏览器对子资源（CSS/JS/字体/图片/JSON）忽略该头，故只用于资源；页面文档改用宿主
  静态路由 `/plugins/css_exp/static/app/...` 加载，见 README）。
- 收藏：`/favorites`（GET/POST）、`/favorites/<id>`（DELETE）；写库只写
  `css_exp_favorites`，raw_json / live_json 同值双写。
"""
from __future__ import annotations

import json
import mimetypes
import secrets
from datetime import datetime, timezone
from pathlib import Path

from db.connection import get_conn

TABLE = "css_exp_favorites"
STATIC_DIR = Path(__file__).resolve().parent / "static" / "app"
_COLS = ("id, title, category, made_by, css, html, source_url, raw_json, live_json, created_at")

_MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
}


def _err(code: str, message: str = "", status: int = 400) -> dict:
    return {"ok": False, "error": code, "message": message or code, "__status__": status}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _mime(path: Path) -> str:
    return _MIME.get(path.suffix.lower()) or mimetypes.guess_type(path.name)[0] \
        or "application/octet-stream"


# ---------------- 静态产物 ----------------

def _static(rel: str) -> dict:
    rel = (rel or "").replace("\\", "/").strip("/")
    parts = [p for p in rel.split("/") if p]
    if any(p in (".", "..") for p in parts):
        return _err("FILE_NOT_FOUND", "文件不存在", 404)
    base = STATIC_DIR.resolve()
    try:
        candidate = (base / rel).resolve() if rel else base
        candidate.relative_to(base)
    except (OSError, ValueError):
        return _err("FILE_NOT_FOUND", "文件不存在", 404)
    if candidate.is_dir():
        candidate = candidate / "index.html"
    if not candidate.is_file():
        return _err("FILE_NOT_FOUND", "文件不存在", 404)
    try:
        data = candidate.read_bytes()
    except OSError:
        return _err("FILE_NOT_FOUND", "文件不存在", 404)
    suffix = candidate.suffix.lower()
    cache = "no-cache" if suffix in (".html", ".js", ".css", ".json", ".map") \
        else "public, max-age=86400"
    return {
        "ok": True,
        "__binary__": True,
        "body": data,
        "mime": _mime(candidate),
        "filename": candidate.name,
        "headers": {"Cache-Control": cache},
    }


# ---------------- 收藏 ----------------

def _public(row) -> dict:
    return {
        "id": row["id"],
        "title": row["title"],
        "category": row["category"],
        "made_by": row["made_by"],
        "css": row["css"],
        "html": row["html"],
        "source_url": row["source_url"],
        "created_at": row["created_at"],
    }


def _list() -> dict:
    rows = get_conn().execute(
        f"SELECT {_COLS} FROM {TABLE} ORDER BY created_at DESC, id DESC"
    ).fetchall()
    items = [_public(r) for r in rows]
    return {"ok": True, "items": items, "count": len(items)}


def _create(body: dict) -> dict:
    title = str(body.get("title") or "").strip()
    category = str(body.get("category") or "").strip()
    made_by = str(body.get("made_by") or "").strip()
    css = str(body.get("css") or "")
    html = str(body.get("html") or "")
    source_url = str(body.get("source_url") or "").strip()
    if not title or not category or not css.strip() or not html.strip():
        return _err("INVALID_REQUEST", "title/category/css/html 不能为空", 400)
    if len(title) > 300 or len(category) > 64 or len(made_by) > 200:
        return _err("INVALID_REQUEST", "字段过长", 400)
    if len(css) > 200_000 or len(html) > 200_000:
        return _err("INVALID_REQUEST", "代码内容过大", 400)
    conn = get_conn()
    dup = conn.execute(
        f"SELECT id FROM {TABLE} WHERE source_url=? AND title=?", (source_url, title)
    ).fetchone()
    if dup is not None:
        return _err("FAVORITE_DUPLICATE", "该组件已收藏", 409)
    favorite_id = "fav_" + secrets.token_hex(8)
    now = _now()
    payload = json.dumps({
        "title": title, "category": category, "made_by": made_by,
        "css": css, "html": html, "source_url": source_url,
    }, ensure_ascii=False)
    conn.execute(
        f"INSERT INTO {TABLE}"
        "(id,title,category,made_by,css,html,source_url,raw_json,live_json,created_at) "
        "VALUES(?,?,?,?,?,?,?,?,?,?)",
        (favorite_id, title, category, made_by, css, html, source_url,
         payload, payload, now),
    )
    conn.commit()
    row = conn.execute(f"SELECT {_COLS} FROM {TABLE} WHERE id=?", (favorite_id,)).fetchone()
    return {"ok": True, "item": _public(row)}


def _delete(favorite_id: str) -> dict:
    favorite_id = str(favorite_id or "").strip()
    if not favorite_id:
        return _err("FAVORITE_NOT_FOUND", "收藏不存在", 404)
    conn = get_conn()
    cur = conn.execute(f"DELETE FROM {TABLE} WHERE id=?", (favorite_id,))
    conn.commit()
    if cur.rowcount == 0:
        return _err("FAVORITE_NOT_FOUND", "收藏不存在", 404)
    return {"ok": True, "id": favorite_id}


# ---------------- 分发 ----------------

def _dispatch(method: str, subpath: str, query: dict, body: dict) -> dict:
    parts = [p for p in str(subpath or "").split("/") if p]
    if not parts:
        return _err("not_found", "未知子路径", 404)
    if parts[0] == "app":
        if method != "GET":
            return _err("method_not_allowed", "", 405)
        return _static("/".join(parts[1:]))
    if parts[0] == "favorites":
        if len(parts) == 1:
            if method == "GET":
                return _list()
            if method == "POST":
                return _create(body)
            return _err("method_not_allowed", "", 405)
        if len(parts) == 2:
            if method == "DELETE":
                return _delete(parts[1])
            return _err("method_not_allowed", "", 405)
    return _err("not_found", "未知子路径", 404)


def handle(method: str, subpath: str, query: dict, body: dict):
    try:
        return _dispatch(method, subpath, query if isinstance(query, dict) else {},
                         body if isinstance(body, dict) else {})
    except Exception:  # noqa: BLE001 - 不向宿主抛 Traceback
        return _err("INTERNAL_ERROR", "后端内部错误", 500)
