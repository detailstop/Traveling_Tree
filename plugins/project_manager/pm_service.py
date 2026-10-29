"""项目管理器的 SQLite 业务规则：手填提示词、结果留档与上下文快照。"""

from __future__ import annotations

import json
from datetime import datetime, timezone

from plugins.project_manager import pm_repository as repo


STATUSES = {"empty", "prompt_ready", "result_pasted", "satisfied"}
PROJECT_STATUSES = {"active", "completed", "archived"}
STAGE_SEQUENCE = "S0 需求澄清 → S1 现状盘点 → S2 方案设计 → S3 任务拆解 → S4 执行提示词生成 → S5 结果回填与验收"
CONTEXT_TITLE = "## 项目上下文声明（AI 可读）"
PLACEHOLDER = "<!-- 待补充 -->"


class PMNotFoundError(Exception):
    pass


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _require_project(project_id: int) -> dict:
    project = repo.get_project(project_id)
    if not project:
        raise PMNotFoundError(f"项目不存在：{project_id}")
    return project


def _require_stage(stage_id: int) -> dict:
    stage = repo.get_stage(stage_id)
    if not stage:
        raise PMNotFoundError(f"阶段不存在：{stage_id}")
    return stage


def _summary_objective(result: dict) -> str:
    raw = result.get("summary_json")
    if raw:
        try:
            value = json.loads(raw)
            objective = value.get("objective") if isinstance(value, dict) else None
            if objective:
                return str(objective).strip()
        except (TypeError, ValueError):
            pass
    for line in (result.get("body") or "").splitlines():
        line = line.strip()
        if line:
            return line.lstrip("#* >").strip()[:300]
    return "（无摘要）"


def _latest_stage(stages: list[dict]) -> dict | None:
    if not stages:
        return None
    return next((stage for stage in stages if stage["status"] != "satisfied"), stages[-1])


def _project_view(project: dict) -> dict:
    stages = repo.list_stages(project["id"])
    current = _latest_stage(stages)
    return {**project,
            "stages": [{**stage, "is_latest": bool(current and stage["id"] == current["id"])}
                       for stage in stages],
            "latest_stage_id": current["id"] if current else None}


def list_projects() -> list[dict]:
    rows = []
    for project in repo.list_projects():
        view = _project_view(project)
        view["latest_stage"] = next((stage for stage in view["stages"] if stage["is_latest"]), None)
        rows.append(view)
    return rows


def get_project(project_id: int) -> dict:
    return _project_view(_require_project(project_id))


def create_project(name: str, description: str | None) -> dict:
    name = str(name or "").strip()
    if not name:
        raise ValueError("项目名称不能为空")
    description = str(description or "").strip() or None
    project_id = repo.create_project(name, description, _now())
    return get_project(project_id)


def delete_project(project_id: int) -> dict:
    if not repo.delete_project(project_id):
        raise PMNotFoundError(f"项目不存在：{project_id}")
    return {"deleted_id": project_id}


def update_project(project_id: int, data: dict) -> dict:
    _require_project(project_id)
    fields = {}
    if "name" in data:
        name = str(data.get("name") or "").strip()
        if not name:
            raise ValueError("项目名称不能为空")
        fields["name"] = name
    if "status" in data:
        status = str(data["status"])
        if status not in PROJECT_STATUSES:
            raise ValueError("不支持的项目状态")
        fields["status"] = status
    repo.update_project(project_id, fields, _now())
    return get_project(project_id)


def get_stage(stage_id: int) -> dict:
    stage = _require_stage(stage_id)
    project = _require_project(stage["project_id"])
    drafts = repo.list_drafts(stage_id)
    results = repo.list_results(stage_id)
    draft_versions = {draft["id"]: draft["version"] for draft in drafts}
    for result in results:
        result["prompt_version"] = draft_versions.get(result["prompt_draft_id"])
    return {
        "stage": stage,
        "project": project,
        "prompt_drafts": drafts,
        "active_draft": next((draft for draft in drafts if draft["is_active"]), None),
        "results": results,
    }


def create_prompt_draft(stage_id: int, data: dict) -> dict:
    _require_stage(stage_id)
    if not isinstance(data, dict):
        raise ValueError("请求内容必须是对象")
    if set(data) - {"content"}:
        raise ValueError("该接口只接受 content 字段")
    content = str(data.get("content") or "")
    if not content.strip():
        raise ValueError("提示词内容不能为空")
    draft_id = repo.create_draft(stage_id, content, _now())
    return {"draft": repo.get_draft(draft_id)}


