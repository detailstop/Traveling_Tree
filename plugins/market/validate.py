"""插件校验与打包核心（market 子功能，唯一校验出口）。

validate(path) -> 固定 JSON；
pack(path, out_dir=None) -> 校验通过后打包到 data/backup/market_build/。
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import time
import zipfile
from pathlib import Path

from plugins.market import deps
from plugins.market.info import OPTIONAL, REQUIRED, InfoError, parse_front_matter

TOOL_VERSION = "1.0"
ERROR_CODES = (
    "path_empty", "path_not_found", "path_not_dir", "manifest_missing",
    "manifest_invalid", "manifest_id_invalid", "manifest_id_mismatch",
    "schema_version_invalid", "feature_missing", "backend_missing",
    "dependencies_invalid", "dependency_name_invalid", "dependency_version_invalid",
    "info_missing", "info_invalid", "info_field_missing", "info_id_mismatch",
    "source_package_mismatch", "source_invalid", "tables_mismatch",
    "has_ui_mismatch", "has_backend_mismatch", "pack_empty",
)
WARNING_CODES = (
    "readme_missing", "readme_section_missing", "info_optional_missing",
    "known_limits_empty",
)
REQUIRED_README = ("职责", "入口与路由", "数据表", "依赖", "注意事项")
EXCLUDE_DIRS = {"__pycache__", ".git", "data", ".trash"}
FIXED_TIME = (2026, 1, 1, 0, 0, 0)
ID_RE = re.compile(r"^[a-z][a-z0-9_]{1,31}$")


def _err(errors: list, code: str, file: str = "", message: str = "", field: str = "") -> None:
    item = {"code": code, "file": file, "message": message}
    if field:
        item["field"] = field
    errors.append(item)


def _warn(warnings: list, code: str, file: str = "", message: str = "", field: str = "") -> None:
    item = {"code": code, "file": file, "message": message}
    if field:
        item["field"] = field
    warnings.append(item)


def _schema_tables(path: Path) -> list[str]:
    if not path.is_file():
        return []
    text = path.read_text(encoding="utf-8")
    return re.findall(r"CREATE TABLE(?: IF NOT EXISTS)?\s+([A-Za-z0-9_]+)", text, re.I)


def validate(path: str) -> dict:
    result = {"ok": False, "path": str(path or ""), "id": "", "errors": [], "warnings": [],
              "checked_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "tool_version": TOOL_VERSION}
    errors, warnings = result["errors"], result["warnings"]
    if not str(path or "").strip():
        _err(errors, "path_empty", "", "路径为空")
        return result
    root = Path(str(path)).expanduser()
    if not root.exists():
        _err(errors, "path_not_found", str(root), "路径不存在")
        return result
    if not root.is_dir():
        _err(errors, "path_not_dir", str(root), "不是目录")
        return result
    root = root.resolve()
    result["path"] = str(root)
    result["id"] = root.name
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file():
        _err(errors, "manifest_missing", "manifest.json", "缺少 manifest.json")
        return result
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        _err(errors, "manifest_invalid", "manifest.json", f"manifest 不可读：{exc}")
        return result
    if not isinstance(manifest, dict):
        _err(errors, "manifest_invalid", "manifest.json", "manifest 顶层必须是对象")
        return result
    mid = str(manifest.get("id") or "")
    result["id"] = mid or root.name
    if not ID_RE.fullmatch(mid):
        _err(errors, "manifest_id_invalid", "manifest.json", f"id 非法：{mid!r}")
    if mid != root.name:
        _err(errors, "manifest_id_mismatch", "manifest.json", f"manifest.id={mid!r} 与目录名 {root.name!r} 不一致")
    if manifest.get("schema_version") != 2:
        _err(errors, "schema_version_invalid", "manifest.json", "schema_version 必须为 2")
    entries = manifest.get("entries") or []
    if not isinstance(entries, list):
        _err(errors, "manifest_invalid", "manifest.json", "entries 必须是数组")
        entries = []
    for entry in entries:
        if not isinstance(entry, dict):
            _err(errors, "manifest_invalid", "manifest.json", "entry 必须是对象")
            continue
        feature = str(entry.get("feature") or "")
        if not feature or not (root / feature).is_file():
            _err(errors, "feature_missing", feature or "feature.js",
                 f"entry {entry.get('id')!r} 缺 feature 文件")
    backend = manifest.get("backend")
    if backend:
        backend_file = backend.get("file") if isinstance(backend, dict) else backend
        if not isinstance(backend_file, str) or not (root / backend_file).is_file():
            _err(errors, "backend_missing", str(backend_file or "backend.py"), "声明 backend 但文件缺失")

    # manifest.dependencies（round 107）：只校验声明结构，不做存在性/版本判定（检测在 market 接口）。
    for field, code, message in deps.declaration_errors(manifest):
        _err(errors, code, "manifest.json", message, field)

    info_path = root / "INFO.md"
    info = None
    if not info_path.is_file():
        _err(errors, "info_missing", "INFO.md", "缺少 INFO.md")
    else:
        try:
            info = parse_front_matter(info_path.read_text(encoding="utf-8"))
        except InfoError as exc:
            _err(errors, "info_invalid", "INFO.md", f"INFO 解析失败：{exc}")
    if info is not None:
        missing = [k for k in REQUIRED if k not in info]
        for key in missing:
            _err(errors, "info_field_missing", "INFO.md", f"缺必需字段：{key}", key)
        if str(info.get("id") or "") != mid:
            _err(errors, "info_id_mismatch", "INFO.md", f"INFO.id={info.get('id')!r} 与 manifest.id={mid!r} 不一致")
        source = info.get("source")
        package = info.get("market_package")
        if source == "market" and package is not True:
            _err(errors, "source_package_mismatch", "INFO.md", "source=market 要求 market_package=true")
        if source in ("preset", "local") and package is not False:
            _err(errors, "source_package_mismatch", "INFO.md", "source=preset/local 要求 market_package=false")
        if source not in ("preset", "market", "local"):
            _err(errors, "source_invalid", "INFO.md", f"source 非法：{source!r}（preset|market|local）")
        tables = info.get("tables")
        actual = _schema_tables(root / "schema.sql")
        if actual:
            if not isinstance(tables, list) or sorted(map(str, tables)) != sorted(actual):
                _err(errors, "tables_mismatch", "INFO.md",
                     f"tables={tables!r} 与 schema 表 {actual!r} 不一致")
        elif tables not in (None, []):
            _err(errors, "tables_mismatch", "INFO.md", "无 schema.sql 但 INFO.tables 非空")
        has_ui = bool(entries)
        if "has_ui" in info and bool(info["has_ui"]) != has_ui:
            _err(errors, "has_ui_mismatch", "INFO.md", "INFO.has_ui 与 manifest entries 不一致")
        if "has_backend" in info and bool(info["has_backend"]) != bool(backend):
            _err(errors, "has_backend_mismatch", "INFO.md", "INFO.has_backend 与 manifest backend 不一致")
        for key in OPTIONAL:
            if key not in info:
                _warn(warnings, "info_optional_missing", "INFO.md", f"可选字段缺失：{key}", key)
        if not str(info.get("known_limits") or "").strip():
            _warn(warnings, "known_limits_empty", "INFO.md", "known_limits 为空", "known_limits")

    readme = root / "README.md"
    if not readme.is_file():
        _warn(warnings, "readme_missing", "README.md", "缺少 README.md")
    else:
        text = readme.read_text(encoding="utf-8")
        for section in REQUIRED_README:
            if not re.search(r"^#+\s*" + re.escape(section), text, re.M):
                _warn(warnings, "readme_section_missing", "README.md",
                      f"缺章节：{section}", section)

    result["ok"] = not errors
    return result


def _included(path: Path, base: Path) -> bool:
    rel = path.relative_to(base)
    if any(part in EXCLUDE_DIRS for part in rel.parts):
        return False
    if path.suffix == ".pyc" or path.name.endswith((".zip", ".tmp")):
        return False
    return True


def _validate_zip(path: Path) -> None:
    with zipfile.ZipFile(path) as zf:
        for info in zf.infolist():
            name = info.filename
            if name.startswith("/") or "\\" in name or ".." in name.split("/") or ":" in name:
                raise ValueError(f"非法 zip 条目：{name}")
            parts = name.split("/")
            if "__pycache__" in parts or "data" in parts or name.endswith(".pyc"):
                raise ValueError(f"zip 含排除内容：{name}")


def pack(path: str, out_dir: str | None = None) -> dict:
    result = validate(path)
    if not result["ok"]:
        return result
    root = Path(result["path"])
    pid = result["id"]
    out = Path(out_dir).expanduser() if out_dir else Path(__file__).resolve().parents[2] / "data" / "backup" / "market_build"
    if not out.is_absolute():
        out = (Path.cwd() / out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    files = sorted(p for p in root.rglob("*") if p.is_file() and _included(p, root))
    if not files:
        _err(result["errors"], "pack_empty", "", "没有可打包文件")
        result["ok"] = False
        return result
    target = out / f"{pid}.zip"
    tmp = target.with_name(target.name + ".tmp")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in files:
            arc = str(file.relative_to(root)).replace("\\", "/")
            info = zipfile.ZipInfo(arc, FIXED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            zf.writestr(info, file.read_bytes())
    _validate_zip(tmp)
    os.replace(tmp, target)
    blob = target.read_bytes()
    result.update({"ok": True, "zip_path": str(target), "size": len(blob),
                   "sha256": hashlib.sha256(blob).hexdigest()})
    return result
