"""
第二档 Web 服务层（纯标准库）。

职责：
  - 用 ThreadingHTTPServer 提供本地静态页面（玻璃拟态 UI）与 JSON API；
  - 只保留宿主能力（插件发现/分发、设置、项目/阅读/背景/文件、AI/网页会话、
    豆包、TTS 等）；学习核心 API 全部由 plugins/russian/backend.py 接管；
  - 所有业务插件通过 manifest 动态加载，宿主不再硬编码插件路由。

入口：python main.py（默认）或 python main.py web；浏览器自动打开。
"""
from __future__ import annotations

import importlib.util
import json
import mimetypes
import re
import socket
import sys
import threading
import traceback
import webbrowser
from datetime import date
from email.utils import formatdate
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse, unquote, quote

import config
from db.connection import ModuleDisabledError, init_db
from modules import settings_store

WEB_DIR = Path(__file__).resolve().parent / "static"
PLUGINS_DIR = Path(config.BASE_DIR).resolve() / "plugins"
_PLUGIN_SCHEMA_VERSION = 2
_PLUGIN_ID_RE = re.compile(r"^[a-z0-9_-]+$")
_PLUGIN_MODULE_KEY_RE = re.compile(r"^[a-z][a-z0-9_-]{0,31}$")
_PLUGIN_BACKENDS: dict[str, tuple[str, int, object]] = {}
_PLUGIN_BACKENDS_LOCK = threading.Lock()

HOST = "127.0.0.1"
PORT = 8765


# ============================================================
# settings（与 GUI 共用 data/settings.json）
# ============================================================

def _read_settings() -> dict:
    return settings_store.read()


def _write_settings(data: dict) -> bool:
    return settings_store.write(data)


# ---------- 用户偏好配置文件（UI 偏好的持久化，不承载业务内容） ----------
_PREFS_LOCK = threading.Lock()


def _preferences_path() -> Path:
    return Path(config.DATA_DIR) / "user_preferences.json"


def _read_preferences() -> dict:
    path = _preferences_path()
    with _PREFS_LOCK:
        if not path.is_file():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("{}\n", encoding="utf-8")
            return {}
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return {}
        return data if isinstance(data, dict) else {}


def _write_preferences(data: dict) -> bool:
    if not isinstance(data, dict):
        raise ValueError("preferences 必须是 JSON 对象")
    path = _preferences_path()
    with _PREFS_LOCK:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(path.name + ".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        tmp.replace(path)
    return True


def api_preferences_get() -> dict:
    return {"ok": True, "preferences": _read_preferences()}


def api_preferences_save(data: dict) -> dict:
    prefs = data.get("preferences") if isinstance(data, dict) and isinstance(data.get("preferences"), dict) else data
    if not isinstance(prefs, dict):
        return {"ok": False, "error": "preferences 必须是 JSON 对象"}
    _write_preferences(prefs)
    return {"ok": True, "preferences": prefs}


def _plugin_file(base: Path, rel: str) -> Path | None:
    """解析插件内相对文件；拒绝绝对路径与 ..，不存在返回 None。"""
    rel = str(rel or "").strip().replace("\\", "/")
    if not rel or rel.startswith("/") or ".." in Path(rel).parts:
        return None
    path = (base / rel).resolve()
    try:
        path.relative_to(base)
    except ValueError:
        return None
    return path if path.is_file() else None


def _plugin_asset(base: Path, rel, suffix: str) -> Path | None:
    """解析插件内指定后缀的资源文件；不合法或不存在返回 None。"""
    if not isinstance(rel, str):
        return None
    path = _plugin_file(base, rel)
    if path is None or path.suffix.lower() != suffix:
        return None
    return path


def _plugin_manifest_data(directory: Path) -> dict | None:
    """读取 plugins/<id>/manifest.json；不存在、坏 JSON 或禁用返回 None。"""
    try:
        data = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict) or data.get("enabled") is False:
        return None
    return data


