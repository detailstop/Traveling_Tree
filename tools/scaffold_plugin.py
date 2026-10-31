#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fill the plugin-development prompt template with plugin metadata.

Only performs placeholder substitution. It never writes into plugins/ and
never imports project business modules.

Usage:
    python tools/scaffold_plugin.py --id demo --name "演示插件" --kind functional --has-ui yes
    python tools/scaffold_plugin.py --id demo --name "演示插件" --kind library --has-ui no --out -
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "docs" / "appendix" / "prompts" / "plugin-dev-prompt.md"
DEFAULT_OUT = ROOT / "data" / "backup" / "scaffold"

PLACEHOLDERS = {
    "PLUGIN_ID": "id",
    "PLUGIN_NAME": "name",
    "PLUGIN_KIND": "kind",
    "HAS_UI": "has_ui",
    "ENTRY_OR_BACKEND": "entry_or_backend",
    "DEPENDS_ON_LIB": "depends_on",
    "NEEDS_DB": "needs_db",
    "NEEDS_DATA_DIR": "needs_data_dir",
    "PROVIDES": "provides",
    "TARGET_DIR": "target_dir",
}

ID_RE = re.compile(r"^[a-z][a-z0-9_]*$")
BOOL_TRUE = {"y", "yes", "true", "1", "是", "有"}
BOOL_FALSE = {"n", "no", "false", "0", "否", "无", ""}


def parse_bool(value: str, label: str) -> str:
    text = str(value or "").strip().lower()
    if text in BOOL_TRUE:
        return "是"
    if text in BOOL_FALSE:
        return "否"
    raise argparse.ArgumentTypeError(f"{label} 只接受 yes/no/true/false/是/否，收到：{value!r}")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="将插件开发提示词模板填充为可交给 AI 的 Markdown（不写 plugins/）。",
    )
    p.add_argument("--id", required=True, help="插件 id（^[a-z][a-z0-9_]*$，与目录名一致）")
    p.add_argument("--name", required=True, help="插件或卡片显示名")
    p.add_argument("--kind", required=True, choices=["functional", "library"],
                   help="functional=有卡片；library=无卡片底层下沉")
    p.add_argument("--has-ui", required=True, type=lambda v: parse_bool(v, "--has-ui"),
                   help="是否有前端卡片（yes/no）")
    p.add_argument("--entry-or-backend", default="feature.js",
                   help="入口形态，如 feature.js / backend.py（entries=[]）")
    p.add_argument("--depends-on", default="无", help="依赖的底层下沉插件，如 webchat；无则填 无")
    p.add_argument("--needs-db", default="否", type=lambda v: parse_bool(v, "--needs-db"),
                   help="是否需要业务表（yes/no）")
    p.add_argument("--needs-data-dir", default="否", type=lambda v: parse_bool(v, "--needs-data-dir"),
                   help="是否需要 data_dirs（yes/no）")
    p.add_argument("--provides", default="无", help="对外能力声明，如 [\"tts\"]；无则填 无")
    p.add_argument("--target-dir", default=None, help="落地目录（默认 plugins/<id>/）")
    p.add_argument("--out", default=str(DEFAULT_OUT),
                   help="输出目录（默认 data/backup/scaffold/）；传 - 输出到 stdout")
    return p


def render(template: str, values: dict[str, str]) -> tuple[str, list[str]]:
    text = template
    for key, field in PLACEHOLDERS.items():
        text = text.replace("{{" + key + "}}", values[field])
    remaining = sorted(set(re.findall(r"\{\{([A-Z0-9_]+)\}\}", text)))
    return text, remaining


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if not ID_RE.fullmatch(args.id):
        build_parser().error(f"--id 不合法（需匹配 ^[a-z][a-z0-9_]*$）：{args.id!r}")
    if not TEMPLATE.is_file():
        print(f"[error] 模板不存在：{TEMPLATE}", file=sys.stderr)
        return 2

    values = {
        "id": args.id,
        "name": args.name.strip(),
        "kind": args.kind,
        "has_ui": args.has_ui,
        "entry_or_backend": args.entry_or_backend.strip(),
        "depends_on": args.depends_on.strip(),
        "needs_db": args.needs_db,
        "needs_data_dir": args.needs_data_dir,
        "provides": args.provides.strip(),
        "target_dir": (args.target_dir or f"plugins/{args.id}/").strip(),
    }
    text, remaining = render(TEMPLATE.read_text(encoding="utf-8"), values)
    if remaining:
        print("[warn] 未替换的占位符：" + ", ".join("{{" + x + "}}" for x in remaining), file=sys.stderr)

    if args.out == "-":
        sys.stdout.write(text)
        return 0

    out_dir = Path(args.out).expanduser()
    if not out_dir.is_absolute():
        out_dir = (Path.cwd() / out_dir).resolve()
    else:
        out_dir = out_dir.resolve()
    plugins_root = (ROOT / "plugins").resolve()
    try:
        out_dir.relative_to(plugins_root)
    except ValueError:
        pass
    else:
        print("[error] 拒绝写入 plugins/ 目录；请改用 data/backup/scaffold 或其他位置。", file=sys.stderr)
        return 3

    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / f"{args.id}-prompt.md"
    target.write_text(text, encoding="utf-8", newline="\n")
    print(f"[ok] 已生成 {target}")
    if remaining:
        print("[warn] 生成文件仍含未替换占位符，请检查模板。", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
