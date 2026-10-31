# -*- coding: utf-8 -*-
"""功能背景信息库（项目优化与当前综述）。

职责：
  - 树形节点存储（项目 / 模块 / 功能 / 流程 / 接口 / 其他）；
  - 全新导入（mode:new）、日常优化导入（mode:update，含 base / current / changed_paths）；
  - 勾选导出（mode:export，附带 referenced_nodes）；
  - 手动变更（字段级前后值 + 原因 + 手动变更记录）；
  - 历史归档（导入版本 + 手动变更，倒序、可清空）；
  - 入向关系由出向关系推导，不冗余存储。

约定：
  - 节点只存出向 relations，入向在读取时推导；
  - 系统不生成任何解释性文本（summary / change_log 全部来自导入或用户手写）；
  - 默认只作废（deprecated，可恢复）；仅作废节点在无在用子节点、无外部入向引用
    且填写原因的前提下允许物理删除；子节点全部作废时可连同整棵子树一次删除，
    删除前必须在 bg_versions 为每个被删节点留完整快照。
"""
from __future__ import annotations

import hashlib
import json
import re
import uuid
from datetime import datetime, timezone

from db.connection import get_conn

SCHEMA_VERSION = "1.0"
NODE_TYPES = ("project", "module", "feature", "flow", "interface", "other")
STATUSES = ("planned", "active", "deprecated", "broken", "unknown")
REL_TYPES = ("call", "data_input", "data_output")
CONFIDENCES = ("high", "medium", "low", "unknown")
LIST_FIELDS = ("workflows", "interfaces", "data_requirements", "ui_rules",
               "dependencies", "known_issues", "constraints", "next_steps", "tags")
EDITABLE_FIELDS = ("name", "status", "summary", "scope", "workflows", "interfaces",
                   "data_requirements", "ui_rules", "dependencies", "known_issues",
                   "constraints", "next_steps", "relations", "tags", "confidence",
                   "extensions")
READONLY_FIELDS = ("id", "parent_id", "path", "node_type", "change_log",
                   "updated_at", "version_tag", "source")


class DeleteBlocked(ValueError):
    """物理删除被业务校验拒绝；extra 会随错误响应一并返回，便于前端展示明细。"""

    def __init__(self, message: str, *, reason_code: str = "blocked",
                 references: list[dict] | None = None,
                 children: list[dict] | None = None,
                 ignored_references: list[dict] | None = None,
                 outgoing: list[dict] | None = None,
                 ignored_outgoing: list[dict] | None = None):
        super().__init__(message)
        self.extra = {"reason_code": reason_code}
        if references is not None:
            self.extra["references"] = references
        if children is not None:
            self.extra["children"] = children
        if ignored_references is not None:
            self.extra["ignored_references"] = ignored_references
        if outgoing is not None:
            self.extra["outgoing"] = outgoing
        if ignored_outgoing is not None:
            self.extra["ignored_outgoing"] = ignored_outgoing



