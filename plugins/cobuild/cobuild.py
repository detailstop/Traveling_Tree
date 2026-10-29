# -*- coding: utf-8 -*-
"""多 AI 共建 · 协作声明与打卡留痕。

本项目由多个 AI（不同模型 / 不同会话）轮流接手维护，为了让每一次改动
都能被追溯、被交接，约定「改完必打卡」：

  - 声明与规则：本模块 ``RULES``（首页「关于多 AI 共建的声明」直接渲染）；
  - 打卡记录：数据源 ``data/ai_cobuild.json``，只追加、可标作废、不可删除；
  - 人类可读镜像：``docs/多AI共建日志.md``，每次写入自动重写，
    即使不启动 Web 服务，任何 AI / 人都能直接读文件接续工作。

对外接口：
    data()                          → 首页声明卡所需的完整数据
    checkin(agent, action, ...)     → 追加一条打卡（校验必填项）
    void_entry(entry_id, reason)    → 把一条记录标记作废（原文保留）

约定实现细节：
    - 路径在每次读写时从 config 取，便于测试替换 DATA_DIR / COBUILD_LOG_PATH；
    - 写入先写临时文件再 os.replace，避免并发/中断写出半截 JSON；
    - 同一进程内用 _lock 串行化「读-改-写」，Web 多线程下不会互相吞记录。
"""
from __future__ import annotations

import json
import os
import re
import threading
import uuid
from datetime import datetime
from pathlib import Path

import config

DATA_FILE = "ai_cobuild.json"
LOG_RELATIVE = Path("docs") / "多AI共建日志.md"

_lock = threading.Lock()

# ------------------------------------------------------------
# 声明正文（首页展示 + 日志文件同步）
# ------------------------------------------------------------
RULES: list[dict] = [
    {
        "title": "轮流接力",
        "detail": "同一时间只允许一个 AI 动手改本项目；上一位写完打卡记录、交代清楚后才轮到下一位，"
                  "不并行改同一处，避免互相覆盖。",
    },
    {
        "title": "先读后写",
        "detail": "开工前先读本声明、docs/多AI共建日志.md 最近几条，以及要改的文件，"
                  "确认没有别人做到一半、没人正在改同一处。",
    },
    {
        "title": "改动必留痕",
        "detail": "每次新增、修正、重构、删改之后，必须在首页「打卡记录」追加一条："
                  "时间（服务器自动生成）、协作者、类型、改动内容、涉及文件、备注。没有打卡的改动视为没做完。",
    },
    {
        "title": "如实写清",
        "detail": "只记真实发生的事：改了什么、为什么改、影响哪些文件、有没有风险或未完成项；"
                  "不夸大、不遗漏、不写「大概改好了」。",
    },
    {
        "title": "不覆盖他人成果",
        "detail": "要删除或大段重写别人写的内容，必须先打卡说明原因与影响范围，并保留可追溯的历史，"
                  "禁止直接抹掉上一位 AI 的思路。",
    },
    {
        "title": "只增不删",
        "detail": "打卡记录只能追加或标记「作废」，不得静默删除、篡改；作废也要写明原因，"
                  "让后来的人知道这条记录为什么不算数。",
    },
    {
        "title": "留下接手指南",
        "detail": "交接时在备注里写清「下一步做什么 / 已知问题 / 未完成项」，"
                  "让下一位 AI 不用猜、直接能接着干。",
    },
    {
        "title": "对用户负责",
        "detail": "需求不清楚、或操作可能破坏用户数据时，先问用户再动手，"
                  "不擅自改变项目方向、不替用户做不可逆的决定。",
    },
]

KINDS: list[tuple[str, str]] = [
    ("feature", "新增功能"),
    ("fix", "修正问题"),
    ("refactor", "重构"),
    ("ui", "界面样式"),
    ("docs", "文档说明"),
    ("data", "数据配置"),
    ("handoff", "交接同步"),
    ("other", "其他"),
]
KIND_LABELS = dict(KINDS)

_MAX_AGENT = 60
_MAX_ACTION = 400
_MAX_NOTE = 1000
_MAX_FILES = 20


# ------------------------------------------------------------
# 路径 / 读写
# ------------------------------------------------------------

def _data_path() -> Path:
    return Path(config.DATA_DIR) / DATA_FILE


def _log_path() -> Path:
    path = getattr(config, "COBUILD_LOG_PATH", None)
    if path:
        return Path(path)
    return Path(config.BASE_DIR) / LOG_RELATIVE


def _read() -> dict:
    """读取存储；文件缺失或损坏时当作空记录（不抛异常，页面不会因此白屏）。"""
    try:
        with open(_data_path(), encoding="utf-8") as f:
            store = json.load(f)
    except (OSError, ValueError):
        return {"checkins": []}
    if not isinstance(store, dict) or not isinstance(store.get("checkins"), list):
        return {"checkins": []}
    store["checkins"] = [c for c in store["checkins"] if isinstance(c, dict)]
    return store


def _write(store: dict) -> None:
    """原子写入 JSON，并同步重写 Markdown 镜像。"""
    path = _data_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(store, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)
    _write_markdown(store)


def _cell(value) -> str:
    """Markdown 表格单元格转义。"""
    text = str(value if value is not None else "")
    text = text.replace("\r", "").replace("\n", "<br>")
    return text.replace("|", "\\|")