def _plugin_backend_spec(data: dict, base: Path) -> dict | None:
    """解析 manifest.backend（v1 字符串 / v2 对象）；不合法返回 None。"""
    raw = data.get("backend")
    if raw is None:
        return None
    if isinstance(raw, str):
        raw = {"file": raw}
    if not isinstance(raw, dict):
        return None
    rel = str(raw.get("file") or "").strip().replace("\\", "/")
    path = _plugin_asset(base, rel, ".py")
    if path is None:
        return None
    entry = str(raw.get("entry") or "handle").strip()
    if not entry.isidentifier():
        return None
    binary = raw.get("binary")
    status = raw.get("status")
    return {
        "file": rel,
        "path": path,
        "entry": entry,
        "binary": binary if isinstance(binary, bool) else True,
        "status": status if isinstance(status, bool) else True,
    }


def _plugin_db_spec(data: dict, base: Path) -> dict | None:
    """解析 manifest.db（v1 字符串 / v2 对象）；不合法返回 None。"""
    raw = data.get("db")
    if raw is None:
        return None
    if isinstance(raw, str):
        raw = {"module_key": str(data.get("id") or ""), "schema": raw}
    if not isinstance(raw, dict):
        return None
    module_key = str(raw.get("module_key") or data.get("id") or "").strip()
    if not module_key or not _PLUGIN_MODULE_KEY_RE.fullmatch(module_key):
        return None
    schema = _plugin_asset(base, raw.get("schema"), ".sql")
    if schema is None:
        return None
    migrate = None
    if raw.get("migrate") is not None:
        migrate = _plugin_asset(base, raw.get("migrate"), ".py")
        if migrate is None:
            return None
    return {"module_key": module_key, "schema": schema, "migrate": migrate}


def _ensure_plugin_data_dirs() -> list[Path]:
    """按 manifest.data_dirs 创建 data/plugins/<name>/；失败/非法项跳过。"""
    root = PLUGINS_DIR.resolve()
    if not root.is_dir():
        return []
    created: list[Path] = []
    for directory in sorted(root.iterdir(), key=lambda p: p.name.lower()):
        if not directory.is_dir():
            continue
        data = _plugin_manifest_data(directory)
        if data is None:
            continue
        pid = str(data.get("id") or "").strip()
        if not pid or pid != directory.name:
            continue
        raw = data.get("data_dirs")
        if not isinstance(raw, list):
            continue
        for name in raw:
            if not isinstance(name, str):
                continue
            try:
                created.append(config.plugin_data_dir(name.strip()))
            except ValueError:
                continue
    return created


def _plugin_entry(pid: str, raw: dict, base: Path) -> dict | None:
    """规范化一个 entry（多入口 manifest 的条目）。"""
    eid = str(raw.get("id") or "").strip()
    name = str(raw.get("name") or "").strip()
    icon = str(raw.get("icon") or "").strip()
    shelf = str(raw.get("shelf") or "gen").strip() or "gen"
    feature = str(raw.get("feature") or "").strip().replace("\\", "/")
    if not eid or not _PLUGIN_ID_RE.fullmatch(eid) or not name or not icon or not feature:
        return None
    if _plugin_file(base, feature) is None:
        return None
    return {
        "id": eid,
        "plugin_id": pid,
        "name": name,
        "icon": icon,
        "desc": str(raw.get("desc") or "").strip(),
        "shelf": shelf,
        "feature": feature,
        "feature_url": f"/plugins/{quote(pid, safe='')}/{quote(feature, safe='/')}",
        "nav": bool(raw.get("nav")),
    }


def _plugin_entries(pid: str, data: dict, base: Path) -> list[dict] | None:
    """把 manifest 规范化为 entries[]；无 entries 时按 v1 单入口包装。"""
    raw_entries = data.get("entries")
    if raw_entries is None:
        name = str(data.get("name") or "").strip()
        feature = str(data.get("feature") or "").strip().replace("\\", "/")
        if not name or not feature or _plugin_file(base, feature) is None:
            return None
        return [{
            "id": pid,
            "plugin_id": pid,
            "name": name,
            "icon": str(data.get("icon") or "🧩").strip(),
            "desc": str(data.get("desc") or "").strip(),
            "shelf": str(data.get("shelf") or "gen").strip() or "gen",
            "feature": feature,
            "feature_url": f"/plugins/{quote(pid, safe='')}/{quote(feature, safe='/')}",
        }]
    if not isinstance(raw_entries, list) or not raw_entries:
        return None
    entries: list[dict] = []
    entry_ids: set[str] = set()
    for raw in raw_entries:
        if not isinstance(raw, dict):
            return None
        entry = _plugin_entry(pid, raw, base)
        if entry is None or entry["id"] in entry_ids:
            return None
        entry_ids.add(entry["id"])
        entries.append(entry)
    return entries or None


