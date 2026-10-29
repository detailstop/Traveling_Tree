"""
文件预览与说明卡片（项目优化与当前综述）。

职责：
  - 运行期递归扫描工作区，生成文件树；排除 .git / __pycache__ / 缓存 / 临时 / 备份等生成物。
  - 识别 .db/.sqlite 等数据库文件并高亮。
  - 文件说明元数据 file_notes 与数据库结构化规则 db_rules 的读写（SQL 在 core/repository.py）。
  - 用背景库节点 extensions/summary 生成初始建议；人工保存覆盖建议。

不写源码文件；不把扫描结果硬编码。
"""

from __future__ import annotations

import fnmatch
import os
from datetime import datetime
from pathlib import Path

import config
from plugins.bg_library import repo

# 集中排除规则：只排除生成物/缓存/临时/备份，源码与用户数据仍可见。
EXCLUDE_DIR_NAMES = {
    ".git", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache",
    ".venv", "venv", "env", "node_modules", "webchat_profile", "归档",
}
EXCLUDE_REL_DIRS = {
    "data/backup", "data/bg_import", "data/fund_cache", "data/voice_cache",
}
EXCLUDE_FILE_GLOBS = (
    "*.pyc", "*.pyo", "*.log", "*.tmp", "*.bak", "*~", ".DS_Store",
    "*_cache.json", "*_history.json", "webchat_sessions.json", "ai_keys.json",
    "rt_fin.json",
)
DB_SUFFIXES = {".db", ".sqlite", ".sqlite3", ".db3"}
MAX_FILES = 8000
MAX_DEPTH = 14


def _base() -> Path:
    return Path(config.BASE_DIR).resolve()


def _rel(abs_path: Path) -> str:
    return abs_path.relative_to(_base()).as_posix()


def _safe_rel(rel: str, must_exist: bool = True) -> str:
    rel = str(rel or "").replace("\\", "/").strip()
    while rel.startswith("./"):
        rel = rel[2:]
    if not rel or rel in (".", "..") or rel.startswith("../") or "/../" in rel or rel.startswith("/"):
        raise ValueError("路径为空或越出工作区")
    p = (_base() / rel).resolve()
    base = _base()
    if p != base and base not in p.parents:
        raise ValueError("路径越出工作区")
    if must_exist and not p.exists():
        raise ValueError("文件不存在：" + rel)
    return p.relative_to(base).as_posix()


def _is_db(name: str) -> bool:
    return Path(name).suffix.lower() in DB_SUFFIXES


def _excluded_dir(rel: str, name: str) -> bool:
    if name in EXCLUDE_DIR_NAMES:
        return True
    return any(rel == d or rel.startswith(d + "/") for d in EXCLUDE_REL_DIRS)


def _excluded_file(name: str) -> bool:
    low = name.lower()
    return any(fnmatch.fnmatch(low, pat.lower()) for pat in EXCLUDE_FILE_GLOBS)


def _scan_dir(abs_dir: Path, rel_dir: str, depth: int, counter: list) -> list[dict]:
    out: list[dict] = []
    if depth > MAX_DEPTH or counter[0] >= MAX_FILES:
        return out
    try:
        entries = list(os.scandir(abs_dir))
    except OSError:
        return out
    entries.sort(key=lambda e: (not e.is_dir(follow_symlinks=False), e.name.lower()))
    for entry in entries:
        if counter[0] >= MAX_FILES:
            break
        if entry.is_symlink():
            continue
        rel = f"{rel_dir}/{entry.name}" if rel_dir else entry.name
        if entry.is_dir(follow_symlinks=False):
            if _excluded_dir(rel, entry.name):
                continue
            children = _scan_dir(Path(entry.path), rel, depth + 1, counter)
            counter[1] += 1
            out.append({"name": entry.name, "path": rel, "type": "dir", "children": children})
        else:
            if _excluded_file(entry.name):
                continue
            try:
                size = entry.stat(follow_symlinks=False).st_size
            except OSError:
                size = 0
            counter[0] += 1
            out.append({
                "name": entry.name,
                "path": rel,
                "type": "file",
                "size": size,
                "is_db": _is_db(entry.name),
                "ext": Path(entry.name).suffix.lower(),
            })
    return out


def scan_tree() -> dict:
    counter = [0, 0]  # files, dirs
    children = _scan_dir(_base(), "", 0, counter)
    truncated = counter[0] >= MAX_FILES
    return {
        "root": {"name": _base().name, "path": "", "type": "dir", "children": children},
        "counts": {"files": counter[0], "dirs": counter[1], "truncated": truncated, "max_files": MAX_FILES},
        "scanned_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "exclusions": {
            "dir_names": sorted(EXCLUDE_DIR_NAMES),
            "relative_dirs": sorted(EXCLUDE_REL_DIRS),
            "file_globs": list(EXCLUDE_FILE_GLOBS),
            "db_suffixes": sorted(DB_SUFFIXES),
        },
    }


