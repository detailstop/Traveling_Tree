"""Generate the read-only Markdown summary from file_navigation.json."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "file_navigation.json"
TARGET = ROOT / "file_navigation.md"


def cell(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return str(value).replace("|", "\\|").replace("\r\n", "<br>").replace("\n", "<br>").strip()


def table(headers: list[str], rows: list[list[Any]]) -> list[str]:
    lines = ["| " + " | ".join(headers) + " |",
             "| " + " | ".join("---" for _ in headers) + " |"]
    lines.extend("| " + " | ".join(cell(value) for value in row) + " |" for row in rows)
    return lines


def render(data: dict[str, Any]) -> str:
    pending = data.get("pending") if isinstance(data.get("pending"), list) else []
    decided = data.get("decided") if isinstance(data.get("decided"), list) else []
    reviewed = [item for item in decided
                if isinstance(item, dict) and isinstance(item.get("review"), dict)]
    lines = [
        "# 文件导航清单（只读摘要）",
        "",
        "> 只读摘要，勿手改。本文件由 file_navigation.json 生成；结构与去留决定以 JSON 为准。",
        "",
        f"- 生成时间：{cell(data.get('generated_at'))}",
        f"- 轮次：{cell(data.get('round'))}",
        f"- 待办：{len(pending)} 条；已决定：{len(decided)} 条",
        "",
        "## 待办",
        "",
    ]
    lines.extend(table(
        ["路径", "移动计划", "指南计划", "摘要", "轮次", "创建时间"],
        [[item.get("path"), item.get("move_plan"), item.get("guide_plan"),
          item.get("summary"), item.get("round"), item.get("created_at")]
         for item in pending if isinstance(item, dict)],
    ))
    lines.extend(["", "## 已决定去留", ""])
    lines.extend(table(
        ["路径", "决定", "原因", "状态", "轮次", "时间", "备份路径"],
        [[item.get("path"), item.get("decision"), item.get("reason"),
          item.get("status"), item.get("round"), item.get("at"), item.get("backup_path")]
         for item in decided if isinstance(item, dict)],
    ))
    if reviewed:
        lines.extend(["", "## 文件审查分类与建议", ""])
        lines.extend(table(
            ["路径", "分类", "角色", "建议", "可替代性", "集成", "风险"],
            [[item.get("path"), (item.get("review") or {}).get("category", item.get("category")),
              (item.get("review") or {}).get("role"),
              (item.get("review") or {}).get("recommendation"),
              (item.get("review") or {}).get("substitutability"),
              (item.get("review") or {}).get("integration"),
              (item.get("review") or {}).get("risk")]
             for item in reviewed],
        ))
    lines.extend([
        "",
        "## 说明",
        "",
        "- 本文件由 `tools/gen_file_navigation_md.py` 从 `file_navigation.json` 生成。",
        "- 结构、历史记录和去留决定以 JSON 主数据源为准；本摘要不承载额外决定。",
        "",
    ])
    return "\n".join(lines)


def main() -> int:
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("file_navigation.json 顶层必须是对象")
    TARGET.write_text(render(data), encoding="utf-8", newline="\n")
    print(f"已生成 {TARGET}：待办 {len(data.get('pending', []))} 条；已决定 {len(data.get('decided', []))} 条")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
