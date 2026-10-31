"""构建本地插件市场包：market/sources/<id>/ → market/packages/<id>.zip + index.json。

用法：
  python tools/build_market_packages.py            # 默认构建 sim
  python tools/build_market_packages.py sim other  # 指定 id
"""
from __future__ import annotations

import hashlib
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "market" / "sources"
PACKAGES = ROOT / "market" / "packages"
INDEX = ROOT / "market" / "index.json"
FIXED_TIME = (2026, 1, 1, 0, 0, 0)


def _kind_map() -> dict[str, str]:
    try:
        data = json.loads((ROOT / "plugins" / "lib.json").read_text(encoding="utf-8"))
        return {str(p.get("id")): str(p.get("kind") or "functional") for p in data.get("plugins") or []}
    except (OSError, ValueError):
        return {}


def build(pid: str) -> dict:
    src = SOURCES / pid
    manifest_path = src / "manifest.json"
    if not manifest_path.is_file():
        raise SystemExit(f"源目录缺少 manifest.json：{src}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if str(manifest.get("id")) != pid:
        raise SystemExit(f"manifest.id 与目录不一致：{manifest.get('id')} != {pid}")
    files = sorted(p for p in src.rglob("*") if p.is_file())
    PACKAGES.mkdir(parents=True, exist_ok=True)
    zip_path = PACKAGES / f"{pid}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in files:
            info = zipfile.ZipInfo(str(path.relative_to(src)).replace("\\", "/"), FIXED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            zf.writestr(info, path.read_bytes())
    data = zip_path.read_bytes()
    kinds = _kind_map()
    return {
        "id": pid,
        "name": str(manifest.get("name") or pid),
        "icon": str(manifest.get("icon") or "🧩"),
        "version": str(manifest.get("version") or "1.0"),
        "kind": kinds.get(pid) or "functional",
        "desc": str(manifest.get("desc") or ""),
        "sha256": hashlib.sha256(data).hexdigest(),
        "size": len(data),
        "file": zip_path.name,
        "source": "local",
        "download_url": "",
        "signature": "",
        "signed_by": "",
    }


def main(argv: list[str]) -> int:
    ids = argv or ["sim"]
    index = {"packages": []}
    if INDEX.is_file():
        try:
            index = json.loads(INDEX.read_text(encoding="utf-8"))
        except ValueError as exc:
            raise SystemExit(f"index.json 解析失败：{exc}")
    by_id = {str(p.get("id")): p for p in index.get("packages") or [] if isinstance(p, dict)}
    for pid in ids:
        item = build(pid)
        by_id[pid] = item
        print(f"built {pid}: {item['size']} B sha256={item['sha256'][:12]}…")
    index["version"] = 1
    index["packages"] = [by_id[k] for k in sorted(by_id)]
    INDEX.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"index: {INDEX} ({len(index['packages'])} packages)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