def activate_draft(draft_id: int, data: dict) -> dict:
    draft = repo.get_draft(draft_id)
    if not draft:
        raise PMNotFoundError(f"提示词版本不存在：{draft_id}")
    if data.get("is_active") is not True:
        raise ValueError("只允许将提示词版本设为当前版本")
    repo.activate_draft(draft["stage_id"], draft_id, _now())
    return repo.get_draft(draft_id)


def delete_draft(draft_id: int) -> dict:
    draft = repo.get_draft(draft_id)
    if not draft:
        raise PMNotFoundError(f"提示词版本不存在：{draft_id}")
    return repo.delete_draft(draft["stage_id"], draft_id, _now())


def _context_header(stage: dict, project: dict) -> str:
    stages = repo.list_stages(project["id"])
    prior = [item for item in stages
             if item["order_index"] < stage["order_index"] and item["status"] == "satisfied"]
    summaries = []
    for previous in prior:
        result = repo.get_latest_result(previous["id"])
        if result:
            summaries.append(f"  - {previous['code']} {previous['name']} — {_summary_objective(result)}")

    previous_stage = next((item for item in stages if item["order_index"] == stage["order_index"] - 1), None)
    if previous_stage is None:
        inputs_text = "无（首阶段）"
    else:
        source_result = repo.get_latest_result(previous_stage["id"])
        result_ref = f"result#{source_result['id']}" if source_result else "result#<!-- 待补充 -->"
        inputs_text = f"前序结果 来源 = stage:{previous_stage['code']} {result_ref}"
    next_stage = next((item for item in stages if item["order_index"] == stage["order_index"] + 1), None)
    destination = f"{next_stage['code']} {next_stage['name']}" if next_stage else "回到 S4 取下一任务或项目收尾"
    lines = [
        CONTEXT_TITLE,
        "",
        "> 本段由项目管理器自动生成。阅读本产物的任何 AI 应将以下信息视为项目既定背景，无需用户重复提供。",
        "",
        "- 声明版本：PM-CONTEXT v1",
        f"- 项目：{project['name']} — {project.get('description') or PLACEHOLDER}",
        f"- 当前阶段：{stage['code']} {stage['name']}（第 {stage['order_index']} / 6 步）",
        f"- 阶段序列：{STAGE_SEQUENCE}",
        "- 前序阶段摘要：",
        *summaries,
        f"- 本阶段输入：{inputs_text}",
        f"- 本阶段输出去向：{destination}",
        f"- 生成时间：{_now()}",
        "- 声明版本：PM-CONTEXT v1",
    ]
    return "\n".join(lines)


def create_result(stage_id: int, data: dict) -> dict:
    stage = _require_stage(stage_id)
    project = _require_project(stage["project_id"])
    if not isinstance(data, dict):
        raise ValueError("请求内容必须是对象")
    body = str(data.get("body") or "")
    if not body.strip():
        raise ValueError("结果正文不能为空")
    summary = data.get("summary_json")
    if summary is not None:
        if not isinstance(summary, str):
            raise ValueError("summary_json 必须是 JSON 文本")
        try:
            json.loads(summary)
        except (TypeError, ValueError) as exc:
            raise ValueError("summary_json 不是合法 JSON") from exc
    prompt_draft_id = data.get("prompt_draft_id")
    if prompt_draft_id is not None:
        try:
            prompt_draft_id = int(prompt_draft_id)
        except (TypeError, ValueError) as exc:
            raise ValueError("prompt_draft_id 必须为整数") from exc
    header = _context_header(stage, project)
    result_id = repo.create_result(stage_id, prompt_draft_id, header, body, summary, _now())
    return get_result(result_id)


def delete_result(result_id: int) -> dict:
    stage_id = repo.delete_result(result_id, _now())
    if stage_id is None:
        raise PMNotFoundError(f"结果不存在：{result_id}")
    return {"deleted_id": result_id}


def update_stage_status(stage_id: int, status: str) -> dict:
    _require_stage(stage_id)
    if status not in STATUSES:
        raise ValueError("不支持的阶段状态")
    repo.update_stage_status(stage_id, status, _now())
    return _require_stage(stage_id)


def export_prompt(stage_id: int) -> str:
    _require_stage(stage_id)
    draft = repo.get_active_draft(stage_id)
    if not draft:
        raise PMNotFoundError("该阶段还没有当前提示词")
    return draft["content"]


def export_context(stage_id: int) -> str:
    _require_stage(stage_id)
    result = repo.get_latest_result(stage_id)
    if not result:
        raise PMNotFoundError("该阶段还没有结果")
    return result["context_header"]


def get_result(result_id: int) -> dict:
    result = repo.get_result(result_id)
    if not result:
        raise PMNotFoundError(f"结果不存在：{result_id}")
    return result


def export_result_context(result_id: int) -> str:
    return get_result(result_id)["context_header"]


def list_templates() -> list[dict]:
    return repo.list_templates()