def _flatten_files(nodes: list[dict]) -> list[dict]:
    out = []
    for n in nodes:
        if n.get("type") == "file":
            out.append(n)
        else:
            out.extend(_flatten_files(n.get("children") or []))
    return out


def _node_text(node: dict) -> str:
    vals: list[str] = [str(node.get("path") or ""), str(node.get("name") or ""),
                       str(node.get("summary") or "")]
    for key in ("extensions", "ui_rules", "data_requirements", "known_issues"):
        v = node.get(key)
        if isinstance(v, dict):
            vals.extend(str(x) for x in v.values() if isinstance(x, (str, int, float)))
        elif isinstance(v, list):
            vals.extend(str(x) for x in v)
        elif v:
            vals.append(str(v))
    text = " ".join(vals).replace("\\", "/")
    return text.replace(str(_base()).replace("\\", "/"), "").lower()


def _suggestions(files: list[dict], notes: dict) -> dict[str, dict]:
    try:
        from plugins.bg_library import bg_library
        nodes = bg_library.tree().get("nodes") or []
    except Exception:
        nodes = []
    texts = [(n, _node_text(n)) for n in nodes]
    db_node = next((n for n in nodes if "数据模型" in str(n.get("name") or "")), None)
    out: dict[str, dict] = {}
    for f in files:
        rel = str(f.get("path") or "")
        if not rel or rel in notes:
            continue
        low = rel.lower()
        base_name = Path(rel).name.lower()
        best = None
        best_score = 0
        for node, text in texts:
            if not text:
                continue
            score = 0
            if low in text:
                score = 100
            elif len(base_name) >= 5 and base_name in text:
                score = 30
            if score > best_score:
                best, best_score = node, score
        if f.get("is_db") and db_node:
            best, best_score = db_node, 10
        if not best:
            continue
        rules = best.get("ui_rules") or []
        out[rel] = {
            "path": rel,
            "feature": str(best.get("path") or best.get("name") or ""),
            "details": str(best.get("summary") or "")[:800],
            "rules": "；".join(str(x) for x in rules[:2])[:800],
            "source": "suggested",
        }
    return out


def state() -> dict:
    tree = scan_tree()
    files = _flatten_files(tree["root"]["children"])
    notes = repo.list_file_notes()
    rules = repo.list_db_rules()
    return {
        "ok": True,
        "tree": tree["root"],
        "counts": tree["counts"],
        "scanned_at": tree["scanned_at"],
        "exclusions": tree["exclusions"],
        "notes": notes,
        "suggestions": _suggestions(files, notes),
        "rules": rules,
        "db_files": [f["path"] for f in files if f.get("is_db")],
    }


def _clean_text(value, limit: int = 4000) -> str:
    return str(value or "").strip()[:limit]


def save_note(data: dict) -> dict:
    rel = _safe_rel(data.get("path"), must_exist=True)
    if not (_base() / rel).is_file():
        raise ValueError("文件说明只能关联普通文件")
    note = repo.upsert_file_note(
        rel,
        feature=_clean_text(data.get("feature"), 500),
        details=_clean_text(data.get("details"), 4000),
        rules=_clean_text(data.get("rules"), 4000),
        source="manual",
    )
    return {"ok": True, "note": note}


def save_rule(data: dict) -> dict:
    db_path = _safe_rel(data.get("db_path"), must_exist=True)
    if not _is_db(Path(db_path).name):
        raise ValueError("规则必须关联 .db/.sqlite 等数据库文件")
    table = _clean_text(data.get("table_name"), 200)
    if not table:
        raise ValueError("表名不能为空")
    rule = repo.upsert_db_rule({
        "id": data.get("id"),
        "db_path": db_path,
        "table_name": table,
        "key_fields": _clean_text(data.get("key_fields")),
        "writers": _clean_text(data.get("writers")),
        "readers": _clean_text(data.get("readers")),
        "migration_rule": _clean_text(data.get("migration_rule")),
        "version": _clean_text(data.get("version"), 200),
    })
    return {"ok": True, "rule": rule}


def delete_rule(data: dict) -> dict:
    try:
        rid = int(data.get("id"))
    except (TypeError, ValueError):
        raise ValueError("规则 id 无效")
    return {"ok": True, "deleted": repo.delete_db_rule(rid)}


def api(method: str, path: str, query: dict, data: dict):
    if method == "GET" and path == "/api/files/state":
        return state()
    if method == "GET" and path == "/api/files/notes":
        s = state()
        return {"ok": True, "notes": s["notes"], "suggestions": s["suggestions"]}
    if method == "GET" and path == "/api/files/rules":
        return {"ok": True, "rules": repo.list_db_rules()}
    if method == "POST" and path == "/api/files/note":
        return save_note(data)
    if method == "POST" and path == "/api/files/rule":
        return save_rule(data)
    if method == "POST" and path == "/api/files/rule/delete":
        return delete_rule(data)
    raise ValueError("未知文件预览接口：" + str(path))