def _write_markdown(store: dict) -> None:
    path = _log_path()
    rows = list(store.get("checkins") or [])
    total = len(rows)
    lines = [
        "# 多 AI 共建日志 · 旅行之木",
        "",
        "> 本文件由首页「关于多 AI 共建的声明」自动生成，数据源 `data/ai_cobuild.json`。",
        "> 追加记录请用首页「✍️ 打卡」或 CLI：`python main.py --cli cobuild add --agent 名字 --action \"改了什么\"`。",
        "> 手改本表格会在下次写入时被覆盖；请勿删除历史记录。",
        "",
        "## 基本规则",
        "",
    ]
    for i, rule in enumerate(RULES, 1):
        lines.append(f"{i}. **{rule['title']}** —— {rule['detail']}")
    lines += ["", f"## 打卡记录（共 {total} 条，最新在前）", ""]
    if rows:
        lines.append("| # | 时间 | 协作者 | 类型 | 改动内容 | 涉及文件 | 备注 |")
        lines.append("|---|---|---|---|---|---|---|")
        for i, c in enumerate(reversed(rows), 1):
            seq = total - i + 1
            action = _cell(c.get("action"))
            note = _cell(c.get("note"))
            if c.get("void"):
                action = f"~~{action}~~（已作废）"
                note = (f"作废原因：{_cell(c.get('void_reason') or '未填写')}　" + note).strip()
            files = c.get("files") or []
            lines.append("| {} | {} | {} | {} | {} | {} | {} |".format(
                seq,
                _cell(str(c.get("time", ""))[:16].replace("T", " ")),
                _cell(c.get("agent")),
                _cell(c.get("kind_label") or KIND_LABELS.get(c.get("kind", ""), c.get("kind"))),
                action,
                _cell("<br>".join(f"`{f}`" for f in files)) if files else "",
                note,
            ))
    else:
        lines.append("> 还没有打卡记录。第一位改完代码的 AI 请先打卡。")
    lines.append("")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("\n".join(lines), encoding="utf-8")
    except OSError:
        pass   # 镜像写失败不影响主数据


# ------------------------------------------------------------
# 序列化
# ------------------------------------------------------------

def _payload(store: dict) -> dict:
    checkins = [dict(c) for c in reversed(store.get("checkins") or [])]
    for c in checkins:
        c.setdefault("files", [])
        c.setdefault("void", False)
        c.setdefault("void_reason", "")
        c.setdefault("kind_label", KIND_LABELS.get(c.get("kind", ""), c.get("kind", "")))
    latest = checkins[0]["time"] if checkins else ""
    return {
        "ok": True,
        "rules": [dict(r) for r in RULES],
        "kinds": [{"id": k, "label": v} for k, v in KINDS],
        "checkins": checkins,
        "count": len(checkins),
        "latest": latest,
        "data_file": f"data/{DATA_FILE}",
        "log_file": _log_rel_display(),
    }


def _log_rel_display() -> str:
    """日志文件的展示路径：项目内即为 docs/多AI共建日志.md，测试/自定义时为绝对路径。"""
    path = _log_path()
    try:
        return path.relative_to(Path(config.BASE_DIR)).as_posix()
    except ValueError:
        return path.as_posix()


def data() -> dict:
    """首页声明卡数据（打卡记录最新在前）。"""
    with _lock:
        return _payload(_read())


# ------------------------------------------------------------
# 写操作
# ------------------------------------------------------------

def _norm_files(value) -> list[str]:
    if isinstance(value, (list, tuple)):
        raw = [str(v) for v in value]
    else:
        raw = re.split(r"[,，;；\n]", str(value or ""))
    out: list[str] = []
    for item in raw:
        text = item.strip().strip("`").strip()
        if text and text not in out:
            out.append(text)
    return out[:_MAX_FILES]


def checkin(agent: str, action: str, files=None, note: str = "", kind: str = "feature") -> dict:
    """追加一条打卡记录；返回最新全量数据（含新建的 entry）。"""
    agent = str(agent or "").strip()[:_MAX_AGENT]
    action = str(action or "").strip()[:_MAX_ACTION]
    note = str(note or "").strip()[:_MAX_NOTE]
    if not agent:
        return {"ok": False, "error": "请填写协作者（AI 名称 / 模型 / 会话）"}
    if not action:
        return {"ok": False, "error": "请填写本次改动内容"}
    kind = str(kind or "").strip()
    if kind not in KIND_LABELS:
        kind = "other"
    now = datetime.now().astimezone()
    entry = {
        "id": now.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:4],
        "time": now.isoformat(timespec="seconds"),
        "agent": agent,
        "kind": kind,
        "kind_label": KIND_LABELS[kind],
        "action": action,
        "files": _norm_files(files),
        "note": note,
        "void": False,
        "void_reason": "",
    }
    with _lock:
        store = _read()
        store.setdefault("checkins", []).append(entry)
        _write(store)
        payload = _payload(store)
    payload["entry"] = entry
    return payload


def void_entry(entry_id: str, reason: str = "") -> dict:
    """把一条记录标记作废（原文保留，供后来者查看历史）。"""
    entry_id = str(entry_id or "").strip()
    if not entry_id:
        return {"ok": False, "error": "缺少记录 ID"}
    reason = str(reason or "").strip()[:200]
    with _lock:
        store = _read()
        target = next((c for c in store.get("checkins") or [] if c.get("id") == entry_id), None)
        if target is None:
            return {"ok": False, "error": "找不到这条打卡记录"}
        if target.get("void"):
            return {"ok": False, "error": "这条记录已经作废过了"}
        target["void"] = True
        target["void_reason"] = reason or "未填写原因"
        _write(store)
        return _payload(store)
