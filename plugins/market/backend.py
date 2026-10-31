"""插件市场后端：/api/plugin/market/*（本地 A 阶段）。

安装=校验 index.json 的 SHA256 → 解压到 plugins/<id>/；
卸载=移出 plugins/<id>/（保留 data/plugins/<id>/，可选备份后删除）。
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

import config
from db.connection import get_conn
from plugins.market import packaging

PRESETS = ("market", "cobuild", "webchat", "tts", "pixel_art")
_ID_RE = re.compile(r"^[a-z][a-z0-9_]{1,31}$")
_PRESET_META = {
    "market": ("🛍️", "插件市场"),
    "cobuild": ("🤝", "多 AI 共建"),
    "webchat": ("💬", "网页会话"),
    "tts": ("🔊", "语音朗读"),
    "pixel_art": ("🎨", "像素画与插件绘制"),
}


def market_dir() -> Path:
    return Path(config.BASE_DIR) / "market"


def packages_dir() -> Path:
    return market_dir() / "packages"


def index_path() -> Path:
    return market_dir() / "index.json"


def plugins_dir() -> Path:
    return Path(config.BASE_DIR) / "plugins"


def _index() -> dict:
    path = index_path()
    if not path.is_file():
        return {"packages": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise packaging.MarketError("bad_index", f"market/index.json 不可读：{exc}") from exc
    if not isinstance(data, dict) or not isinstance(data.get("packages"), list):
        raise packaging.MarketError("bad_index", "market/index.json 结构不合法")
    return data


def _lib_kinds() -> dict[str, str]:
    path = plugins_dir() / "lib.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return {str(p.get("id")): str(p.get("kind") or "") for p in data.get("plugins") or []}
    except (OSError, ValueError):
        return {}


def _manifest(pid: str) -> dict | None:
    path = plugins_dir() / pid / "manifest.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except (OSError, ValueError):
        return None


def _installed(pid: str) -> bool:
    return (plugins_dir() / pid / "manifest.json").is_file()


def _fetch_package(entry: dict) -> bytes:
    """A 阶段：读本地 market/packages/<file>；B 阶段在此加 HTTP 分支。"""
    source = str(entry.get("source") or "local")
    if source != "local":
        raise packaging.MarketError("remote_not_implemented", "B 阶段远程包尚未实现")
    file_name = str(entry.get("file") or "")
    if not file_name or "/" in file_name or "\\" in file_name or ".." in file_name:
        raise packaging.MarketError("bad_index", f"包文件名不合法：{file_name}")
    path = packages_dir() / file_name
    if not path.is_file():
        raise packaging.MarketError("package_missing", f"本地包不存在：{file_name}")
    return path.read_bytes()


# ---------- 安装记录（market_installed） ----------
def _record(pid: str, version: str, source: str, status: str) -> None:
    now = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    payload = json.dumps({"id": pid, "version": version, "source": source,
                          "status": status, "at": now}, ensure_ascii=False)
    conn = get_conn()
    conn.execute(
        "INSERT INTO market_installed(id,version,source,installed_at,status,raw_json,live_json) "
        "VALUES(?,?,?,?,?,?,?) "
        "ON CONFLICT(id) DO UPDATE SET version=excluded.version, source=excluded.source, "
        "installed_at=excluded.installed_at, status=excluded.status, live_json=excluded.live_json",
        (pid, version, source, now, status, payload, payload),
    )
    conn.commit()


def _records() -> dict[str, dict]:
    try:
        rows = get_conn().execute("SELECT * FROM market_installed").fetchall()
    except Exception:
        return {}
    return {str(r["id"]): dict(r) for r in rows}


# ---------- 列表 ----------
def list_plugins() -> dict:
    idx = _index()
    kinds = _lib_kinds()
    records = _records()
    entries: dict[str, dict] = {}
    for pkg in idx.get("packages") or []:
        if not isinstance(pkg, dict):
            continue
        pid = str(pkg.get("id") or "")
        if not _ID_RE.fullmatch(pid):
            continue
        entries[pid] = {
            "id": pid,
            "name": str(pkg.get("name") or pid),
            "icon": str(pkg.get("icon") or "🧩"),
            "kind": str(pkg.get("kind") or kinds.get(pid) or "functional"),
            "desc": str(pkg.get("desc") or ""),
            "version": str(pkg.get("version") or ""),
            "installed": _installed(pid),
            "preset": pid in PRESETS,
            "package": True,
            "size": int(pkg.get("size") or 0),
            "sha256": str(pkg.get("sha256") or ""),
            "source": str(pkg.get("source") or "local"),
            "installed_at": (records.get(pid) or {}).get("installed_at", ""),
        }
    for pid in PRESETS:
        if pid in entries:
            continue
        icon, name = _PRESET_META.get(pid, ("🧩", pid))
        m = _manifest(pid) or {}
        entries[pid] = {
            "id": pid,
            "name": str(m.get("name") or name),
            "icon": str(m.get("icon") or icon),
            "kind": kinds.get(pid) or "functional",
            "desc": str(m.get("desc") or "预置插件"),
            "version": str(m.get("version") or ""),
            "installed": _installed(pid),
            "preset": True,
            "package": False,
            "size": 0,
            "sha256": "",
            "source": "local",
            "installed_at": (records.get(pid) or {}).get("installed_at", ""),
        }
    if plugins_dir().is_dir():
        for d in sorted(plugins_dir().iterdir(), key=lambda p: p.name):
            if not d.is_dir() or d.name in entries or d.name.startswith("."):
                continue
            m = _manifest(d.name)
            if m is None:
                continue
            entries[d.name] = {
                "id": d.name,
                "name": str(m.get("name") or d.name),
                "icon": str(m.get("icon") or "🧩"),
                "kind": kinds.get(d.name) or "functional",
                "desc": str(m.get("desc") or ""),
                "version": str(m.get("version") or ""),
                "installed": True,
                "preset": d.name in PRESETS,
                "package": False,
                "size": 0,
                "sha256": "",
                "source": "local",
                "installed_at": (records.get(d.name) or {}).get("installed_at", ""),
            }
    items = sorted(entries.values(), key=lambda x: (0 if x["preset"] else 1, x["name"]))
    return {"ok": True, "plugins": items, "presets": list(PRESETS)}


# ---------- 安装/卸载 ----------
def install(pid: str) -> dict:
    pid = str(pid or "").strip()
    if not _ID_RE.fullmatch(pid):
        return {"ok": False, "error": "bad_id", "message": "非法插件 id"}
    if pid in PRESETS:
        return {"ok": False, "error": "preset_protected", "message": "预置插件不可重新安装"}
    if _installed(pid):
        return {"ok": False, "error": "already_installed", "message": "插件已安装"}
    idx = _index()
    entry = next((p for p in idx.get("packages") or []
                  if isinstance(p, dict) and str(p.get("id")) == pid), None)
    if entry is None:
        return {"ok": False, "error": "no_package", "message": "index.json 中没有该插件包"}
    try:
        data = _fetch_package(entry)
        manifest = packaging.install_package(
            entry, data, plugins_dir(), market_dir() / ".tmp")
    except packaging.MarketError as exc:
        return {"ok": False, "error": exc.code, "message": exc.message}
    _record(pid, str(entry.get("version") or manifest.get("version") or ""), "local", "installed")
    return {"ok": True, "id": pid, "restart_required": True,
            "message": "安装完成，重启服务后生效"}


def uninstall(pid: str, delete_data: bool = False) -> dict:
    pid = str(pid or "").strip()
    if not _ID_RE.fullmatch(pid):
        return {"ok": False, "error": "bad_id", "message": "非法插件 id"}
    if pid in PRESETS:
        return {"ok": False, "error": "preset_protected", "message": "预置插件不可卸载"}
    if not _installed(pid):
        return {"ok": False, "error": "not_installed", "message": "插件未安装"}
    try:
        backup = packaging.remove_plugin(pid, plugins_dir(), market_dir() / ".trash")
    except packaging.MarketError as exc:
        return {"ok": False, "error": exc.code, "message": exc.message}
    data_backup = None
    if delete_data:
        data_backup = packaging.backup_private_data(
            pid, Path(config.DATA_DIR) / "plugins", Path(config.DATA_DIR) / "backup")
    _record(pid, "", "local", "removed")
    return {"ok": True, "id": pid, "restart_required": True,
            "plugin_backup": str(backup),
            "data_backup": str(data_backup) if data_backup else "",
            "message": "卸载完成，重启服务后生效"}


def handle(method: str, subpath: str, query: dict, body: dict):
    route = subpath.strip("/")
    body = body if isinstance(body, dict) else {}
    try:
        if method == "GET" and route == "list":
            return list_plugins()
        if method == "GET" and route == "index":
            return {"ok": True, **_index()}
        if method == "GET" and route == "status":
            pid = str((query or {}).get("id") or "").strip()
            return {"ok": True, "id": pid, "installed": _installed(pid),
                    "preset": pid in PRESETS,
                    "record": _records().get(pid)}
        if method == "POST" and route == "install":
            return install(body.get("id"))
        if method == "POST" and route == "uninstall":
            return uninstall(body.get("id"), bool(body.get("delete_data")))
    except packaging.MarketError as exc:
        return {"ok": False, "error": exc.code, "message": exc.message}
    if route in {"list", "index", "status", "install", "uninstall"}:
        return {"ok": False, "error": "method_not_allowed", "__status__": 405}
    return {"ok": False, "error": "not_found", "__status__": 404}