def _plugin_list() -> list[dict]:
    """扫描 plugins/<id>/manifest.json；清单完全由 manifest 决定。

    v2 必须有 entries；v1 无 entries 时把单入口插件自动包装为 1 个 entry
    （id = plugin.id）。主程序不维护任何插件 id 路由表。
    """
    root = PLUGINS_DIR.resolve()
    if not root.is_dir():
        return []
    out: list[dict] = []
    seen: set[str] = set()
    for directory in sorted(root.iterdir(), key=lambda p: p.name.lower()):
        if not directory.is_dir():
            continue
        data = _plugin_manifest_data(directory)
        if data is None:
            continue
        schema_version = data.get("schema_version", 1)
        if (not isinstance(schema_version, int) or isinstance(schema_version, bool)
                or schema_version not in (1, _PLUGIN_SCHEMA_VERSION)):
            continue
        if schema_version == 2 and not isinstance(data.get("entries"), list):
            continue
        pid = str(data.get("id") or "").strip()
        if not pid or pid != directory.name or pid in seen:
            continue
        base = directory.resolve()
        try:
            base.relative_to(root)
        except ValueError:
            continue
        entries = _plugin_entries(pid, data, base)
        if not entries:
            continue
        name = str(data.get("name") or entries[0]["name"]).strip()
        icon = str(data.get("icon") or entries[0]["icon"]).strip()
        if not name or not icon:
            continue

        backend = _plugin_backend_spec(data, base)
        if data.get("backend") is not None and backend is None:
            continue
        style = None
        if data.get("style") is not None:
            style = _plugin_asset(base, data.get("style"), ".css")
            if style is None:
                continue
        if data.get("db") is not None and _plugin_db_spec(data, base) is None:
            continue

        item: dict = {"id": pid, "name": name, "icon": icon, "entries": entries}
        version = str(data.get("version") or "").strip()
        if version:
            item["version"] = version
        if schema_version == 2:
            item["schema_version"] = 2
        if style is not None:
            rel = style.relative_to(base).as_posix()
            item["style_url"] = f"/plugins/{quote(pid, safe='')}/{quote(rel, safe='/')}"
        if backend is not None:
            item["backend"] = Path(backend["file"]).name
        shared_features = data.get("shared_features")
        if isinstance(shared_features, list):
            clean = [name for name in shared_features
                     if isinstance(name, str) and _PLUGIN_ID_RE.fullmatch(name)]
            if clean:
                item["shared_features"] = clean
        seen.add(pid)
        out.append(item)
    return out


class _PluginNotFound(Exception):
    """插件 id / manifest / backend 不存在或已禁用。"""


class _PluginLoadError(Exception):
    """插件 backend 加载或执行失败。"""


def _plugin_manifest(pid: str) -> tuple[dict, Path]:
    """读取并校验插件 manifest；返回 (manifest, 解析后的插件目录)。"""
    if not _PLUGIN_ID_RE.fullmatch(pid):
        raise _PluginNotFound(pid)
    entry = (PLUGINS_DIR / pid).resolve()
    try:
        entry.relative_to(PLUGINS_DIR.resolve())
    except ValueError:
        raise _PluginNotFound(pid) from None
    data = _plugin_manifest_data(entry)
    if data is None or str(data.get("id") or "").strip() != pid:
        raise _PluginNotFound(pid)
    return data, entry


