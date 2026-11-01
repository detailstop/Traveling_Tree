"""市场双索引：remote_index（拉取覆盖）+ local_index（本地 INFO 组装）。

展示四源合并：plugins INFO > remote > local（market/sources 已移除）。
旧 data/plugins/market/index.json 一次性迁移后删除。
"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path

import config

ID_RE = re.compile(r"^[a-z0-9_]+$")
SHA_RE = re.compile(r"^[0-9a-f]{64}$")
MAX_BYTES = 4 * 1024 * 1024
MARKET_IDS = ("finance", "promptgen")


class IndexError_(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def base_dir() -> Path:
    return Path(config.DATA_DIR) / "plugins" / "market"


def template_path() -> Path:
    return Path(config.BASE_DIR) / "market" / "index.json"


def legacy_path() -> Path:
    return local_path().with_name("index.json")


def local_path() -> Path:
    return base_dir() / "local_index.json"


def remote_path() -> Path:
    return base_dir() / "remote_index.json"


def downloads_dir() -> Path:
    return base_dir() / "downloads"


def _read(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise IndexError_("invalid_structure", f"index 不可读：{exc}") from exc


def _check_file(value: str) -> None:
    if not value:
        return
    if "/" in value or "\\" in value or ".." in value or value.startswith(("/", "\\")) or re.match(r"^[A-Za-z]:", value):
        raise IndexError_("invalid_structure", f"file 非法：{value}")


def validate(data, local_version: int = 0, allow_empty: bool = False) -> dict:
    if not isinstance(data, dict) or not isinstance(data.get("packages"), list):
        raise IndexError_("invalid_structure", "需要 packages 数组")
    if not data["packages"] and not allow_empty:
        raise IndexError_("invalid_structure", "packages 不能为空")
    seen = set()
    for item in data["packages"]:
        if not isinstance(item, dict):
            raise IndexError_("invalid_structure", "条目必须是对象")
        for key in ("id", "name", "version", "kind", "desc", "summary",
                    "has_ui", "icon", "package_ready"):
            if key not in item:
                raise IndexError_("invalid_structure", f"条目缺字段：{key}")
        pid = item.get("id")
        if not isinstance(pid, str) or not ID_RE.fullmatch(pid):
            raise IndexError_("invalid_structure", f"id 非法：{pid!r}")
        if pid in seen:
            raise IndexError_("invalid_structure", f"id 重复：{pid}")
        seen.add(pid)
        if not isinstance(item.get("has_ui"), bool) or not isinstance(item.get("package_ready"), bool):
            raise IndexError_("invalid_structure", f"{pid}: has_ui/package_ready 必须是布尔")
        if not isinstance(item.get("size"), int) or item["size"] < 0:
            raise IndexError_("invalid_structure", f"{pid}: size 必须是非负整数")
        sha = str(item.get("sha256") or "")
        if sha and not SHA_RE.fullmatch(sha):
            raise IndexError_("invalid_structure", f"{pid}: sha256 非法")
        if item.get("package_ready") and not (sha and item.get("file")):
            raise IndexError_("invalid_structure", f"{pid}: package_ready=true 需要 sha256/file")
        _check_file(str(item.get("file") or ""))
        url = str(item.get("download_url") or "")
        if url and not url.startswith("https://"):
            raise IndexError_("invalid_structure", f"{pid}: download_url 必须 https 或空")
    version = data.get("version", 0)
    if not isinstance(version, int):
        raise IndexError_("invalid_structure", "version 必须是整数")
    if local_version and version < local_version:
        raise IndexError_("version_regression", f"版本回滚：远程 {version} < 本地 {local_version}")
    return data


def _write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    try:
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                       encoding="utf-8", newline="\n")
        os.replace(tmp, path)
    except OSError as exc:
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass
        raise IndexError_("write_failed", f"写入失败：{exc}") from exc


def _info_entries() -> list[dict]:
    from plugins.market.info import read_info
    out = []
    plugins = Path(config.BASE_DIR) / "plugins"
    for d in sorted(plugins.iterdir(), key=lambda p: p.name):
        if not d.is_dir() or not (d / "INFO.md").is_file():
            continue
        info = read_info(d / "INFO.md")
        out.append({
            "id": d.name, "name": info["name"], "version": info["version"],
            "kind": info.get("kind") or "functional", "desc": info["summary"],
            "summary": info["summary"], "has_ui": bool(info.get("has_ui")),
            "icon": str(info.get("icon") or "📦"), "sha256": "", "size": 0,
            "file": "", "download_url": "", "source": "local",
            "signature": "", "signed_by": "", "package_ready": False,
        })
    return out


def _local_packages(entries: list[dict]) -> dict:
    data = {"version": 1, "packages": []}
    for e in entries:
        if e["id"] in MARKET_IDS:
            continue
        data["packages"].append(e)
    return data


def ensure_runtime() -> None:
    lp, rp, legacy = local_path(), remote_path(), legacy_path()
    if lp.is_file() and rp.is_file():
        return
    entries = _info_entries()
    local = _local_packages(entries)
    remote = {"version": 1, "packages": []}
    if legacy.is_file():
        legacy_data = _read(legacy)
        by_id = {str(p.get("id")): p for p in legacy_data.get("packages") or []
                 if isinstance(p, dict)}
        for pid in MARKET_IDS:
            if pid in by_id:
                remote["packages"].append(by_id[pid])
        remote["version"] = int(legacy_data.get("version", 1) or 1)
    validate(local, allow_empty=True)
    validate(remote, allow_empty=True)
    _write(rp, remote)
    _write(lp, local)
    if legacy.is_file():
        legacy.unlink()


def read_local() -> dict:
    ensure_runtime()
    return _read(local_path())


def read_remote() -> dict:
    ensure_runtime()
    return _read(remote_path())


def refresh(url: str) -> dict:
    url = str(url or "").strip()
    if not url:
        raise IndexError_("not_configured", "未配置 market_source_url")
    current = read_remote()
    body = _fetch_url(url)
    try:
        remote = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        raise IndexError_("invalid_structure", f"远程 JSON 非法：{exc}") from exc
    validate(remote, int(current.get("version", 0) or 0))
    _write(remote_path(), remote)
    return {"ok": True, "version": int(remote.get("version", 0)),
            "count": len(remote["packages"])}


def _fetch_url(url: str) -> bytes:
    if not url.startswith("https://"):
        raise IndexError_("insecure_url", "仅允许 https:// 市场源")
    req = urllib.request.Request(url, headers={"User-Agent": "TravelingTree-market/1"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read(MAX_BYTES + 1)
    except urllib.error.HTTPError as exc:
        raise IndexError_("http_error", f"HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise IndexError_("network_error", f"网络错误：{exc.reason}") from exc
    except OSError as exc:
        raise IndexError_("network_error", f"网络错误：{exc}") from exc
    if len(body) > MAX_BYTES:
        raise IndexError_("invalid_structure", "远程 index 过大")
    return body


def download_zip(url: str, pid: str) -> Path:
    """下载到 downloads/；调用方校验后删除。失败保留。"""
    if not url.startswith("https://"):
        raise IndexError_("insecure_url", "仅允许 https 下载")
    downloads_dir().mkdir(parents=True, exist_ok=True)
    target = downloads_dir() / f"{pid}.zip"
    target.write_bytes(_fetch_url(url))
    return target
