"""构建插件市场包并回填运行态 index。

- 源：plugins/<id>/（17 个非预置）；sim 从 market/sources/sim/。
- 输出：market/packages/<id>.zip（不进 Git）。
- 回填：data/plugins/market/index.json 的 sha256/size/file/package_ready；不改 market/index.json。
- 排除：__pycache__、*.pyc、.git、data/、*.zip、*.tmp、.trash。
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PLUGINS = ROOT / "plugins"
SOURCES = ROOT / "market" / "sources"
PACKAGES = ROOT / "market" / "packages"
RUNTIME_INDEX = ROOT / "data" / "plugins" / "market" / "index.json"
FIXED_TIME = (2026, 1, 1, 0, 0, 0)
PRESETS = {"market", "cobuild", "webchat", "tts", "pixel_art"}
PACKAGED = [
    "ai", "aidebug", "bg_library", "book_reader", "expdata", "filejudge",
    "finance", "model_usage", "netexp", "pdf", "project_manager", "promptgen",
    "rivet", "russian", "schedule", "screeps", "urlarch", "sim",
]
EXCLUDE_DIRS = {"__pycache__", ".git", "data", ".trash"}


def source_dir(pid: str) -> Path:
    direct = PLUGINS / pid
    if direct.is_dir() and (direct / "manifest.json").is_file():
        return direct
    return SOURCES / pid


def included(path: Path, base: Path) -> bool:
    rel = path.relative_to(base)
    if any(part in EXCLUDE_DIRS for part in rel.parts):
        return False
    if path.suffix == ".pyc":
        return False
    if path.name.endswith((".zip", ".tmp")):
        return False
    return True


def validate_zip(path: Path) -> None:
    with zipfile.ZipFile(path) as zf:
        for info in zf.infolist():
            name = info.filename
            if name.startswith("/") or "\\" in name or ".." in name.split("/") or ":" in name:
                raise SystemExit(f"非法 zip 条目：{name}")
            parts = name.split("/")
            if "__pycache__" in parts or "data" in parts:
                raise SystemExit(f"zip 含排除目录：{name}")
            if name.endswith(".pyc"):
                raise SystemExit(f"zip 含 .pyc：{name}")


def build(pid: str) -> dict:
    src = source_dir(pid)
    manifest = src / "manifest.json"
    if not manifest.is_file():
        raise SystemExit(f"源目录缺少 manifest.json：{src}")
    data = json.loads(manifest.read_text(encoding="utf-8"))
    if str(data.get("id")) != pid:
        raise SystemExit(f"manifest.id 与目录不一致：{data.get('id')} != {pid}")
    files = sorted(p for p in src.rglob("*") if p.is_file() and included(p, src))
    if not files:
        raise SystemExit(f"源目录为空：{src}")
    PACKAGES.mkdir(parents=True, exist_ok=True)
    zip_path = PACKAGES / f"{pid}.zip"
    tmp = zip_path.with_name(zip_path.name + ".tmp")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in files:
            arc = str(path.relative_to(src)).replace("\\", "/")
            info = zipfile.ZipInfo(arc, FIXED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            zf.writestr(info, path.read_bytes())
    validate_zip(tmp)
    os.replace(tmp, zip_path)
    blob = zip_path.read_bytes()
    return {"id": pid, "file": zip_path.name, "size": len(blob),
            "sha256": hashlib.sha256(blob).hexdigest()}


def backfill(items: list[dict]) -> None:
    if not RUNTIME_INDEX.is_file():
        raise SystemExit(f"缺少运行态 index：{RUNTIME_INDEX}（先启动一次市场初始化）")
    data = json.loads(RUNTIME_INDEX.read_text(encoding="utf-8"))
    by_id = {str(p.get("id")): p for p in data.get("packages") or [] if isinstance(p, dict)}
    for item in items:
        entry = by_id.get(item["id"])
        if entry is None:
            raise SystemExit(f"运行态 index 缺少条目：{item['id']}")
        if item["id"] in PRESETS:
            raise SystemExit(f"预置插件不应打包：{item['id']}")
        entry["sha256"] = item["sha256"]
        entry["size"] = item["size"]
        entry["file"] = item["file"]
        entry["package_ready"] = True
        entry["download_url"] = str(entry.get("download_url") or "")
    RUNTIME_INDEX.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                             encoding="utf-8", newline="\n")


def main(argv: list[str]) -> int:
    ids = argv or PACKAGED
    for pid in ids:
        if pid in PRESETS:
            raise SystemExit(f"预置插件不打包：{pid}")
    items = [build(pid) for pid in ids]
    backfill(items)
    for item in items:
        print(f"{item['id']:16s} {item['file']:22s} {item['size']:8d} B  {item['sha256']}")
    print(f"\nbuilt {len(items)} packages；runtime index 已回填 {RUNTIME_INDEX}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
