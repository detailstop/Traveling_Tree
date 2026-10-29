"""bg_library 插件数据访问层：file_notes / db_rules。"""

from datetime import datetime

from db.connection import get_conn


# ============================================================
# 文件预览与说明卡片（file_notes / db_rules）
# ============================================================

def list_file_notes() -> dict[str, dict]:
    """返回 path -> 说明元数据（人工保存的覆盖建议）。"""
    rows = get_conn().execute("SELECT * FROM file_notes ORDER BY path").fetchall()
    return {r["path"]: dict(r) for r in rows}


def get_file_note(path: str) -> dict | None:
    row = get_conn().execute("SELECT * FROM file_notes WHERE path=?", (path,)).fetchone()
    return dict(row) if row else None


def upsert_file_note(path: str, feature: str = "", details: str = "",
                     rules: str = "", source: str = "manual") -> dict:
    """保存/覆盖一条文件说明；created_at 首次写入，updated_at 每次刷新。"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    source = source if source in ("suggested", "manual") else "manual"
    conn = get_conn()
    conn.execute(
        "INSERT INTO file_notes(path, feature, details, rules, source, created_at, updated_at) "
        "VALUES(?,?,?,?,?,?,?) "
        "ON CONFLICT(path) DO UPDATE SET feature=excluded.feature, details=excluded.details, "
        "rules=excluded.rules, source=excluded.source, updated_at=excluded.updated_at",
        (path, feature or "", details or "", rules or "", source, now, now),
    )
    conn.commit()
    return get_file_note(path) or {}


def delete_file_note(path: str) -> bool:
    """删除指定路径的文件说明，不影响其他说明或数据库规则。"""
    cur = get_conn().execute("DELETE FROM file_notes WHERE path=?", (path,))
    get_conn().commit()
    return cur.rowcount > 0


def list_db_rules(db_path: str | None = None) -> list[dict]:
    conn = get_conn()
    if db_path:
        rows = conn.execute(
            "SELECT * FROM db_rules WHERE db_path=? ORDER BY table_name", (db_path,)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM db_rules ORDER BY db_path, table_name"
        ).fetchall()
    return [dict(r) for r in rows]


def upsert_db_rule(rule: dict) -> dict:
    """按 id 更新；无 id 时按 (db_path, table_name) 插入或覆盖。"""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    fields = ("db_path", "table_name", "key_fields", "writers", "readers",
              "migration_rule", "version")
    values = [str(rule.get(k) or "") for k in fields]
    conn = get_conn()
    rid = rule.get("id")
    if rid:
        assignments = ", ".join(f"{k}=?" for k in fields)
        conn.execute(
            f"UPDATE db_rules SET {assignments}, updated_at=? WHERE id=?",
            (*values, now, int(rid)),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM db_rules WHERE id=?", (int(rid),)).fetchone()
        return dict(row) if row else {}
    conn.execute(
        "INSERT INTO db_rules(db_path, table_name, key_fields, writers, readers, "
        "migration_rule, version, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?) "
        "ON CONFLICT(db_path, table_name) DO UPDATE SET key_fields=excluded.key_fields, "
        "writers=excluded.writers, readers=excluded.readers, "
        "migration_rule=excluded.migration_rule, version=excluded.version, "
        "updated_at=excluded.updated_at",
        (*values, now, now),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM db_rules WHERE db_path=? AND table_name=?",
        (values[0], values[1]),
    ).fetchone()
    return dict(row) if row else {}


def delete_db_rule(rule_id: int) -> bool:
    conn = get_conn()
    cur = conn.execute("DELETE FROM db_rules WHERE id=?", (int(rule_id),))
    conn.commit()
    return cur.rowcount > 0
