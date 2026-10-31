"""插件信息卡 INFO.md 校验 smoke。"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from plugins.market.info import InfoError, parse_front_matter
from tools import gen_plugin_info_cards as gen

results: list[bool] = []


def check(name: str, cond, extra: str = "") -> None:
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""))


def main() -> int:
    targets = gen._targets()
    kinds = gen._kind_map()
    check("信息卡数量", len(targets) == 23, str(len(targets)))
    missing = [pid for pid, base in targets if not (base / "INFO.md").is_file()]
    check("INFO.md 齐全", not missing, ",".join(missing))
    errors = []
    for pid, base in targets:
        errors += gen._check_one(pid, base, kinds)
    check("字段与 manifest/schema 一致", not errors, " | ".join(errors[:5]))
    parsed = {}
    parse_errors = []
    for pid, base in targets:
        try:
            parsed[pid] = parse_front_matter((base / "INFO.md").read_text(encoding="utf-8"))
        except InfoError as exc:
            parse_errors.append(f"{pid}:{exc}")
    check("front matter 可解析", not parse_errors, " | ".join(parse_errors[:5]))
    check("id 与目录名一致", all(parsed.get(pid, {}).get("id") == pid for pid, _ in targets))
    check("summary 与 manifest.desc 一致",
          all(parsed.get(pid, {}).get("summary") == gen._manifest(pid, base).get("desc")
              for pid, base in targets))
    try:
        parse_front_matter("---\nid: x\n---\n")
    except InfoError:
        bad_rejected = True
    else:
        bad_rejected = False
    check("坏 front matter 被拒", bad_rejected)
    sensitive_ok = all(isinstance(parsed.get(pid, {}).get("sensitive_data", []), list)
                       and all(isinstance(x, str) and x.startswith("data/") and len(x) < 160
                               for x in parsed.get(pid, {}).get("sensitive_data", []))
                       for pid, _ in targets)
    check("sensitive_data 仅路径类别", sensitive_ok)
    print(f"\nRESULT: {results.count(True)}/{len(results)} PASS")
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