def _plugin_backend(pid: str):
    """按 manifest.backend 加载插件 backend；返回 (module, spec)。"""
    data, base = _plugin_manifest(pid)
    spec = _plugin_backend_spec(data, base)
    if spec is None:
        raise _PluginNotFound(pid)
    path: Path = spec["path"]
    mtime = path.stat().st_mtime_ns
    cache_key = str(path)
    with _PLUGIN_BACKENDS_LOCK:
        cached = _PLUGIN_BACKENDS.get(pid)
        if cached and cached[0] == cache_key and cached[1] == mtime:
            return cached[2], spec
        module_spec = importlib.util.spec_from_file_location(f"rt_plugin_backend_{pid}", path)
        if module_spec is None or module_spec.loader is None:
            raise _PluginLoadError(pid)
        module = importlib.util.module_from_spec(module_spec)
        try:
            module_spec.loader.exec_module(module)
        except Exception:
            traceback.print_exc()
            raise _PluginLoadError(pid) from None
        _PLUGIN_BACKENDS[pid] = (cache_key, mtime, module)
        return module, spec


def _download_groups(value) -> dict:
    """规范化按功能分组下载配置：{group_id: {enabled, dir_name}}。"""
    out: dict = {}
    if not isinstance(value, dict):
        return out
    for key, item in value.items():
        if not isinstance(key, str) or not re.fullmatch(r"[a-z0-9_]{1,40}", key):
            continue
        if not isinstance(item, dict):
            continue
        out[key] = {
            "enabled": bool(item.get("enabled")),
            "dir_name": str(item.get("dir_name") or "").strip()[:120],
        }
    return out


def _russian_settings_path():
    return settings_store.quota_settings_path()


def apply_settings() -> None:
    host = _read_settings()
    plugin = settings_store.read_at(_russian_settings_path())
    new_quota = plugin.get("new_quota", host.get("new_quota"))
    review_quota = plugin.get("review_quota", host.get("review_quota"))
    if new_quota is not None:
        config.DAILY_NEW_QUOTA = max(0, int(new_quota))
    if review_quota is not None:
        config.DAILY_REVIEW_QUOTA = max(0, int(review_quota))


apply_settings()


# ============================================================
# 宿主设置（仅下载分组；学习设置归 russian 插件）
# ============================================================

def api_settings() -> dict:
    host = _read_settings()
    plugin = settings_store.read_at(_russian_settings_path())
    out = {"download_groups": _download_groups(host.get("download_groups")),
           "download_dir": str(host.get("download_dir") or "")}
    for key in ("new_quota", "review_quota"):
        if key in plugin:
            out[key] = plugin[key]
        elif key in host:
            out[key] = host[key]
    return out


def api_settings_save(data: dict) -> dict:
    d = _read_settings()
    plugin_old = settings_store.read_at(_russian_settings_path())
    plugin_patch = {}
    if "new_quota" in data:
        try:
            plugin_patch["new_quota"] = max(0, int(data["new_quota"]))
        except (TypeError, ValueError):
            return {"ok": False, "error": "new_quota 必须是非负整数"}
    if "review_quota" in data:
        try:
            plugin_patch["review_quota"] = max(0, int(data["review_quota"]))
        except (TypeError, ValueError):
            return {"ok": False, "error": "review_quota 必须是非负整数"}
    if "download_dir" in data:
        value = str(data.get("download_dir") or "").strip().replace("\x00", "")
        if len(value) > 500:
            return {"ok": False, "error": "download_dir 过长"}
        d["download_dir"] = value
    if "download_groups" in data:
        groups = _download_groups(d.get("download_groups"))
        groups.update(_download_groups(data.get("download_groups")))
        d["download_groups"] = groups

    # Plugin file is written first; config is updated only after both files succeed.
    if plugin_patch:
        _, ok = settings_store.update_at(_russian_settings_path(), plugin_patch)
        if not ok:
            return {"ok": False, "error": "设置保存失败：无法写入 data/plugins/russian/settings.json"}
    if not _write_settings(d):
        if plugin_patch:
            settings_store.write_at(_russian_settings_path(), plugin_old)
        return {"ok": False, "error": "设置保存失败：无法写入 data/settings.json"}

    if "new_quota" in plugin_patch:
        config.DAILY_NEW_QUOTA = plugin_patch["new_quota"]
    if "review_quota" in plugin_patch:
        config.DAILY_REVIEW_QUOTA = plugin_patch["review_quota"]
    return {"ok": True, **api_settings()}


