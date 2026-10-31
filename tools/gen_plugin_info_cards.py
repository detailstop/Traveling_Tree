"""插件信息卡 INFO.md 生成/校验（标准库，不引第三方库）。

用法：
  python tools/gen_plugin_info_cards.py          # 为缺失的插件生成骨架（不覆盖）
  python tools/gen_plugin_info_cards.py --force  # 覆盖重写
  python tools/gen_plugin_info_cards.py --check  # 校验全部 INFO.md
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from plugins.market.info import OPTIONAL, REQUIRED, InfoError, parse_front_matter

PLUGINS = ROOT / "plugins"
SOURCES = ROOT / "market" / "sources"


def _manifest(pid: str, base: Path) -> dict:
    return json.loads((base / "manifest.json").read_text(encoding="utf-8"))


def _schema_tables(pid: str, base: Path) -> list[str]:
    path = base / "schema.sql"
    if not path.is_file():
        return []
    text = path.read_text(encoding="utf-8")
    return re.findall(r"CREATE TABLE(?: IF NOT EXISTS)?\s+([A-Za-z0-9_]+)", text, re.I)


def _kind_map() -> dict[str, str]:
    try:
        data = json.loads((PLUGINS / "lib.json").read_text(encoding="utf-8"))
        return {str(p.get("id")): str(p.get("kind") or "functional") for p in data.get("plugins") or []}
    except (OSError, ValueError):
        return {}


def _expected(pid: str, base: Path, kinds: dict[str, str]) -> dict:
    m = _manifest(pid, base)
    entries = [str(e.get("id")) for e in (m.get("entries") or [])]
    backend = m.get("backend")
    db = m.get("db")
    db_key = None
    if isinstance(db, dict):
        db_key = str(db.get("module_key") or pid)
    elif isinstance(db, str):
        db_key = pid
    return {
        "id": pid,
        "summary": str(m.get("desc") or ""),
        "name": str(m.get("name") or pid),
        "version": str(m.get("version") or ""),
        "kind": kinds.get(pid) or "functional",
        "has_ui": bool(entries),
        "has_backend": bool(backend),
        "db_module_key": db_key,
        "routes_prefix": f"/api/plugin/{pid}" if backend else None,
        "entries": entries,
        "tables": _schema_tables(pid, base),
        "data_dirs": [str(x) for x in (m.get("data_dirs") or [])],
        "shared_features": [str(x) for x in (m.get("shared_features") or [])],
        "provides": [str(x) for x in (m.get("provides") or [])],
        "consumes": [str(x) for x in (m.get("consumes") or [])],
    }


def _fmt(value) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, list):
        return "[" + ", ".join(_fmt(v) for v in value) + "]"
    return str(value)


def _render(pid: str, base: Path, exp: dict) -> str:
    m = _manifest(pid, base)
    name = exp["name"]
    desc = exp["summary"]
    frontier = ["---"]
    for key in REQUIRED:
        frontier.append(f"{key}: {_fmt(exp[key])}")
    frontier.append("entries: " + _fmt(exp["entries"]))
    frontier.append("tables: " + _fmt(exp["tables"]))
    frontier.append("data_dirs: " + _fmt(exp["data_dirs"]))
    frontier.append("shared_features: " + _fmt(exp["shared_features"]))
    frontier.append("provides: " + _fmt(exp["provides"]))
    frontier.append("consumes: " + _fmt(exp["consumes"]))
    frontier.append(f"market_package: {'true' if pid == 'sim' else 'false'}")
    frontier.append("source: local")
    frontier.append("known_limits: ")
    frontier.append("sensitive_data: []")
    frontier.append("---")
    tables = "\n".join(f"- `{t}`" for t in exp["tables"]) or "- 无业务表"
    entries = "、".join(exp["entries"]) or "无（backend-only）"
    body = f"""
# {name} 信息卡

## 职责
{desc}

## 入口与路由
- entry：{entries}
- 后端路由：{exp['routes_prefix'] or '无'}

## 数据表
{tables}

## 依赖
- provides：{', '.join(exp['provides']) or '无'}
- consumes：{', '.join(exp['consumes']) or '无'}

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
"""
    return "\n".join(frontier) + body


def _check_one(pid: str, base: Path, kinds: dict[str, str]) -> list[str]:
    path = base / "INFO.md"
    if not path.is_file():
        return [f"{pid}: 缺少 INFO.md"]
    errors = []
    try:
        info = parse_front_matter(path.read_text(encoding="utf-8"))
    except InfoError as exc:
        return [f"{pid}: 解析失败：{exc}"]
    exp = _expected(pid, base, kinds)
    for key in ("id", "name", "version", "kind", "has_ui", "has_backend",
                "db_module_key", "routes_prefix"):
        if info.get(key) != exp[key]:
            errors.append(f"{pid}: {key}={info.get(key)!r} 应为 {exp[key]!r}")
    if info.get("id") != pid:
        errors.append(f"{pid}: id 与目录名不一致")
    for key in ("entries", "tables", "data_dirs", "shared_features", "provides", "consumes"):
        if info.get(key) != exp[key]:
            errors.append(f"{pid}: {key}={info.get(key)!r} 应为 {exp[key]!r}")
    for key in OPTIONAL:
        if key in info and not isinstance(info[key], (str, int, bool, list, type(None))):
            errors.append(f"{pid}: 可选字段 {key} 类型非法")
    if not str(info.get("summary") or "").strip():
        errors.append(f"{pid}: summary 为空")
    return errors


def _targets() -> list[tuple[str, Path]]:
    out = [(p.name, p) for p in sorted(PLUGINS.iterdir()) if p.is_dir()]
    if SOURCES.is_dir():
        out += [(p.name, p) for p in sorted(SOURCES.iterdir()) if p.is_dir()]
    return out


def main(argv: list[str]) -> int:
    force = "--force" in argv
    check = "--check" in argv
    kinds = _kind_map()
    failed = 0
    for pid, base in _targets():
        if check:
            errors = _check_one(pid, base, kinds)
            print(("PASS " if not errors else "FAIL ") + pid + ("" if not errors else "  " + " | ".join(errors)))
            failed += len(errors)
        else:
            path = base / "INFO.md"
            if path.exists() and not force:
                print(f"SKIP {pid}（已存在，--force 覆盖）")
                continue
            exp = _expected(pid, base, kinds)
            path.write_text(_render(pid, base, exp), encoding="utf-8", newline="\n")
            print(f"WROTE {pid}")
    if check:
        print(f"\nINFO CHECK: {'PASS' if not failed else 'FAIL'} ({failed} 项问题)")
        return 0 if not failed else 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
