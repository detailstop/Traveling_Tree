"""项目管理器的 SQLite 访问层；HTTP 层不直接编写本功能 SQL。"""

from __future__ import annotations

from db.connection import get_conn


def _dict(row):
    return dict(row) if row is not None else None


def _all(sql: str, params=()) -> list[dict]:
    return [dict(row) for row in get_conn().execute(sql, params).fetchall()]


def _one(sql: str, params=()) -> dict | None:
    return _dict(get_conn().execute(sql, params).fetchone())


def list_templates() -> list[dict]:
    return _all("SELECT * FROM pm_stage_templates ORDER BY order_index")


def get_template(template_id: int) -> dict | None:
    return _one("SELECT * FROM pm_stage_templates WHERE id=?", (template_id,))


def get_project(project_id: int) -> dict | None:
    return _one("SELECT * FROM pm_projects WHERE id=?", (project_id,))


def list_projects() -> list[dict]:
    return _all("SELECT * FROM pm_projects ORDER BY updated_at DESC, id DESC")


def delete_project(project_id: int) -> bool:
    """事务性删除项目及其全部阶段、提示词版本和结果记录。"""
    conn = get_conn()
    try:
        conn.execute("BEGIN IMMEDIATE")
        exists = conn.execute("SELECT 1 FROM pm_projects WHERE id=?", (project_id,)).fetchone()
        if exists is None:
            conn.rollback()
            return False
        conn.execute("""DELETE FROM pm_results WHERE stage_id IN
                       (SELECT id FROM pm_stages WHERE project_id=?)""", (project_id,))
        conn.execute("""DELETE FROM pm_prompt_drafts WHERE stage_id IN
                       (SELECT id FROM pm_stages WHERE project_id=?)""", (project_id,))
        conn.execute("DELETE FROM pm_stages WHERE project_id=?", (project_id,))
        conn.execute("DELETE FROM pm_projects WHERE id=?", (project_id,))
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise


def list_stages(project_id: int) -> list[dict]:
    return _all("SELECT * FROM pm_stages WHERE project_id=? ORDER BY order_index", (project_id,))


def get_stage(stage_id: int) -> dict | None:
    return _one("SELECT * FROM pm_stages WHERE id=?", (stage_id,))


def get_stage_by_code(project_id: int, code: str) -> dict | None:
    return _one("SELECT * FROM pm_stages WHERE project_id=? AND code=?", (project_id, code))


def list_drafts(stage_id: int) -> list[dict]:
    return _all("SELECT * FROM pm_prompt_drafts WHERE stage_id=? ORDER BY version DESC", (stage_id,))


def get_active_draft(stage_id: int) -> dict | None:
    return _one("SELECT * FROM pm_prompt_drafts WHERE stage_id=? AND is_active=1 ORDER BY version DESC LIMIT 1", (stage_id,))


def get_draft(draft_id: int) -> dict | None:
    return _one("SELECT * FROM pm_prompt_drafts WHERE id=?", (draft_id,))


def list_results(stage_id: int) -> list[dict]:
    return _all("SELECT * FROM pm_results WHERE stage_id=? ORDER BY id DESC", (stage_id,))


def get_latest_result(stage_id: int) -> dict | None:
    return _one("SELECT * FROM pm_results WHERE stage_id=? ORDER BY id DESC LIMIT 1", (stage_id,))


def get_result(result_id: int) -> dict | None:
    return _one("SELECT * FROM pm_results WHERE id=?", (result_id,))


def _touch_project(stage_id: int, now: str) -> None:
    get_conn().execute(
        "UPDATE pm_projects SET updated_at=? WHERE id=(SELECT project_id FROM pm_stages WHERE id=?)",
        (now, stage_id),
    )


def create_project(name: str, description: str | None, now: str) -> int:
    conn = get_conn()
    try:
        conn.execute("BEGIN IMMEDIATE")
        cur = conn.execute(
            "INSERT INTO pm_projects(name, description, status, created_at, updated_at) VALUES (?, ?, 'active', ?, ?)",
            (name, description, now, now),
        )
        project_id = int(cur.lastrowid)
        templates = conn.execute("SELECT * FROM pm_stage_templates ORDER BY order_index").fetchall()
        if len(templates) != 6:
            raise ValueError("项目管理器阶段模板未正确初始化")
        for template in templates:
            conn.execute(
                """INSERT INTO pm_stages
                   (project_id, template_id, order_index, code, name, purpose, prompt_template,
                    variable_spec, summary_schema, status, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'empty', ?, ?)""",
                (project_id, template["id"], template["order_index"], template["code"], template["name"],
                 template["purpose"], template["prompt_template"], template["variable_spec"],
                 template["summary_schema"], now, now),
            )
        conn.commit()
        return project_id
    except Exception:
        conn.rollback()
        raise


def update_project(project_id: int, fields: dict, now: str) -> None:
    if not fields:
        return
    cols = ", ".join(f"{key}=?" for key in fields)
    conn = get_conn()
    conn.execute(f"UPDATE pm_projects SET {cols}, updated_at=? WHERE id=?",
                 (*fields.values(), now, project_id))
    conn.commit()


def update_stage_status(stage_id: int, status: str, now: str) -> None:
    conn = get_conn()
    conn.execute("UPDATE pm_stages SET status=?, updated_at=? WHERE id=?", (status, now, stage_id))
    _touch_project(stage_id, now)
    conn.commit()


