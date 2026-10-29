"""book_reader 插件后端：/api/plugin/book_reader/* → 插件内 book_reader.api。"""
from __future__ import annotations

from plugins.book_reader import book_reader
from plugins.book_reader import bookmarks_repo


def handle(method: str, subpath: str, query: dict, body: dict):
    if subpath.strip("/") in ("bookmarks", "state"):
        if method == "GET":
            return {"ok": True, "items": bookmarks_repo.load_bookmarks()}
        if method in ("PUT", "POST"):
            book_id = str(body.get("book_id") or "")
            bookmark = body.get("bookmark")
            if not book_id or not isinstance(bookmark, dict):
                return {"ok": False, "error": "book_id/bookmark 必填", "__status__": 400}
            try:
                bookmarks_repo.save_mark(book_id, bookmark)
                return {"ok": True, "book_id": book_id}
            except (ValueError, TypeError) as exc:
                return {"ok": False, "error": str(exc), "__status__": 400}
        return {"ok": False, "error": "method_not_allowed", "__status__": 405}
    path = "/api/" + subpath.strip("/")
    try:
        return book_reader.api(method, path, query, body)
    except LookupError as exc:
        return {"ok": False, "error": str(exc), "__status__": 404}
    except (ValueError, TypeError) as exc:
        return {"ok": False, "error": str(exc), "__status__": 400}