# ============================================================
# HTTP Handler
# ============================================================

_MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".json": "application/json; charset=utf-8",
}


class Handler(BaseHTTPRequestHandler):
    server_version = "TravelWoodWeb/1.0"

    def log_message(self, fmt, *args):  # 安静一点
        pass

    # ---------- 路由 ----------
    def _route(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        query = {k: (v[0] if v else "") for k, v in parse_qs(parsed.query).items()}

        try:
            if path.startswith("/api/"):
                self._handle_api(path, query)
            else:
                self._serve_static(path)
        except ModuleDisabledError as exc:
            self._json({"ok": False, "error": "module_disabled",
                        "message": exc.message, "module": exc.module}, 503)

    def _read_body(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length <= 0:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            return {}

    def _handle_plugin(self, path: str, query: dict, data: dict) -> None:
        """分发 `/api/plugin/<id>/<subpath>` 到 manifest 声明的 backend.handle()。"""
        method = self.command
        pid, _, subpath = path[len("/api/plugin/"):].partition("/")
        pid = pid.strip()
        parts = [part for part in subpath.split("/") if part]
        subpath = "/".join(parts)
        if (not pid or not subpath or "\\" in path
                or any(part in (".", "..") for part in parts)):
            self._json({"ok": False, "error": "not_found"}, 404)
            return
        try:
            module, spec = _plugin_backend(pid)
            handler = getattr(module, spec["entry"], None)
            if not callable(handler):
                raise _PluginLoadError(pid)
            try:
                result = handler(
                    method, subpath, query, data if isinstance(data, dict) else {})
            except ModuleDisabledError:
                raise
            except Exception:
                traceback.print_exc()
                raise _PluginLoadError(pid) from None
        except _PluginNotFound:
            self._json({"ok": False, "error": "not_found"}, 404)
            return
        except _PluginLoadError:
            self._json({"ok": False, "error": "plugin_error"}, 500)
            return
        if not isinstance(result, dict):
            self._json({"ok": False, "error": "plugin_error"}, 500)
            return
        if result.get("__binary__") is True:
            if not spec["binary"]:
                self._json({"ok": False, "error": "plugin_error"}, 500)
                return
            body = result.get("body")
            if not isinstance(body, (bytes, bytearray)):
                self._json({"ok": False, "error": "plugin_error"}, 500)
                return
            self._send_binary(
                bytes(body),
                str(result.get("mime") or "application/octet-stream"),
                str(result.get("filename") or "download.bin"),
                result.get("headers") if isinstance(result.get("headers"), dict) else None,
            )
            return
        payload = dict(result)
        payload.setdefault("ok", True)
        status = 200
        forced = payload.pop("__status__", None)
        if isinstance(forced, int) and 400 <= forced <= 599:
            if not spec["status"]:
                self._json({"ok": False, "error": "plugin_error"}, 500)
                return
            status = forced
        if payload.get("ok") is False and status == 200:
            error = payload.get("error")
            if error == "not_found":
                status = 404
            elif error == "method_not_allowed":
                status = 405
        self._json(payload, status)

    def _handle_api(self, path: str, query: dict) -> None:
        method = self.command
        data = self._read_body() if method in ("POST", "PUT", "PATCH", "DELETE") else {}
        if path.startswith("/api/plugin/"):
            self._handle_plugin(path, query, data)
            return
        result: dict | None = None

        if method == "GET":
            if path == "/api/health":
                result = {"ok": True}
            elif path == "/api/preferences":
                result = api_preferences_get()
            elif path == "/api/plugins/list":
                result = {"ok": True, "plugins": _plugin_list()}
            elif path == "/api/settings":
                result = {"ok": True, **api_settings()}
        elif method == "POST":
            if path == "/api/settings":
                result = api_settings_save(data)
            elif path == "/api/preferences":
                result = api_preferences_save(data)
            elif path == "/api/preferences/import":
                result = api_preferences_save(data)

        if result is None:
            self._json({"ok": False, "error": f"未找到接口: {method} {path}"}, 404)
            return
        self._json(result)

    # ---------- 静态文件 ----------
    def _serve_static(self, path: str) -> None:
        if path in ("/", ""):
            path = "/index.html"
        if path.startswith("/plugins/"):
            # 插件静态资源：只允许 plugins/ 根内的普通文件（含符号链接解析后仍须在根内）。
            rel = path[len("/plugins/"):]
            root = PLUGINS_DIR.resolve()
            target = (root / rel).resolve()
            try:
                target.relative_to(root)
            except ValueError:
                self._json({"ok": False, "error": "forbidden"}, 403)
                return
            # backend.py 等 Python 源文件只供动态加载，不经静态路由暴露。
            if target.suffix.lower() in (".py", ".pyc"):
                self.send_error(404)
                return
        else:
            rel = path.lstrip("/")
            target = (WEB_DIR / rel).resolve()
            # 防目录穿越（保留既有静态资源判断，不改行为）
            if not str(target).startswith(str(WEB_DIR.resolve())):
                self._json({"ok": False, "error": "forbidden"}, 403)
                return
        if not target.is_file():
            self.send_error(404)
            return
        mime = _MIME.get(target.suffix.lower(), "application/octet-stream")
        # 静态资源条件请求：文件未变更时返回 304（app.js 较大，避免每次全量下载拖慢加载）
        try:
            mtime = target.stat().st_mtime
        except OSError:
            mtime = 0
        ims = self.headers.get("If-Modified-Since")
        if ims:
            try:
                from email.utils import parsedate_to_datetime
                if int(parsedate_to_datetime(ims).timestamp()) >= int(mtime):
                    self.send_response(304)
                    self.send_header("Cache-Control", "no-cache")
                    self.end_headers()
                    return
            except Exception:
                pass
        try:
            data = target.read_bytes()
        except OSError:
            self.send_error(500)
            return
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        if mtime:
            self.send_header("Last-Modified", formatdate(mtime, usegmt=True))
        # 页面/样式/脚本不缓存，保证每次启动都是最新版本（避免旧文件残留）
        if target.suffix.lower() in (".html", ".css", ".js"):
            self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    # ---------- 通用响应 ----------
    def _json(self, obj: dict, code: int = 200) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _text(self, value: str, code: int = 200) -> None:
        body = str(value).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_binary(self, data: bytes, mime: str, filename: str,
                     headers: dict | None = None) -> None:
        self.send_response(200)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self._route()

    def do_POST(self):
        self._route()

    def do_PUT(self):
        self._route()

    def do_PATCH(self):
        self._route()

    def do_DELETE(self):
        self._route()


# ============================================================
# 启动
# ============================================================

def _bootstrap_db() -> None:
    """启动时初始化一次数据库；插件 seed 由 manifest.db.seed 在 init_db 内完成。"""
    ran = init_db()
    _ensure_plugin_data_dirs()
    if ran:
        print("[db] schema / 迁移已执行一次")


def _port_in_use() -> bool:
    """检测 8765 是否已有实例在监听（避免重复启动堆积进程）。"""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex((HOST, PORT)) == 0
    except OSError:
        return False


def serve(open_browser: bool = True) -> None:
    try:
        _bootstrap_db()
    except Exception as exc:  # noqa: BLE001
        print(f"[db] 数据库初始化失败，服务未启动：{exc}", file=sys.stderr)
        raise SystemExit(1) from exc
    url = f"http://{HOST}:{PORT}"
    if _port_in_use():
        print(f"\n✨ 服务已在运行：{url}（复用现有实例，不重复启动）")
        if open_browser:
            threading.Timer(0.3, lambda: webbrowser.open(url)).start()
        return
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"\n✨ 旅行之木 第二档界面已启动：{url}")
    print("   按 Ctrl+C 停止服务。\n")
    if open_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
