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
from plugins.market.info import InfoError, read_info
from plugins.market import index_store, scaffold, validate as validate_pack

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


def _remote_map() -> dict[str, dict]:
    return {str(p.get("id")): p for p in index_store.read_remote().get("packages") or []
            if isinstance(p, dict) and p.get("id")}


def _local_map() -> dict[str, dict]:
    return {str(p.get("id")): p for p in index_store.read_local().get("packages") or []
            if isinstance(p, dict) and p.get("id")}


def _index() -> dict:
    remote = index_store.read_remote()
    local = index_store.read_local()
    merged = {str(p.get("id")): p for p in local.get("packages") or [] if isinstance(p, dict)}
    merged.update({str(p.get("id")): p for p in remote.get("packages") or [] if isinstance(p, dict)})
    return {"version": int(remote.get("version", 0) or 0),
            "packages": list(merged.values())}


def _lib_kinds() -> dict[str, str]:
    path = plugins_dir() / "lib.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return {str(p.get("id")): str(p.get("kind") or "") for p in data.get("plugins") or []}
    except (OSError, ValueError):
        return {}


def _manifest(pid: str) -> dict | None:
    path = plugins_dir() / pid / "manifest.json"
    if not path.is_file():
        path = market_dir() / "sources" / pid / "manifest.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except (OSError, ValueError):
        return None


def _installed(pid: str) -> bool:
    return (plugins_dir() / pid / "manifest.json").is_file()


def settings() -> dict:
    """只读市场私有配置：默认 A 阶段本地包目录；B 阶段可切市场仓库。"""
    path = Path(config.DATA_DIR) / "plugins" / "market" / "settings.json"
    default = {"market_source": "market/packages/", "market_source_url": ""}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            default.update({k: v for k, v in data.items()
                            if k in ("market_source", "market_source_url")})
    except (OSError, ValueError):
        pass
    return default


def _fetch_package(entry: dict) -> tuple[bytes, Path | None]:
    """优先 download_url 下载到 downloads/；否则读本地 packages/。返回 (bytes, 下载文件)。"""
    url = str(entry.get("download_url") or "").strip()
    if url:
        path = index_store.download_zip(url, str(entry.get("id")))
        return path.read_bytes(), path
    file_name = str(entry.get("file") or "")
    if not file_name or "/" in file_name or "\\" in file_name or ".." in file_name:
        raise packaging.MarketError("bad_index", f"包文件名不合法：{file_name}")
    path = packages_dir() / file_name
    if not path.is_file():
        raise packaging.MarketError("package_url_missing", "包地址未配置（download_url 为空且本地包缺失）")
    return path.read_bytes(), None


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
def _info_index() -> dict[str, dict]:
    """三源 INFO：plugins/*/INFO.md 优先，其次 market/sources/*/INFO.md。"""
    result: dict[str, dict] = {}
    errors: dict[str, str] = {}
    for base, source in ((plugins_dir(), "plugins"), (market_dir() / "sources", "source")):
        if not base.is_dir():
            continue
        for d in sorted(base.iterdir(), key=lambda p: p.name):
            info_path = d / "INFO.md"
            if not d.is_dir() or not info_path.is_file() or d.name in result:
                continue
            try:
                data = read_info(info_path)
                if str(data.get("id")) != d.name:
                    raise InfoError("INFO.id 与目录名不一致")
                data["_info_source"] = source
                result[d.name] = data
            except InfoError as exc:
                errors[d.name] = str(exc)
    return {"items": result, "errors": errors}


def list_plugins() -> dict:
    kinds = _lib_kinds()
    records = _records()
    infos = _info_index()
    remote = _remote_map()
    local = _local_map()
    ids = set(infos["items"]) | set(remote) | set(local) | set(PRESETS)
    if plugins_dir().is_dir():
        ids |= {d.name for d in plugins_dir().iterdir() if d.is_dir() and not d.name.startswith(".")}
    entries: dict[str, dict] = {}
    for pid in sorted(ids):
        info = infos["items"].get(pid)
        rp = remote.get(pid)
        lp = local.get(pid)
        pkg = rp or lp
        manifest = _manifest(pid) or {}
        installed = _installed(pid)
        name = str((info or {}).get("name") or (pkg or {}).get("name") or manifest.get("name") or pid)
        version = str((info or {}).get("version") or (pkg or {}).get("version") or manifest.get("version") or "")
        desc = str((info or {}).get("summary") or (pkg or {}).get("summary") or manifest.get("desc") or "")
        kind = str((info or {}).get("kind") or kinds.get(pid) or "functional")
        icon = str((info or {}).get("icon") or manifest.get("icon") or "🧩")
        if pid in PRESETS:
            source = "preset"
        elif pid in remote:
            source = "market"
        else:
            source = "local"
        ready = bool((pkg or {}).get("package_ready"))
        entries[pid] = {
            "id": pid, "name": name, "icon": icon, "kind": kind, "desc": desc,
            "version": version, "installed": installed, "preset": pid in PRESETS,
            "plugin_source": source, "source": source,
            "package": ready, "has_package": ready,
            "package_ready": ready,
            "size": int((pkg or {}).get("size") or 0),
            "sha256": str((pkg or {}).get("sha256") or ""),
            "download_url": str((pkg or {}).get("download_url") or ""),
            "info_source": (info or {}).get("_info_source", "none"),
            "info_error": infos["errors"].get(pid, ""),
            "installed_at": (records.get(pid) or {}).get("installed_at", ""),
        }
        if source == "market" and not ready:
            entries[pid]["package_error"] = "缺包信息"
    items = sorted(entries.values(), key=lambda x: (0 if x["preset"] else 1, x["name"]))
    return {"ok": True, "plugins": items, "presets": list(PRESETS),
            "index_version": int(index_store.read_remote().get("version", 0) or 0),
            "local_version": int(index_store.read_local().get("version", 0) or 0),
            "market_source_url": settings().get("market_source_url", ""),
            "info_errors": infos["errors"]}