def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _json(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _decode(value, fallback):
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return fallback


def _conn():
    return get_conn()


# ------------------------------------------------------------
# 节点读写
# ------------------------------------------------------------

def _defaults() -> dict:
    return {
        "scope": {"included": [], "excluded": []},
        "workflows": [], "interfaces": [], "data_requirements": [],
        "ui_rules": [], "dependencies": [], "known_issues": [],
        "constraints": [], "next_steps": [], "relations": [], "tags": [],
        "confidence": "", "extensions": {}, "change_log": [],
    }


def _row_to_node(row) -> dict:
    payload = _decode(row["payload"], {})
    node = {
        "id": row["id"],
        "parent_id": row["parent_id"],
        "path": row["path"],
        "node_type": row["node_type"],
        "name": row["name"],
        "status": row["status"],
        "summary": row["summary"],
        "version_tag": row["version_tag"],
        "source": row["source"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }
    node.update(_defaults())
    for key in list(_defaults().keys()):
        if key in payload:
            node[key] = payload[key]
    return node


def _all_nodes() -> list[dict]:
    rows = _conn().execute("SELECT * FROM bg_nodes").fetchall()
    nodes = [_row_to_node(r) for r in rows]
    nodes.sort(key=lambda n: [int(p) if p.isdigit() else 0 for p in str(n["path"]).split(".")])
    return nodes


def _one_node(node_id: str) -> dict:
    row = _conn().execute("SELECT * FROM bg_nodes WHERE id=?", (node_id,)).fetchone()
    if not row:
        raise LookupError("节点不存在")
    return _row_to_node(row)


def _version_tag(node: dict) -> str:
    core = {k: node.get(k) for k in ("parent_id", "node_type", "name", "status", "summary",
                                     "scope", "relations", "confidence", "extensions",
                                     "change_log", *LIST_FIELDS)}
    return hashlib.sha1(_json(core).encode("utf-8")).hexdigest()[:12]


def _payload(node: dict) -> str:
    return _json({k: node.get(k, _defaults()[k]) for k in _defaults()})


def _insert(node: dict) -> None:
    conn = _conn()
    node["version_tag"] = _version_tag(node)
    conn.execute(
        "INSERT INTO bg_nodes(id,parent_id,path,node_type,name,status,summary,payload,"
        "version_tag,source,created_at,updated_at,raw_json,live_json) "
        "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (node["id"], node["parent_id"], node["path"], node["node_type"], node["name"],
         node["status"], node["summary"], _payload(node), node["version_tag"],
         node["source"], node["created_at"], node["updated_at"], _json(node), _json(node)))


def _update(node: dict, source: str = "import") -> None:
    conn = _conn()
    node["version_tag"] = _version_tag(node)
    node["updated_at"] = _now()
    node["source"] = source
    conn.execute(
        "UPDATE bg_nodes SET parent_id=?,path=?,node_type=?,name=?,status=?,summary=?,"
        "payload=?,version_tag=?,source=?,updated_at=?,live_json=? WHERE id=?",
        (node["parent_id"], node["path"], node["node_type"], node["name"], node["status"],
         node["summary"], _payload(node), node["version_tag"], node["source"],
         node["updated_at"], _json(node), node["id"]))


# ------------------------------------------------------------
# 校验
# ------------------------------------------------------------

def _str(value, field, errors, required=False, default=""):
    if value is None:
        if required:
            errors.append(f"{field} 必填")
            return default
        return default
    if not isinstance(value, str):
        errors.append(f"{field} 必须为字符串")
        return default
    if required and not value.strip():
        errors.append(f"{field} 不能为空")
    return value


def _str_list(value, field, errors, default=None):
    if value is None:
        return list(default or [])
    if not isinstance(value, list) or any(not isinstance(x, str) for x in value):
        errors.append(f"{field} 必须为字符串数组")
        return []
    return [x for x in value]


def _relations(value, errors):
    if value is None:
        return []
    if not isinstance(value, list):
        errors.append("relations 必须为数组")
        return []
    out = []
    for i, rel in enumerate(value, 1):
        if not isinstance(rel, dict):
            errors.append(f"relations 第 {i} 项必须为对象")
            continue
        target = rel.get("target_id")
        target = target.strip() if isinstance(target, str) else ""
        path = str(rel.get("target_path") or "").strip()
        # 新建档时目标往往还没有 id：允许 target_id 留空，只要 target_path 能定位即可，
        # 由 import_new 在入库前按 path 解析成真实 id。
        if not target and not path:
            errors.append(f"relations 第 {i} 项缺少 target_id")
            continue
        rtype = rel.get("relation_type")
        if rtype not in REL_TYPES:
            errors.append(f"relations 第 {i} 项 relation_type 非法")
            continue
        out.append({
            "target_id": target or path,   # 暂时用 path 占位，import_new 会换成真实 id
            "target_path": path,
            "relation_type": rtype,
            "note": str(rel.get("note") or ""),
        })
    return out


def _change_log(value, errors):
    if value is None:
        return []
    if not isinstance(value, list):
        errors.append("change_log 必须为数组")
        return []
    out = []
    for i, item in enumerate(value, 1):
        if not isinstance(item, dict):
            errors.append(f"change_log 第 {i} 项必须为对象")
            continue
        out.append({
            "at": str(item.get("at") or ""),
            "summary": str(item.get("summary") or ""),
            "agent": str(item.get("agent") or ""),
            "reason": str(item.get("reason") or ""),
            "related_paths": [str(x) for x in (item.get("related_paths") or [])
                              if isinstance(x, (str, int))],
        })
    return out


def _scope(value, errors):
    if value is None:
        return {"included": [], "excluded": []}
    if not isinstance(value, dict):
        errors.append("scope 必须为对象")
        return {"included": [], "excluded": []}
    inc = value.get("included", [])
    exc = value.get("excluded", [])
    for name, arr in (("scope.included", inc), ("scope.excluded", exc)):
        if not isinstance(arr, list) or any(not isinstance(x, str) for x in arr):
            errors.append(f"{name} 必须为字符串数组")
    return {"included": [x for x in inc if isinstance(x, str)] if isinstance(inc, list) else [],
            "excluded": [x for x in exc if isinstance(x, str)] if isinstance(exc, list) else []}


def _normalize(raw, index: int) -> tuple[dict | None, list[str]]:
    """把一条导入记录规范化为内部节点；返回 (node, errors)。id 可为空。"""
    if not isinstance(raw, dict):
        return None, [f"第 {index} 条不是 JSON 对象"]
    errors: list[str] = []
    node = _defaults()
    node["id"] = raw.get("id") if isinstance(raw.get("id"), str) and raw.get("id").strip() else None
    node["parent_id"] = raw.get("parent_id") if isinstance(raw.get("parent_id"), str) and raw.get("parent_id").strip() else None
    if raw.get("parent_id") not in (None, "") and node["parent_id"] is None:
        errors.append("parent_id 必须为字符串或空")
    node["node_type"] = raw.get("node_type")
    if node["node_type"] not in NODE_TYPES:
        errors.append("node_type 非法：" + str(raw.get("node_type")))
    node["name"] = _str(raw.get("name"), "name", errors, required=True)
    node["status"] = raw.get("status") if raw.get("status") is not None else "active"
    if node["status"] not in STATUSES:
        errors.append("status 非法：" + str(raw.get("status")))
    node["summary"] = _str(raw.get("summary"), "summary", errors)
    node["scope"] = _scope(raw.get("scope"), errors)
    for field in LIST_FIELDS:
        setattr_list = _str_list(raw.get(field), field, errors)
        node[field] = setattr_list
    node["relations"] = _relations(raw.get("relations"), errors)
    conf = raw.get("confidence")
    if conf is None or conf == "":
        node["confidence"] = ""
    elif isinstance(conf, str) and conf in CONFIDENCES:
        node["confidence"] = conf
    else:
        errors.append("confidence 非法：" + str(conf))
    ext = raw.get("extensions")
    if ext is not None and not isinstance(ext, dict):
        errors.append("extensions 必须为对象")
        ext = {}
    node["extensions"] = ext or {}
    node["change_log"] = _change_log(raw.get("change_log"), errors)
    node["version_tag"] = ""
    node["source"] = "import"
    node["created_at"] = _now()
    node["updated_at"] = node["created_at"]
    node["path"] = str(raw.get("path") or "")
    if errors:
        return None, [f"第 {index} 条：" + e for e in errors]
    return node, []


# ------------------------------------------------------------
# 树 / 导出辅助
# ------------------------------------------------------------

def _incoming(nodes: list[dict]) -> dict[str, list[dict]]:
    """根据所有出向关系推导入向关系。"""
    by_id = {n["id"]: n for n in nodes}
    out: dict[str, list[dict]] = {}
    for node in nodes:
        for rel in node.get("relations") or []:
            target = rel.get("target_id")
            entry = {
                "source_id": node["id"],
                "source_path": node["path"],
                "source_name": node["name"],
                "relation_type": rel.get("relation_type"),
                "target_path": rel.get("target_path") or "",
                "note": rel.get("note") or "",
            }
            out.setdefault(target, []).append(entry)
    for target, items in out.items():
        items.sort(key=lambda x: (x["source_path"], x["relation_type"]))
    return out


def _minimal(node: dict) -> dict:
    return {"id": node["id"], "path": node["path"], "name": node["name"],
            "node_type": node["node_type"], "status": node["status"],
            "summary": node["summary"]}


def _root_of(node: dict, by_id: dict) -> dict | None:
    cur = node
    seen = set()
    while cur and cur.get("parent_id"):
        if cur["parent_id"] in seen:
            break
        seen.add(cur["parent_id"])
        cur = by_id.get(cur["parent_id"])
    return cur


def _next_paths(nodes: list[dict], parent_id: str | None) -> list[str]:
    """为一组同级新节点生成后续 path 序号。"""
    siblings = [n for n in nodes if n["parent_id"] == parent_id]
    used = set()
    for n in siblings:
        tail = str(n["path"]).split(".")[-1]
        if tail.isdigit():
            used.add(int(tail))
    prefix = ""
    if parent_id:
        parent = next((n for n in nodes if n["id"] == parent_id), None)
        prefix = str(parent["path"]) if parent else ""
    seq = max(used) if used else 0
    out = []
    for _ in siblings:
        seq += 1
        out.append(f"{prefix}.{seq}" if prefix else str(seq))
    return out


# ------------------------------------------------------------
# 全新导入
# ------------------------------------------------------------

PLACEHOLDER_SUMMARY = "占位节点：导入时未提供父节点，待补充内容（可通过后续导入或手动变更完善）。"


def _placeholder_node(path: str, node_id: str, parent_id: str | None) -> dict:
    name = path.split("/")[-1] if path else "未命名占位"
    now = _now()
    return {
        "id": node_id, "parent_id": parent_id, "path": path,
        "node_type": "other", "name": name, "status": "unknown",
        "summary": PLACEHOLDER_SUMMARY,
        "scope": {"included": [], "excluded": []},
        "workflows": [], "interfaces": [], "data_requirements": [], "ui_rules": [],
        "dependencies": [], "known_issues": [], "constraints": [], "next_steps": [],
        "relations": [], "tags": ["占位"], "confidence": "unknown",
        "extensions": {"placeholder": True},
        "change_log": [{
            "at": now,
            "summary": f"导入时自动生成占位节点：父节点「{path}」未随包提供，待补充。",
            "agent": "系统", "reason": "parent_id 无法解析", "related_paths": [path],
        }],
        "version_tag": "", "source": "import", "created_at": now, "updated_at": now,
    }


def _prepare_new_nodes(nodes: list[dict]) -> tuple[list[dict], list[dict], list[str]]:
    """补 id、解析 parent_id；父节点缺失时自动生成占位节点（可后续补充）。

    返回 (全部节点, 新建占位, 错误)。parent_id 支持三种写法：
    节点 id、节点 path（如 A/B）、以及不透明引用（生成同名根占位）。
    """
    errors: list[str] = []
    for node in nodes:
        node["id"] = node["id"] or str(uuid.uuid4())
    by_id: dict[str, dict] = {n["id"]: n for n in nodes}
    by_path: dict[str, dict] = {}
    for node in nodes:
        path = str(node.get("path") or "").strip()
        if not path:
            continue
        if path in by_path:
            errors.append(f"节点 path 重复：{path}")
            continue
        node["path"] = path
        by_path[path] = node
    if errors:
        return nodes, [], errors

    placeholders: list[dict] = []

    def ensure(path: str, depth: int = 0) -> dict | None:
        if not path or path in by_path:
            return by_path.get(path)
        if depth > 8:
            return None
        parent_path = path.rsplit("/", 1)[0] if "/" in path else ""
        parent = ensure(parent_path, depth + 1) if parent_path else None
        node = _placeholder_node(path, str(uuid.uuid4()), parent["id"] if parent else None)
        by_path[path] = node
        by_id[node["id"]] = node
        placeholders.append(node)
        return node

    for node in nodes:
        pid = node.get("parent_id")
        if not pid:
            node["parent_id"] = None
            continue
        if pid in by_id:
            continue
        if pid in by_path:
            node["parent_id"] = by_path[pid]["id"]
            continue
        if "/" in str(pid):
            parent = ensure(str(pid))
            if parent is None:
                errors.append(f"节点「{node['name']}」的 parent_id 无法解析：{pid}")
            else:
                node["parent_id"] = parent["id"]
            continue
        # 不透明引用（像 id 但不在包内）：生成同名根占位，便于后续补充
        ref = str(pid)
        path = ref if ref not in by_path else f"{ref}（占位）"
        holder = _placeholder_node(path, str(uuid.uuid4()), None)
        holder["name"] = ref
        by_path[path] = holder
        by_id[holder["id"]] = holder
        placeholders.append(holder)
        node["parent_id"] = holder["id"]

    if errors:
        return nodes, placeholders, errors
    return nodes + placeholders, placeholders, []


def import_new(package: dict) -> dict:
    nodes_raw = package.get("nodes")
    if not isinstance(nodes_raw, list) or not nodes_raw:
        return {"valid": False, "error": "nodes 必须为非空数组"}
    errors: list[str] = []
    nodes: list[dict] = []
    for i, raw in enumerate(nodes_raw, 1):
        node, errs = _normalize(raw, i)
        errors.extend(errs)
        if node:
            nodes.append(node)
    if errors:
        return {"valid": False, "error": "存在非法节点，整包未导入", "errors": errors}

    provided_ids = [n["id"] for n in nodes if n["id"]]
    dup = {x for x in provided_ids if provided_ids.count(x) > 1}
    if dup:
        return {"valid": False, "error": "节点 id 重复：" + "、".join(sorted(dup))}

    nodes, placeholders, errors = _prepare_new_nodes(nodes)
    if errors:
        return {"valid": False, "error": "parent_id 解析失败", "errors": errors}

    # 成环检测
    by_id = {n["id"]: n for n in nodes}
    for node in nodes:
        seen = set()
        cur = node
        while cur and cur["parent_id"]:
            if cur["id"] in seen:
                return {"valid": False, "error": f"节点存在循环引用：{node['id']}"}
            seen.add(cur["id"])
            cur = by_id.get(cur["parent_id"])

    children: dict[str | None, list[dict]] = {}
    for node in nodes:
        children.setdefault(node["parent_id"], []).append(node)

    used_paths: dict[str, str] = {}

    def assign(parent_id, parent_path):
        for idx, child in enumerate(children.get(parent_id, []), 1):
            given = str(child.get("path") or "").strip()
            sep = "/" if "/" in parent_path else "."
            path = given if given else (f"{parent_path}{sep}{idx}" if parent_path else str(idx))
            if path in used_paths:
                raise ValueError("节点 path 重复：" + path)
            used_paths[path] = child["id"]
            child["path"] = path
            assign(child["id"], path)

    try:
        assign(None, "")
    except ValueError as exc:
        return {"valid": False, "error": str(exc)}

    # 关系目标允许留空 target_id，或用 path 暂代 id；入库前统一解析成真实 id
    path_map = {n["path"]: n["id"] for n in nodes}
    id_set = {n["id"] for n in nodes}
    for node in nodes:
        for rel in node.get("relations") or []:
            target = str(rel.get("target_id") or "").strip()
            if target and target in id_set:
                continue
            path = str(rel.get("target_path") or "").strip()
            resolved = path_map.get(target) or path_map.get(path)
            if resolved:
                rel["target_id"] = resolved
            elif not target:
                # 包外目标：先把 path 当地址留着，导出时按悬空引用处理
                rel["target_id"] = path

    conn = _conn()
    now = _now()
    conn.execute("BEGIN IMMEDIATE")
    try:
        for node in nodes:
            node["created_at"] = node["updated_at"] = now
            _insert(node)
        _record_version(conn, kind="import", mode="new", node_id=None,
                        summary=f"全新导入 {len(nodes)} 个节点（自动占位 {len(placeholders)} 个）",
                        data={"nodes": len(nodes), "placeholders": len(placeholders),
                              "package_schema": package.get("schema_version", "")})
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {"valid": True, "imported": len(nodes), "placeholders": len(placeholders), "mode": "new"}


# ------------------------------------------------------------
# 日常优化：预览 / 提交
# ------------------------------------------------------------

def _package_scope(package: dict, key: str) -> str:
    part = package.get(key) or {}
    scope = part.get("scope") if isinstance(part, dict) else None
    return scope if scope in ("full", "subtree") else "subtree"


def _changed_ids(package: dict, local: dict[str, dict]) -> set[str]:
    ids: set[str] = set()
    for item in package.get("changed_paths") or []:
        if not isinstance(item, dict):
            continue
        if isinstance(item.get("id"), str) and item["id"]:
            ids.add(item["id"])
        elif isinstance(item.get("path"), str) and item["path"]:
            for node in local.values():
                if node["path"] == item["path"]:
                    ids.add(node["id"])
                    break
    return ids


def _ancestors(node_id: str, local: dict[str, dict], extra: dict[str, dict]) -> set[str]:
    out = set()
    cur = local.get(node_id) or extra.get(node_id)
    seen = set()
    while cur and cur.get("parent_id"):
        pid = cur["parent_id"]
        if pid in seen:
            break
        seen.add(pid)
        out.add(pid)
        cur = local.get(pid) or extra.get(pid)
    return out


def plan_update(package: dict) -> dict:
    local_list = _all_nodes()
    local = {n["id"]: n for n in local_list}
    base = package.get("base") or {}
    part_current = package.get("current") or {}
    base_nodes = base.get("nodes") if isinstance(base, dict) else None
    current_nodes = part_current.get("nodes") if isinstance(part_current, dict) else None
    if not isinstance(base_nodes, list) or not isinstance(current_nodes, list):
        return {"valid": False, "error": "base.nodes 与 current.nodes 必须为数组"}
    scope = _package_scope(package, "current")
    base_scope = _package_scope(package, "base")
    errors: list[str] = []
    base_by_id: dict[str, dict] = {}
    for i, raw in enumerate(base_nodes, 1):
        if not isinstance(raw, dict) or not isinstance(raw.get("id"), str) or not raw["id"]:
            errors.append(f"base 第 {i} 条缺少 id")
        else:
            base_by_id[raw["id"]] = raw
    if errors:
        return {"valid": False, "error": "base 数据非法", "errors": errors}

    normalized: list[tuple[int, dict, dict]] = []
    for i, raw in enumerate(current_nodes):
        if not isinstance(raw, dict):
            errors.append(f"current 第 {i + 1} 条不是 JSON 对象")
            continue
        patched = dict(raw)
        nid = raw.get("id") if isinstance(raw.get("id"), str) else None
        if nid and nid in local:
            patched.setdefault("node_type", local[nid]["node_type"])
            patched.setdefault("name", local[nid]["name"])
        node, errs = _normalize(patched, i + 1)
        errors.extend(errs)
        if node:
            node["path"] = str(raw.get("path") or "")
            normalized.append((i, patched, node))
    if errors:
        return {"valid": False, "error": "current 数据非法", "errors": errors}

    provided = [node["id"] for _, _, node in normalized if node["id"]]
    dup = {x for x in provided if provided.count(x) > 1}
    if dup:
        return {"valid": False, "error": "current 内 id 重复，整包非法：" + "、".join(sorted(dup))}

    changed = _changed_ids(package, local)
    extra = {node["id"]: node for _, _, node in normalized if node["id"]}
    allowed = set(changed)
    for cid in list(changed):
        allowed |= _ancestors(cid, local, extra)
    for nid in list(allowed):
        allowed |= _ancestors(nid, local, extra)

    items: list[dict] = []
    counts = {"new": 0, "update": 0, "conflict": 0, "deprecate": 0,
              "outOfScope": 0, "illegal": 0}
    current_ids = {node["id"] for _, _, node in normalized if node["id"]}

    for idx, raw, node in normalized:
        nid = node["id"]
        name = node["name"]
        item = {"index": idx, "path": node["path"], "name": name, "id": nid}
        if not nid:
            counts["new"] += 1
            items.append({"key": f"new:{idx}", "kind": "new", **item})
            continue
        local_node = local.get(nid)
        base_node = base_by_id.get(nid)
        if scope == "subtree" and allowed and nid not in allowed:
            counts["outOfScope"] += 1
            items.append({"key": f"outscope:{nid}", "kind": "out_of_scope", **item,
                          "reason": "subtree 模式下不在 changed_paths 及其祖先链内"})
            continue
        if base_node is None:
            counts["conflict"] += 1
            items.append({"key": f"conflict:{nid}", "kind": "conflict", **item,
                          "reason": "current 出现 base 中不存在的节点（本地已存在同 id）"})
            continue
        if local_node is None:
            counts["conflict"] += 1
            items.append({"key": f"conflict:{nid}", "kind": "conflict", **item,
                          "reason": "本地不存在该 id 的节点"})
            continue
        if local_node["path"] != (base_node.get("path") or local_node["path"]):
            counts["conflict"] += 1
            items.append({"key": f"conflict:{nid}", "kind": "conflict", **item,
                          "path": local_node["path"],
                          "reason": f"同 id 但 path 不一致（base {base_node.get('path')} / 本地 {local_node['path']}）"})
            continue
        if base_node.get("version_tag") and local_node["version_tag"] != base_node.get("version_tag"):
            counts["conflict"] += 1
            items.append({"key": f"conflict:{nid}", "kind": "conflict", **item,
                          "path": local_node["path"],
                          "reason": "base 的 version_tag 与本地不一致（本地已被修改）"})
            continue
        if node["node_type"] != local_node["node_type"]:
            counts["conflict"] += 1
            items.append({"key": f"conflict:{nid}", "kind": "conflict", **item,
                          "path": local_node["path"],
                          "reason": f"日常优化不得修改 node_type（{local_node['node_type']} → {node['node_type']}）"})
            continue
        counts["update"] += 1
        items.append({"key": f"update:{nid}", "kind": "update", **item,
                      "path": local_node["path"]})

    if scope == "full":
        for nid, base_node in base_by_id.items():
            if nid in current_ids:
                continue
            local_node = local.get(nid)
            if not local_node or local_node["status"] == "deprecated":
                continue
            counts["deprecate"] += 1
            items.append({"key": f"deprecate:{nid}", "kind": "deprecate", "id": nid,
                          "path": local_node["path"], "name": local_node["name"],
                          "reason": "full 范围下 base 有、current 无，确认后标记作废"})

    return {"valid": True, "preview": {
        "mode": "update", "scope": scope, "base_scope": base_scope,
        "schema_warning": str(package.get("schema_version") or "") != SCHEMA_VERSION,
        "counts": counts, "items": items, "changed_ids": sorted(changed)}}


def commit_update(package: dict, decisions: dict | None = None) -> dict:
    decisions = decisions or {}
    plan = plan_update(package)
    if not plan.get("valid"):
        raise ValueError(plan.get("error") or "预览校验失败")
    preview = plan["preview"]
    current_nodes = (package.get("current") or {}).get("nodes") or []
    local_list = _all_nodes()
    local = {n["id"]: n for n in local_list}
    applied = {"added": 0, "updated": 0, "deprecated": 0, "skipped": 0, "forced": 0}
    pending_new: list[dict] = []
    conn = _conn()
    conn.execute("BEGIN IMMEDIATE")
    try:
        for item in preview["items"]:
            idx = item.get("index")
            raw = current_nodes[idx] if isinstance(idx, int) and 0 <= idx < len(current_nodes) else None
            kind = item["kind"]
            if kind == "update" and raw is not None:
                _update(_merge_update(local[raw["id"]], raw), "import")
                applied["updated"] += 1
            elif kind == "conflict":
                force = str(decisions.get(item["key"], "skip")) == "force"
                if force and raw is not None and raw.get("id") in local:
                    _update(_merge_update(local[raw["id"]], raw, force=True), "import")
                    applied["updated"] += 1
                    applied["forced"] += 1
                else:
                    applied["skipped"] += 1
            elif kind == "deprecate":
                if str(decisions.get(item["key"], "skip")) == "confirm":
                    node = dict(local[item["id"]])
                    node["status"] = "deprecated"
                    node["change_log"] = list(node.get("change_log") or [])
                    _update(node, "import")
                    applied["deprecated"] += 1
                else:
                    applied["skipped"] += 1
            elif kind in ("new", "out_of_scope"):
                accept = kind == "new" or str(decisions.get(item["key"], "skip")) == "accept"
                if accept and raw is not None:
                    rid = raw.get("id")
                    if isinstance(rid, str) and rid in local:
                        _update(_merge_update(local[rid], raw), "import")
                        applied["updated"] += 1
                    else:
                        pending_new.append(raw)
                else:
                    applied["skipped"] += 1

        queue = list(pending_new)
        guard = 0
        while queue and guard < 200:
            guard += 1
            progressed = False
            for raw in list(queue):
                pid = raw.get("parent_id") if isinstance(raw.get("parent_id"), str) else None
                if pid and pid not in local:
                    continue
                node, errs = _normalize(raw, 1)
                if not node:
                    raise ValueError("新增节点非法：" + "；".join(errs))
                node["id"] = node["id"] or str(uuid.uuid4())
                node["parent_id"] = pid
                # update 包里的新增节点允许带完整 path；只有缺失/不匹配/重复时才自动编号，
                # 避免把「旅行之木/像素画与插件绘制」写成「旅行之木.22」。
                parent_path = next((n["path"] for n in local_list if n["id"] == pid), "") if pid else ""
                given_path = str(raw.get("path") or "").strip()
                path_ok = bool(given_path) and (
                    not parent_path or given_path.startswith(parent_path.rstrip("/") + "/"))
                if path_ok and not any(n["path"] == given_path for n in local_list):
                    node["path"] = given_path
                else:
                    node["path"] = _child_path(local_list, pid)
                node["created_at"] = node["updated_at"] = _now()
                _insert(node)
                local[node["id"]] = node
                local_list.append(node)
                queue.remove(raw)
                applied["added"] += 1
                progressed = True
            if not progressed:
                raise ValueError("新增节点的 parent_id 无法解析")

        _record_version(conn, kind="import", mode="update", node_id=None,
                        summary=f"日常优化导入：新增 {applied['added']} / 更新 {applied['updated']} / 作废 {applied['deprecated']}",
                        data={"base": (package.get("base") or {}).get("nodes") or [],
                              "changed_paths": package.get("changed_paths") or [],
                              "decisions": decisions, "applied": applied})
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {"valid": True, "applied": applied}


def _child_path(nodes: list[dict], parent_id: str | None) -> str:
    prefix = ""
    if parent_id:
        parent = next((n for n in nodes if n["id"] == parent_id), None)
        if not parent:
            raise ValueError("父节点不存在：" + str(parent_id))
        prefix = parent["path"]
    used = []
    for n in nodes:
        if n["parent_id"] != parent_id:
            continue
        tail = str(n["path"]).split(".")[-1]
        if tail.isdigit():
            used.append(int(tail))
    seq = (max(used) if used else 0) + 1
    sep = "/" if "/" in prefix else "."
    return f"{prefix}{sep}{seq}" if prefix else str(seq)


def validate_update_for_cli(package: dict) -> dict:
    """CLI 导入前的强校验（页面预览/提交接口不调用本函数）。

    校验内容：
      1. base 每个节点都能在系统当前快照中找到，且 id / path / node_type /
         version_tag 完全一致；
      2. changed_paths 每项同时给出 id 与 path，且能在系统中定位；
      3. base 覆盖 changed_paths 及其全部祖先（base 范围最小化）；
      4. current 覆盖同一条链（祖先的 change_log 才能被同步追加）；
      5. preview 不存在冲突、范围外节点或待确认作废项。

    任一项不满足即抛 ValueError（按行聚合，便于直接打印），整包不导入。
    """
    if not isinstance(package, dict):
        raise ValueError("包内容必须是 JSON 对象")
    if package.get("mode") != "update":
        raise ValueError('CLI 导入只接受 mode:"update" 的包（new 模式请使用页面导入）')

    base = package.get("base")
    current = package.get("current")
    changed_paths = package.get("changed_paths")
    if not isinstance(base, dict) or not isinstance(base.get("nodes"), list) or not base["nodes"]:
        raise ValueError("base.nodes 必须为非空数组")
    if not isinstance(current, dict) or not isinstance(current.get("nodes"), list) or not current["nodes"]:
        raise ValueError("current.nodes 必须为非空数组")
    if not isinstance(changed_paths, list) or not changed_paths:
        raise ValueError("changed_paths 必须为非空数组")

    errors: list[str] = []
    nodes = _all_nodes()
    by_id = {n["id"]: n for n in nodes}
    by_path = {n["path"]: n for n in nodes}

    # 1. base 与本地当前快照逐项比对
    base_by_id: dict[str, dict] = {}
    for i, raw in enumerate(base["nodes"], 1):
        if not isinstance(raw, dict) or not isinstance(raw.get("id"), str) or not raw["id"]:
            errors.append(f"base 第 {i} 条缺少 id")
            continue
        nid = raw["id"]
        if nid in base_by_id:
            errors.append(f"base 内 id 重复：{nid}")
            continue
        base_by_id[nid] = raw
        local = by_id.get(nid)
        label = str(raw.get("path") or nid)
        if local is None:
            errors.append(f"base 节点在系统中不存在：{label}（{nid}）")
            continue
        if raw.get("path") != local["path"]:
            errors.append(f"base 节点 path 与系统不一致：{label}（{nid}；系统 {local['path']}）")
        if raw.get("node_type") != local["node_type"]:
            errors.append(f"base 节点 node_type 与系统不一致：{label}（{nid}；"
                          f"base {raw.get('node_type')} / 系统 {local['node_type']}）")
        if not raw.get("version_tag"):
            errors.append(f"base 节点缺少 version_tag：{label}（{nid}）")
        elif raw["version_tag"] != local["version_tag"]:
            errors.append(f"base 已过期：{label}（{nid}）的 version_tag 与系统当前不一致，请重新导出 base")

    # 2. changed_paths 定位（id 优先，path 二次校验）
    changed_ids: list[str] = []
    for i, item in enumerate(changed_paths, 1):
        if not isinstance(item, dict):
            errors.append(f"changed_paths 第 {i} 项必须为对象")
            continue
        nid = item.get("id") if isinstance(item.get("id"), str) else ""
        path = item.get("path") if isinstance(item.get("path"), str) else ""
        nid = nid.strip()
        path = path.strip()
        if not nid:
            errors.append(f"changed_paths 第 {i} 项缺少 id")
        if not path:
            errors.append(f"changed_paths 第 {i} 项缺少 path")
        if not nid and not path:
            continue
        local = by_id.get(nid) if nid else None
        if nid and local is None:
            errors.append(f"changed_paths 第 {i} 项 id 在系统中不存在：{nid}")
            continue
        if local is None and path:
            local = by_path.get(path)
        if local is None:
            errors.append(f"changed_paths 第 {i} 项 path 在系统中不存在：{path}")
            continue
        if path and local["path"] != path:
            errors.append(f"changed_paths 第 {i} 项 id 与 path 不匹配："
                          f"{nid or '（无 id）'} / {path}（系统 path {local['path']}）")
            continue
        if local["id"] not in changed_ids:
            changed_ids.append(local["id"])

    # 3. changed_paths 全链（自身 + 全部祖先）
    required_ids: list[str] = []
    for nid in changed_ids:
        chain: list[str] = []
        seen: set[str] = set()
        cur = by_id[nid]
        while cur and cur.get("parent_id"):
            pid = cur["parent_id"]
            if pid in seen:
                break
            seen.add(pid)
            chain.append(pid)
            cur = by_id.get(pid)
        for item in list(reversed(chain)) + [nid]:
            if item not in required_ids:
                required_ids.append(item)

    missing_base = [x for x in required_ids if x not in base_by_id]
    if missing_base:
        errors.append("base 未覆盖 changed_paths 全链（含祖先），缺失：" + "、".join(
            f"{by_id[x]['path']}（{x}）" if x in by_id else x for x in missing_base))

    current_by_id: dict[str, dict] = {}
    for i, raw in enumerate(current["nodes"], 1):
        if not isinstance(raw, dict) or not isinstance(raw.get("id"), str) or not raw["id"]:
            continue
        current_by_id.setdefault(raw["id"], raw)
    missing_current = [x for x in required_ids if x not in current_by_id]
    if missing_current:
        errors.append("current 未覆盖 changed_paths 全链（含祖先），缺失：" + "、".join(
            f"{by_id[x]['path']}（{x}）" if x in by_id else x for x in missing_current))

    # 4. 复用页面预览逻辑，拒绝冲突 / 范围外 / 待确认作废
    if not errors:
        plan = plan_update(package)
        if not plan.get("valid"):
            errors.append(str(plan.get("error") or "预览校验失败"))
            errors.extend(str(x) for x in (plan.get("errors") or []))
        else:
            preview = plan["preview"]
            for item in preview.get("items") or []:
                kind = item.get("kind")
                where = item.get("path") or item.get("name") or item.get("id") or ""
                if kind == "conflict":
                    errors.append(f"冲突：{where} — {item.get('reason') or 'base 与系统不一致'}")
                elif kind == "out_of_scope":
                    errors.append(f"范围外节点：{where} — subtree 包只允许 changed_paths 及其祖先链")
                elif kind == "deprecate":
                    errors.append(f"待确认作废：{where} — CLI 不提供作废确认，请改用页面导入")

    if errors:
        raise ValueError("\n".join(errors))
    return {"changed_ids": changed_ids, "required_ids": required_ids}


def import_update_for_cli(package: dict) -> dict:
    """CLI 导入 update 包：先做强校验，再复用现有 preview + commit 服务层。"""
    validate_update_for_cli(package)
    result = commit_update(package, {})
    return result


def _merge_update(local_node: dict, raw: dict, force: bool = False) -> dict:
    patched = dict(raw)
    if not patched.get("node_type"):
        patched["node_type"] = local_node["node_type"]
    if not patched.get("name"):
        patched["name"] = local_node["name"]
    node, errs = _normalize(patched, 1)
    if not node:
        raise ValueError("current 节点非法：" + "；".join(errs))
    merged = dict(local_node)
    for field in ("name", "status", "summary", "scope", "relations", "confidence",
                  "extensions", *LIST_FIELDS):
        if field in raw:
            merged[field] = node[field]
    local_log = list(local_node.get("change_log") or [])
    seen = {(x.get("at"), x.get("summary")) for x in local_log}
    for entry in node.get("change_log") or []:
        if (entry.get("at"), entry.get("summary")) not in seen:
            local_log.append(entry)
    merged["change_log"] = local_log
    if force:
        merged["node_type"] = node["node_type"]
    return merged


# ------------------------------------------------------------
# 导出
# ------------------------------------------------------------

def export_package(selected_ids: list[str]) -> dict:
    ids = [x for x in (selected_ids or []) if isinstance(x, str)]
    if not ids:
        raise ValueError("未勾选任何节点，禁止导出")
    nodes = _all_nodes()
    by_id = {n["id"]: n for n in nodes}
    missing = [x for x in ids if x not in by_id]
    if missing:
        raise ValueError("选中节点不存在：" + "、".join(missing[:5]))
    selected = list(dict.fromkeys(ids))
    sel = set(selected)
    children: dict[str | None, list[dict]] = {}
    for n in nodes:
        children.setdefault(n["parent_id"], []).append(n)

    def descendants(nid):
        out = []
        for child in children.get(nid, []):
            out.append(child["id"])
            out.extend(descendants(child["id"]))
        return out

    fully, half = [], []
    for nid in selected:
        desc = descendants(nid)
        if desc and all(x in sel for x in desc):
            fully.append(nid)
        elif desc:
            half.append(nid)
        else:
            fully.append(nid)

    roots = [nid for nid in selected
             if not any(a in sel for a in _ancestor_ids(by_id[nid], by_id))]

    out_nodes = [by_id[nid] for nid in selected]
    referenced: list[dict] = []
    seen_ref: set[str] = set()
    for node in out_nodes:
        for rel in node.get("relations") or []:
            target = rel.get("target_id")
            if not target or target in sel or target in seen_ref:
                continue
            seen_ref.add(target)
            tgt = by_id.get(target)
            if tgt:
                referenced.append(_minimal(tgt))
                root = _root_of(tgt, by_id)
                if root and root["id"] not in sel and root["id"] not in seen_ref:
                    seen_ref.add(root["id"])
                    referenced.append(_minimal(root))
            else:
                referenced.append({"id": target, "path": rel.get("target_path") or "",
                                   "name": "", "node_type": "", "status": "",
                                   "summary": "", "dangling": True})
    return {
        "schema_version": SCHEMA_VERSION,
        "mode": "export",
        "exported_at": _now(),
        "selection": {
            "selected_ids": selected,
            "fully_selected_ids": fully,
            "half_selected_ids": half,
            "root_ids": roots,
        },
        "nodes": [_export_node(n) for n in out_nodes],
        "referenced_nodes": referenced,
    }


def _ancestor_ids(node: dict, by_id: dict) -> list[str]:
    out = []
    cur = node
    while cur and cur.get("parent_id"):
        out.append(cur["parent_id"])
        cur = by_id.get(cur["parent_id"])
    return out


def _export_node(node: dict) -> dict:
    keys = ("id", "parent_id", "path", "node_type", "name", "status", "summary",
            "scope", "relations", "confidence", "extensions", "change_log",
            "version_tag", "updated_at", "source", *LIST_FIELDS)
    return {k: node.get(k) for k in keys if k in node}


def resolve_node_refs(refs: list[str]) -> list[str]:
    """把 id / path 混合引用解析成节点 id，保持输入顺序并去重。"""
    nodes = _all_nodes()
    by_id = {n["id"]: n for n in nodes}
    by_path = {n["path"]: n for n in nodes}
    resolved: list[str] = []
    missing: list[str] = []
    for ref in refs or []:
        text = str(ref or "").strip()
        if not text:
            continue
        node = by_id.get(text) or by_path.get(text)
        if node is None:
            missing.append(text)
            continue
        if node["id"] not in resolved:
            resolved.append(node["id"])
    if missing:
        raise ValueError("找不到节点：" + "、".join(missing))
    if not resolved:
        raise ValueError("未提供任何节点 id 或 path")
    return resolved


def export_package_for_cli(refs: list[str], include_ancestors: bool = True) -> dict:
    """CLI 导出：按 id/path 选节点，向上补齐祖先链，不扩展兄弟/子节点。

    复用 export_package，导出包字段与浏览器下载的 export 包完全一致。
    """
    ids = resolve_node_refs(refs)
    if include_ancestors:
        nodes = _all_nodes()
        by_id = {n["id"]: n for n in nodes}
        expanded: list[str] = []
        for nid in ids:
            node = by_id.get(nid)
            if node is None:
                raise ValueError(f"节点已不存在：{nid}")
            chain = list(reversed(_ancestor_ids(node, by_id))) + [nid]
            for item in chain:
                if item not in expanded:
                    expanded.append(item)
        ids = expanded
    return export_package(ids)


# ------------------------------------------------------------
# 手动变更
# ------------------------------------------------------------

def manual_update(node_id: str, data: dict) -> dict:
    node = _one_node(node_id)
    reason = str(data.get("reason") or "").strip()
    if not reason:
        raise ValueError("手动变更必须填写原因")
    changes = data.get("fields") or {}
    if not isinstance(changes, dict) or not changes:
        raise ValueError("没有可保存的字段改动")
    bad = [k for k in changes if k not in EDITABLE_FIELDS]
    if bad:
        raise ValueError("以下字段不可手动修改：" + "、".join(bad))
    before = {k: node.get(k) for k in changes}
    updated = dict(node)
    for key, value in changes.items():
        if key == "scope":
            errors: list[str] = []
            updated["scope"] = _scope(value, errors)
            if errors:
                raise ValueError("；".join(errors))
        elif key == "relations":
            errors = []
            updated["relations"] = _relations(value, errors)
            if errors:
                raise ValueError("；".join(errors))
        elif key in LIST_FIELDS:
            errors = []
            updated[key] = _str_list(value, key, errors)
            if errors:
                raise ValueError("；".join(errors))
        elif key == "confidence":
            if value in (None, ""):
                updated["confidence"] = ""
            elif value in CONFIDENCES:
                updated["confidence"] = value
            else:
                raise ValueError("confidence 非法")
        elif key == "extensions":
            if value is not None and not isinstance(value, dict):
                raise ValueError("extensions 必须为对象")
            updated["extensions"] = value or {}
        elif key == "status":
            if value not in STATUSES:
                raise ValueError("status 非法")
            updated["status"] = value
        elif key == "name":
            if not isinstance(value, str) or not value.strip():
                raise ValueError("name 不能为空")
            updated["name"] = value.strip()
        elif key == "summary":
            if not isinstance(value, str):
                raise ValueError("summary 必须为字符串")
            updated["summary"] = value
        else:
            updated[key] = value

    diffs = []
    for key in changes:
        if _json(before.get(key)) != _json(updated.get(key)):
            diffs.append({"field": key, "before": before.get(key), "after": updated.get(key)})
    if not diffs:
        raise ValueError("没有实际改动")
    if data.get("append_log"):
        log_text = str(data.get("log_text") or "").strip()
        if not log_text:
            raise ValueError("勾选了追加日志，但日志文本为空")
        updated.setdefault("change_log", [])
        updated["change_log"] = list(updated.get("change_log") or [])
        updated["change_log"].append({"at": _now(), "summary": log_text,
                                      "agent": "manual", "reason": reason,
                                      "related_paths": []})
    updated["updated_at"] = _now()
    blocked = [k for k in READONLY_FIELDS if k in changes]
    if blocked:
        raise ValueError("以下字段只读：" + "、".join(blocked))

    conn = _conn()
    conn.execute("BEGIN IMMEDIATE")
    try:
        _update(updated, "manual")
        _record_version(conn, kind="manual", mode="manual", node_id=node_id,
                        summary=f"手动变更 {updated['name']}（{len(diffs)} 个字段）",
                        data={"reason": reason, "diffs": diffs,
                              "appended_log": bool(data.get("append_log"))})
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {"valid": True, "node": _one_node(node_id), "diffs": diffs}


# ------------------------------------------------------------
# 物理删除（仅作废节点）
# ------------------------------------------------------------

def _subtree_nodes(node_id: str, nodes: list[dict]) -> list[dict]:
    children: dict[str | None, list[dict]] = {}
    for n in nodes:
        children.setdefault(n["parent_id"], []).append(n)
    out: list[dict] = []
    stack = [node_id]
    seen = {node_id}
    while stack:
        cur = stack.pop()
        for child in children.get(cur, []):
            if child["id"] in seen:
                continue
            seen.add(child["id"])
            out.append(child)
            stack.append(child["id"])
    return out


def _incoming_refs(targets: list[dict], nodes: list[dict]) -> list[dict]:
    """查找指向本次删除集合的、来自删除集合外部的入向引用。

    同时覆盖两种历史数据：target_id 已是节点 id，以及早期只写了 target_path
    的未解析关系。来源节点若也在删除集合内，其关系行会随节点一起消失，不视为阻塞。
    """
    by_id = {n["id"]: n for n in targets}
    known_ids = {n["id"] for n in nodes}
    by_path: dict[str, dict] = {}
    for n in targets:
        path = str(n.get("path") or "")
        if path:
            by_path.setdefault(path, n)
    refs: list[dict] = []
    for source in nodes:
        if source["id"] in by_id:
            continue
        for rel in source.get("relations") or []:
            target_id = str(rel.get("target_id") or "")
            target_path = str(rel.get("target_path") or "")
            target = by_id.get(target_id)
            # 只有 target_id 为空/不是已知节点 id（历史 path 占位或悬空）时才按 path 回退。
            # 若 target_id 已指向删除集合外的真实节点，即使 path 与待删节点重名，也不算入向引用。
            if target is None and target_path and (not target_id or target_id not in known_ids):
                target = by_path.get(target_path)
            if target is None:
                continue
            refs.append({
                "source_id": source["id"],
                "source_path": source["path"],
                "source_name": source["name"],
                "source_status": source["status"],
                "relation_type": rel.get("relation_type"),
                "note": rel.get("note") or "",
                "target_id": target["id"],
                "target_name": target["name"],
                "target_path": target["path"],
            })
    refs.sort(key=lambda x: (x["source_path"], x["relation_type"] or "", x["target_path"]))
    return refs


def _delete_ref(node: dict) -> dict:
    return {"id": node["id"], "path": node["path"], "name": node["name"],
            "status": node["status"]}


def delete_node(node_id: str, data: dict) -> dict:
    """物理删除一个作废节点；子节点全部作废时，连同整棵作废子树一起删除。

    放宽口径：
      - 删除范围内所有节点必须 deprecated；
      - 范围内节点的出向目标若已 deprecated（或已悬空）忽略，存在非作废目标则拒绝；
      - 外部入向引用来源若 deprecated 忽略，非作废来源仍拒绝；
      - 所有被忽略的引用仍写入删除快照，留痕完整。
    """
    node = _one_node(node_id)
    if node["status"] != "deprecated":
        raise ValueError("只能物理删除作废（deprecated）节点；当前状态：" + str(node["status"]))
    reason = str(data.get("reason") or "").strip()
    if not reason:
        raise ValueError("物理删除必须填写原因")

    nodes = _all_nodes()
    descendants = _subtree_nodes(node_id, nodes)
    active = [n for n in descendants if n["status"] != "deprecated"]
    if active:
        raise DeleteBlocked(
            "存在未作废的子节点，请先处理子节点",
            reason_code="active_children",
            children=[_delete_ref(n) for n in active])

    delete_nodes = [node] + descendants
    delete_ids = {n["id"] for n in delete_nodes}
    by_id = {n["id"]: n for n in nodes}
    by_path = {n["path"]: n for n in nodes}

    all_refs = _incoming_refs(delete_nodes, nodes)
    blocking_refs = [r for r in all_refs if r.get("source_status") != "deprecated"]
    ignored_refs = [r for r in all_refs if r.get("source_status") == "deprecated"]

    active_out: list[dict] = []
    ignored_out: list[dict] = []
    for source in delete_nodes:
        for rel in source.get("relations") or []:
            target_id = str(rel.get("target_id") or "").strip()
            target_path = str(rel.get("target_path") or "").strip()
            target = by_id.get(target_id) or (by_path.get(target_path) if target_path else None)
            entry = {
                "source_id": source["id"], "source_path": source["path"],
                "source_name": source["name"], "relation_type": rel.get("relation_type"),
                "note": rel.get("note") or "",
                "target_id": target["id"] if target else target_id,
                "target_path": target["path"] if target else target_path,
                "target_name": target["name"] if target else "",
                "target_status": target["status"] if target else "",
            }
            if target and target["id"] in delete_ids:
                ignored_out.append({**entry, "reason": "目标在同一删除范围内"})
            elif target is None:
                ignored_out.append({**entry, "reason": "目标已不存在（悬空引用）"})
            elif target["status"] == "deprecated":
                ignored_out.append({**entry, "reason": "目标已作废"})
            else:
                active_out.append(entry)

    if blocking_refs or active_out:
        parts = []
        if blocking_refs:
            parts.append(f"{len(blocking_refs)} 条非作废外部入向引用")
        if active_out:
            parts.append(f"{len(active_out)} 条指向非作废目标的出向关系")
        raise DeleteBlocked(
            "删除范围仍存在在用引用，无法删除（" + "；".join(parts) + "）",
            reason_code="active_references",
            references=blocking_refs,
            ignored_references=ignored_refs,
            outgoing=active_out,
            ignored_outgoing=ignored_out)

    refs_by_target: dict[str, list[dict]] = {n["id"]: [] for n in delete_nodes}
    for ref in all_refs:
        refs_by_target.setdefault(ref["target_id"], []).append(ref)
    out_by_source: dict[str, list[dict]] = {n["id"]: [] for n in delete_nodes}
    ignored_out_by_source: dict[str, list[dict]] = {n["id"]: [] for n in delete_nodes}
    for entry in active_out:
        out_by_source.setdefault(entry["source_id"], []).append(entry)
    for entry in ignored_out:
        ignored_out_by_source.setdefault(entry["source_id"], []).append(entry)

    now = _now()
    batch_id = uuid.uuid4().hex
    conn = _conn()
    conn.execute("BEGIN IMMEDIATE")
    try:
        history_ids: list[int] = []
        for target in delete_nodes:
            if len(delete_nodes) == 1:
                summary = f"物理删除 {target['name']}"
            elif target["id"] == node_id:
                summary = f"物理删除 {target['name']}（含 {len(delete_nodes) - 1} 个作废子节点）"
            else:
                summary = f"随主节点物理删除 {target['name']}"
            history_ids.append(_record_version(
                conn, kind="manual", mode="delete", node_id=target["id"],
                summary=summary,
                data={"reason": reason, "snapshot": target,
                      "incoming": refs_by_target.get(target["id"], []),
                      "ignored_incoming": [r for r in refs_by_target.get(target["id"], [])
                                           if r.get("source_status") == "deprecated"],
                      "outgoing": out_by_source.get(target["id"], []),
                      "ignored_outgoing": ignored_out_by_source.get(target["id"], []),
                      "path": target["path"], "deleted_at": now,
                      "batch_id": batch_id, "cascade_root": node["id"],
                      "cascade_root_path": node["path"],
                      "cascade_count": len(delete_nodes)}))
        placeholders = ",".join("?" for _ in delete_nodes)
        cur = conn.execute(
            f"DELETE FROM bg_nodes WHERE id IN ({placeholders})",
            [n["id"] for n in delete_nodes])
        if cur.rowcount != len(delete_nodes):
            raise ValueError(
                f"删除失败：预期删除 {len(delete_nodes)} 个节点，实际删除 {cur.rowcount} 个")
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    return {"valid": True, "deleted": True, "node_id": node_id,
            "path": node["path"], "history_id": history_ids[0],
            "history_ids": history_ids,
            "deleted_ids": [n["id"] for n in delete_nodes],
            "deleted_count": len(delete_nodes),
            "ignored_references": ignored_refs,
            "ignored_outgoing": ignored_out,
            "snapshot": node, "snapshots": delete_nodes}


# ------------------------------------------------------------
# 历史归档
# ------------------------------------------------------------

def _record_version(conn, *, kind: str, mode: str, node_id: str | None,
                    summary: str, data: dict) -> int:
    cur = conn.execute(
        "INSERT INTO bg_versions(kind,mode,node_id,summary,data,at,raw_json,live_json) VALUES(?,?,?,?,?,?,?,?)",
        (kind, mode, node_id, summary, _json(data), _now(), _json(data), _json(data)))
    return cur.lastrowid


def history(node_id: str | None = None) -> dict:
    if node_id:
        rows = _conn().execute(
            "SELECT * FROM bg_versions WHERE node_id=? ORDER BY at DESC, id DESC", (node_id,)).fetchall()
    else:
        rows = _conn().execute("SELECT * FROM bg_versions ORDER BY at DESC, id DESC").fetchall()
    items = []
    for row in rows:
        data = _decode(row["data"], {})
        entry = {"id": row["id"], "kind": row["kind"], "mode": row["mode"],
                 "node_id": row["node_id"], "summary": row["summary"], "at": row["at"]}
        if row["kind"] == "manual":
            entry["reason"] = data.get("reason", "")
            if row["mode"] == "delete":
                entry["deleted"] = True
                entry["path"] = data.get("path", "")
                entry["snapshot"] = data.get("snapshot") or {}
                entry["references"] = data.get("incoming") or []
                entry["batch_id"] = data.get("batch_id", "")
                entry["cascade_root"] = data.get("cascade_root", "")
                entry["cascade_root_path"] = data.get("cascade_root_path", "")
                entry["cascade_count"] = data.get("cascade_count", 1)
            else:
                entry["diffs"] = data.get("diffs", [])
        else:
            applied = data.get("applied") or {}
            entry["counts"] = applied
            entry["changed_paths"] = data.get("changed_paths") or []
            entry["base_count"] = len(data.get("base") or [])
        items.append(entry)
    return {"items": items, "total": len(items)}


def clear_history() -> dict:
    conn = _conn()
    conn.execute("DELETE FROM bg_versions")
    conn.commit()
    return {"cleared": True}


# ------------------------------------------------------------
# 对外接口
# ------------------------------------------------------------

def tree() -> dict:
    nodes = _all_nodes()
    incoming = _incoming(nodes)
    counts = {
        "total": len(nodes),
        "active": sum(1 for n in nodes if n["status"] == "active"),
        "deprecated": sum(1 for n in nodes if n["status"] == "deprecated"),
    }
    return {"schema_version": SCHEMA_VERSION, "nodes": nodes,
            "incoming": incoming, "counts": counts}


def api(method: str, path: str, query: dict, data: dict):
    if method == "GET" and path == "/api/bg/tree":
        return tree()
    if method == "GET" and re.fullmatch(r"/api/bg/nodes/[^/]+", path):
        node_id = path.rsplit("/", 1)[-1]
        node = _one_node(node_id)
        nodes = _all_nodes()
        return {"node": node, "incoming": _incoming(nodes).get(node_id, [])}
    if method == "POST" and path == "/api/bg/import/preview":
        package = data.get("package")
        if not isinstance(package, dict):
            raise ValueError("缺少 package")
        mode = package.get("mode")
        if mode == "new":
            return import_new(package) if data.get("commit") else _preview_new(package)
        if mode == "update":
            plan = plan_update(package)
            return plan
        raise ValueError("无法识别的包模式（mode 需为 new / update）")
    if method == "POST" and path == "/api/bg/import/commit":
        package = data.get("package")
        if not isinstance(package, dict):
            raise ValueError("缺少 package")
        mode = package.get("mode")
        if mode == "new":
            result = import_new(package)
            if not result.get("valid"):
                raise ValueError(result.get("error") or "导入失败")
            return result
        if mode == "update":
            return commit_update(package, data.get("decisions") or {})
        raise ValueError("无法识别的包模式（mode 需为 new / update）")
    if method == "POST" and path == "/api/bg/export":
        return {"package": export_package(data.get("selected_ids") or [])}
    if method == "POST" and re.fullmatch(r"/api/bg/nodes/[^/]+/manual", path):
        node_id = path.split("/")[4]
        return manual_update(node_id, data)
    if method == "POST" and re.fullmatch(r"/api/bg/nodes/[^/]+/delete", path):
        node_id = path.split("/")[4]
        return delete_node(node_id, data)
    if method == "GET" and path == "/api/bg/history":
        return history(query.get("node_id") or None)
    if method == "POST" and path == "/api/bg/history/clear":
        return clear_history()
    raise LookupError(f"未找到背景信息库接口：{method} {path}")


def _preview_new(package: dict) -> dict:
    """全新导入的预览：只做格式校验，不写库；缺失父节点会生成占位。"""
    nodes_raw = package.get("nodes")
    if not isinstance(nodes_raw, list) or not nodes_raw:
        return {"valid": False, "error": "nodes 必须为非空数组"}
    errors: list[str] = []
    nodes: list[dict] = []
    for i, raw in enumerate(nodes_raw, 1):
        node, errs = _normalize(raw, i)
        errors.extend(errs)
        if node:
            nodes.append(node)
    provided = [n["id"] for n in nodes if n["id"]]
    dup = {x for x in provided if provided.count(x) > 1}
    if dup:
        errors.append("节点 id 重复：" + "、".join(sorted(dup)))
    if errors:
        return {"valid": False, "error": "存在非法节点，整包不可导入", "errors": errors}

    nodes, placeholders, errors = _prepare_new_nodes(nodes)
    if errors:
        return {"valid": False, "error": "parent_id 解析失败", "errors": errors}

    items = [{"kind": "new", "name": n["name"], "node_type": n["node_type"]}
             for n in nodes if n not in placeholders]
    items += [{"kind": "placeholder", "name": n["name"], "path": n["path"],
               "reason": "父节点未随包提供，自动生成占位"} for n in placeholders]
    return {"valid": True, "preview": {
        "mode": "new",
        "counts": {"new": len(nodes) - len(placeholders), "illegal": 0,
                   "placeholder": len(placeholders)},
        "items": items,
        "placeholders": [{"name": n["name"], "path": n["path"]} for n in placeholders],
        "schema_warning": str(package.get("schema_version") or "") != SCHEMA_VERSION,
    }}
