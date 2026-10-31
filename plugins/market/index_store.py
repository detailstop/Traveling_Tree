"""市场 index 运行态：初始化复制、远程拉取、结构校验、原子写入。

A 阶段模板 market/index.json（5 预置）；运行态 data/plugins/market/index.json。
生产只接受 https；测试通过 monkeypatch _fetch_url 注入本地假源。
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


class IndexError_(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def template_path() -> Path:
    return Path(config.BASE_DIR) / "market" / "index.json"


def runtime_path() -> Path:
    return Path(config.DATA_DIR) / "plugins" / "market" / "index.json"


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


def validate(data, local_version: int = 0) -> dict:
    if not isinstance(data, dict) or not isinstance(data.get("packages"), list):
        raise IndexError_("invalid_structure", "index 结构不合法：需要 packages 数组")
    if not data["packages"]:
        raise IndexError_("invalid_structure", "packages 不能为空")
    seen = set()
    for item in data["packages"]:
        if not isinstance(item, dict):
            raise IndexError_("invalid_structure", "packages 条目必须是对象")
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
        raise IndexError_("invalid_structure", "顶层 version 必须是整数")
    if local_version and version < local_version:
        raise IndexError_("version_regression", f"版本回滚：远程 {version} < 本地 {local_version}")
    return data


def write_atomic(data: dict) -> None:
    path = runtime_path()
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
        raise IndexError_("write_failed", f"写入运行态 index 失败：{exc}") from exc


def ensure_runtime() -> Path:
    path = runtime_path()
    if path.is_file():
        return path
    tpl = _read(template_path())
    validate(tpl)
    write_atomic(tpl)
    return path


def read_runtime() -> dict:
    ensure_runtime()
    return _read(runtime_path())


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


def refresh(url: str) -> dict:
    url = str(url or "").strip()
    if not url:
        raise IndexError_("not_configured", "未配置 market_source_url")
    local = read_runtime()
    body = _fetch_url(url)
    try:
        remote = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        raise IndexError_("invalid_structure", f"远程 JSON 非法：{exc}") from exc
    validate(remote, int(local.get("version", 0) or 0))
    write_atomic(remote)
    return {"ok": True, "version": int(remote.get("version", 0)),
            "count": len(remote["packages"])}