# ---------- 安装/卸载 ----------
def install(pid: str) -> dict:
    pid = str(pid or "").strip()
    if not _ID_RE.fullmatch(pid):
        return {"ok": False, "error": "bad_id", "message": "非法插件 id"}
    if pid in PRESETS:
        return {"ok": False, "error": "preset_protected", "message": "预置插件不可重新安装"}
    if _installed(pid):
        return {"ok": False, "error": "already_installed", "message": "插件已安装"}
    entry = _remote_map().get(pid)
    if entry is None:
        return {"ok": False, "error": "no_package", "message": "仅公共库（remote_index）插件可安装"}
    if not entry.get("package_ready"):
        return {"ok": False, "error": "package_not_ready", "message": "包未就绪（package_ready=false）"}
    downloaded = None
    try:
        data, downloaded = _fetch_package(entry)
        manifest = packaging.install_package(
            entry, data, plugins_dir(), market_dir() / ".tmp")
    except packaging.MarketError as exc:
        return {"ok": False, "error": exc.code, "message": exc.message}
    except index_store.IndexError_ as exc:
        return {"ok": False, "error": exc.code, "message": exc.message}
    if downloaded is not None:
        try:
            downloaded.unlink(missing_ok=True)
        except OSError:
            pass
    _record(pid, str(entry.get("version") or manifest.get("version") or ""), "market", "installed")
    return {"ok": True, "id": pid, "restart_required": True,
            "message": "安装完成，重启服务后生效"}


def _test_tables(pid: str) -> list[str]:
    """通用测试规则：id 以 test 开头时，只收集其 schema 中 test_ 前缀的表。"""
    if not pid.startswith("test"):
        return []
    path = plugins_dir() / pid / "schema.sql"
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return []
    names = re.findall(r"CREATE TABLE(?: IF NOT EXISTS)?\s+([A-Za-z0-9_]+)", text, re.I)
    return [n for n in names if n.startswith("test_")]


def uninstall(pid: str, delete_data: bool = False, delete_tables: bool = False) -> dict:
    pid = str(pid or "").strip()
    if not _ID_RE.fullmatch(pid):
        return {"ok": False, "error": "bad_id", "message": "非法插件 id"}
    if pid in PRESETS:
        return {"ok": False, "error": "preset_protected", "message": "预置插件不可卸载"}
    test_tables = _test_tables(pid) if delete_tables else []
    if delete_tables and not test_tables:
        return {"ok": False, "error": "delete_tables_forbidden",
                "message": "仅 id 以 test 开头且声明 test_ 表的插件允许删除测试表"}
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
    table_backup = ""
    dropped: list[str] = []
    if delete_tables:
        # 正式规则：卸载不 DROP 主库表；唯一例外是 test* 插件的 test_ 前缀测试表。
        stamp = time.strftime("%Y%m%d_%H%M%S")
        table_backup = str(packaging.backup_database(
            Path(config.DB_PATH), Path(config.DATA_DIR) / "backup" / f"uninstall_{pid}_{stamp}"))
        dropped = packaging.drop_test_tables(Path(config.DB_PATH), test_tables)
    _record(pid, "", "local", "removed")
    return {"ok": True, "id": pid, "restart_required": True,
            "plugin_backup": str(backup),
            "data_backup": str(data_backup) if data_backup else "",
            "table_backup": table_backup, "dropped_tables": dropped,
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
            return uninstall(body.get("id"), bool(body.get("delete_data")),
                             bool(body.get("delete_tables")))
        if method == "GET" and route == "scaffold/fields":
            out = scaffold.output_dir()
            return {"ok": True, "fields": scaffold.fields(),
                    "download_dir": str(out or ""), "configured": out is not None}
        if method == "POST" and route == "scaffold/generate":
            return {"ok": True, **scaffold.generate(body.get("id"), body.get("values") or {})}
        if method == "POST" and route == "validate-pack/check":
            return validate_pack.validate(body.get("path"))
        if method == "POST" and route == "validate-pack/pack":
            return validate_pack.pack(body.get("path"), body.get("out_dir"))
        if method == "GET" and route == "refresh-index":
            return {"ok": True, "configured": bool(settings().get("market_source_url")),
                    "version": int(_index().get("version", 0) or 0)}
        if method == "POST" and route == "refresh-index":
            return index_store.refresh(settings().get("market_source_url", ""))
    except packaging.MarketError as exc:
        return {"ok": False, "error": exc.code, "message": exc.message}
    except scaffold.ScaffoldError as exc:
        return {"ok": False, "error": exc.code, "message": exc.message}
    except index_store.IndexError_ as exc:
        return {"ok": False, "error": exc.code, "message": exc.message}
    if route in {"list", "index", "status", "install", "uninstall",
                 "scaffold/fields", "scaffold/generate", "refresh-index",
                 "validate-pack/check", "validate-pack/pack"}:
        return {"ok": False, "error": "method_not_allowed", "__status__": 405}
    return {"ok": False, "error": "not_found", "__status__": 404}