def create_draft(stage_id: int, content: str, now: str) -> int:
    conn = get_conn()
    try:
        conn.execute("BEGIN IMMEDIATE")
        version = conn.execute("SELECT COALESCE(MAX(version), 0)+1 FROM pm_prompt_drafts WHERE stage_id=?", (stage_id,)).fetchone()[0]
        conn.execute("UPDATE pm_prompt_drafts SET is_active=0 WHERE stage_id=?", (stage_id,))
        cur = conn.execute(
            """INSERT INTO pm_prompt_drafts(stage_id, version, source, content, variables, is_active, created_at)
               VALUES (?, ?, ?, ?, ?, 1, ?)""",
            (stage_id, version, 'manual', content, '{}', now),
        )
        conn.execute("UPDATE pm_stages SET status=CASE WHEN status='empty' THEN 'prompt_ready' ELSE status END, updated_at=? WHERE id=?",
                     (now, stage_id))
        _touch_project(stage_id, now)
        conn.commit()
        return int(cur.lastrowid)
    except Exception:
        conn.rollback()
        raise


def activate_draft(stage_id: int, draft_id: int, now: str) -> None:
    conn = get_conn()
    try:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute("UPDATE pm_prompt_drafts SET is_active=0 WHERE stage_id=?", (stage_id,))
        cur = conn.execute("UPDATE pm_prompt_drafts SET is_active=1 WHERE id=? AND stage_id=?", (draft_id, stage_id))
        if cur.rowcount == 0:
            raise ValueError("草稿不存在或不属于该阶段")
        conn.execute("UPDATE pm_stages SET status=CASE WHEN status='empty' THEN 'prompt_ready' ELSE status END, updated_at=? WHERE id=?",
                     (now, stage_id))
        _touch_project(stage_id, now)
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def delete_draft(stage_id: int, draft_id: int, now: str) -> dict:
    conn = get_conn()
    try:
        conn.execute("BEGIN IMMEDIATE")
        draft = conn.execute("SELECT id, is_active FROM pm_prompt_drafts WHERE id=? AND stage_id=?",
                             (draft_id, stage_id)).fetchone()
        if draft is None:
            raise ValueError("提示词版本不存在")
        was_active = bool(draft["is_active"])
        conn.execute("UPDATE pm_results SET prompt_draft_id=NULL WHERE prompt_draft_id=?", (draft_id,))
        conn.execute("DELETE FROM pm_prompt_drafts WHERE id=?", (draft_id,))
        remaining = conn.execute("SELECT id FROM pm_prompt_drafts WHERE stage_id=? ORDER BY version DESC LIMIT 1",
                                  (stage_id,)).fetchone()
        if was_active and remaining:
            conn.execute("UPDATE pm_prompt_drafts SET is_active=0 WHERE stage_id=?", (stage_id,))
            conn.execute("UPDATE pm_prompt_drafts SET is_active=1 WHERE id=?", (remaining["id"],))
            conn.execute("UPDATE pm_stages SET status=CASE WHEN status IN ('empty','prompt_ready') THEN 'prompt_ready' ELSE status END, updated_at=? WHERE id=?",
                         (now, stage_id))
        elif was_active:
            conn.execute("UPDATE pm_stages SET status='empty', updated_at=? WHERE id=?", (now, stage_id))
        _touch_project(stage_id, now)
        conn.commit()
        return {"deleted_id": draft_id, "was_active": was_active,
                "active_draft_id": remaining["id"] if was_active and remaining else None}
    except Exception:
        conn.rollback()
        raise


def create_result(stage_id: int, prompt_draft_id: int | None, context_header: str,
                  body: str, summary_json: str | None, now: str) -> int:
    conn = get_conn()
    try:
        conn.execute("BEGIN IMMEDIATE")
        if prompt_draft_id is not None:
            draft = conn.execute("SELECT id FROM pm_prompt_drafts WHERE id=? AND stage_id=?",
                                 (prompt_draft_id, stage_id)).fetchone()
            if draft is None:
                raise ValueError("提示词草稿不存在或不属于该阶段")
        cur = conn.execute(
            """INSERT INTO pm_results(stage_id, prompt_draft_id, context_header, body, summary_json, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (stage_id, prompt_draft_id, context_header, body, summary_json, now, now),
        )
        conn.execute("UPDATE pm_stages SET status='result_pasted', updated_at=? WHERE id=?", (now, stage_id))
        _touch_project(stage_id, now)
        conn.commit()
        return int(cur.lastrowid)
    except Exception:
        conn.rollback()
        raise


def delete_result(result_id: int, now: str) -> int | None:
    conn = get_conn()
    row = conn.execute("SELECT stage_id FROM pm_results WHERE id=?", (result_id,)).fetchone()
    if row is None:
        return None
    stage_id = int(row["stage_id"])
    conn.execute("DELETE FROM pm_results WHERE id=?", (result_id,))
    conn.execute("""UPDATE pm_stages SET status=CASE
                  WHEN status='result_pasted' AND EXISTS(SELECT 1 FROM pm_results WHERE stage_id=?) THEN 'result_pasted'
                  WHEN status='result_pasted' AND EXISTS(SELECT 1 FROM pm_prompt_drafts WHERE stage_id=? AND is_active=1) THEN 'prompt_ready'
                  WHEN status='result_pasted' THEN 'empty' ELSE status END,
                  updated_at=? WHERE id=?""", (stage_id, stage_id, now, stage_id))
    _touch_project(stage_id, now)
    conn.commit()
    return stage_id
