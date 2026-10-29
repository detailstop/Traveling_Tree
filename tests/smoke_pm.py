"""项目管理器 API 冒烟测试（临时 SQLite 数据库，不触碰真实数据）。"""
from __future__ import annotations

import json
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

TMP = Path(tempfile.mkdtemp(prefix="rt_pm_test_"))
import config  # noqa: E402
config.DATA_DIR = TMP
config.DB_PATH = TMP / "russian_tutor.db"

from db.connection import get_conn  # noqa: E402
from ui.web.server import Handler, ThreadingHTTPServer, _bootstrap_db  # noqa: E402

PORT = 8899
BASE = f"http://127.0.0.1:{PORT}"


def request(method: str, path: str, body=None):
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            raw = response.read().decode("utf-8")
            return response.status, response.headers.get("Content-Type", ""), raw
    except urllib.error.HTTPError as exc:
        return exc.code, exc.headers.get("Content-Type", ""), exc.read().decode("utf-8")


def json_request(method: str, path: str, body=None):
    status, _, raw = request(method, path, body)
    return status, json.loads(raw) if raw else {}


def start_server():
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    time.sleep(0.15)
    return server


def main() -> int:
    _bootstrap_db()
    server = start_server()
    checks: list[bool] = []

    def check(name, condition, detail=""):
        checks.append(bool(condition))
        print(("PASS " if condition else "FAIL ") + name + (f" [{detail}]" if detail else ""))

    status, data = json_request("GET", "/api/plugin/project_manager/templates")
    templates = data.get("templates", [])
    check("six empty templates and no variables", status == 200 and len(templates) == 6 and
          all(row["prompt_template"] == "" and row["variable_spec"] == "{}" for row in templates))

    status, project = json_request("POST", "/api/plugin/project_manager/projects", {
        "name": "项目管理器 smoke", "description": "验证手填提示词、结果导入和快照"})
    project_id = project.get("id")
    stages = {stage["code"]: stage for stage in project.get("stages", [])}
    check("create project and six empty stages", status == 200 and len(stages) == 6 and
          project.get("latest_stage_id") == stages["S0"]["id"] and
          all(stage["prompt_template"] == "" and stage["variable_spec"] == "{}" and
              stage["status"] == "empty" for stage in stages.values()))

    # 首页卡片事件绑定在稳定根节点，检查展开/取消/创建路径。
    static_status, _, script = request("GET", "/plugins/project_manager/feature.js")
    css_status, _, pm_css = request("GET", "/plugins/project_manager/plugin.css")
    check("project card uses delegated expand/cancel/create actions", static_status == 200 and
          css_status == 200 and "#pm-view,#pm-view * { user-select:text; -webkit-user-select:text; }" in pm_css and
          "#pm-view.hidden,.pm-create.hidden,.pm-manual-area.hidden,.pm-result-import.hidden,.pm-format-panel.hidden { display:none !important; }" in pm_css and
          "root.addEventListener('click'" in script and "root.addEventListener('submit'" in script and
          'data-action="toggle-new-project"' in script and 'data-action="cancel-new-project"' in script and
          "form.reset();\n      form.classList.add('hidden')" in script and
          "await pmRequest('/api/plugin/project_manager/projects', 'POST'" in script and
          "form.reset();\n      await pmLoadProjects();" in script)
    format_constant = script.split("const PM_RESULT_FORMAT_REQUIREMENTS = [", 1)[-1].split("].join('\\n');", 1)[0]
    check("result-format panel has fixed schema, shared stage requirements, toggle and copy", static_status == 200 and
          "正文格式：Markdown 纯文本，长度不限，必填。" in format_constant and
          '"schema_version": "1.0"' in format_constant and '"step_id": "S0"' in format_constant and
          '"details": {}' in format_constant and
          format_constant.index('"notes": ["备注"]') < format_constant.index('"details": {}') < format_constant.index('"task_done": false') and
          "details 字段说明：details 为对象，由各阶段自行定义内部结构" in format_constant and
          all(f'"{field}"' in format_constant for field in
              ("goal", "scope_in", "scope_out", "acceptance", "constraints", "risks", "open_questions")) and
          "上述六项内容必须同时出现在正文与 details 中" in format_constant and
          '"task_done": false' in format_constant and
          format_constant.index("- S0：") < format_constant.index("- S3：") < format_constant.index("- S5：") and
          "S3：正文内必须包含一个 ```json 代码块" in format_constant and
          "S5：summary_json 必须含布尔字段 task_done。" in format_constant and
          all(control not in format_constant for control in ("复制格式要求", "结果格式要求", "展开", "收起")) and
          'id="pm-format-panel" class="pm-format-panel hidden"' in script and
          "$('#pm-format-toggle').onclick" in script and
          "pmCopy(PM_RESULT_FORMAT_REQUIREMENTS, '格式要求')" in script)

    s0 = stages["S0"]["id"]
    status, v1 = json_request("POST", f"/api/plugin/project_manager/stages/{s0}/prompt-drafts", {"content": "S0 手填提示词 v1"})
    status2, v2 = json_request("POST", f"/api/plugin/project_manager/stages/{s0}/prompt-drafts", {"content": "S0 手填提示词 v2"})
    check("create manual prompt versions and activate newest", status == 200 and status2 == 200 and
          v1["draft"]["version"] == 1 and v1["draft"]["is_active"] == 1 and
          v2["draft"]["version"] == 2 and v2["draft"]["is_active"] == 1)
    rejected, _ = json_request("POST", f"/api/plugin/project_manager/stages/{s0}/prompt-drafts", {
        "content": "不应保存", "unexpected": "field"})
    check("prompt endpoint accepts only content", rejected == 400)
    activated, old_active = json_request("PATCH", f"/api/plugin/project_manager/prompt-drafts/{v1['draft']['id']}", {"is_active": True})
    check("set any saved version active", activated == 200 and old_active["is_active"] == 1)
    prompt_status, prompt_type, prompt_text = request("GET", f"/api/plugin/project_manager/stages/{s0}/export-prompt")
    check("active prompt export is plain text only", prompt_status == 200 and "text/plain" in prompt_type and prompt_text == "S0 手填提示词 v1")

    status, result = json_request("POST", f"/api/plugin/project_manager/stages/{s0}/results", {
        "body": "# S0 结果\n正文按 Markdown 纯文本存储。",
        "summary_json": '{"objective":"确认目标与边界"}',
        "prompt_draft_id": v1["draft"]["id"]})
    header = result.get("context_header", "")
    check("import text and generate PM-CONTEXT v1 snapshot", status == 200 and result["body"].startswith("# S0") and
          header.startswith("## 项目上下文声明（AI 可读）") and
          "当前阶段：S0 需求澄清（第 1 / 6 步）" in header and "本阶段输入：无（首阶段）" in header)
    stage_status, stage = json_request("GET", f"/api/plugin/project_manager/stages/{s0}")
    check("result import sets result_pasted and lists prompt version", stage_status == 200 and
          stage["stage"]["status"] == "result_pasted" and stage["results"][0]["prompt_version"] == 1)

    context_status, context_type, exported = request("GET", f"/api/plugin/project_manager/results/{result['id']}/export-context")
    check("result context export is plain text", context_status == 200 and "text/plain" in context_type and exported == header)
    invalid_summary, _ = json_request("POST", f"/api/plugin/project_manager/stages/{s0}/results", {
        "body": "invalid json summary", "summary_json": "{oops"})
    check("reject invalid summary JSON", invalid_summary == 400)

    deleted_v1, delete_info = json_request("DELETE", f"/api/plugin/project_manager/prompt-drafts/{v1['draft']['id']}")
    _, after_delete_draft = json_request("GET", f"/api/plugin/project_manager/stages/{s0}")
    check("delete active prompt falls back and detaches result", deleted_v1 == 200 and
          delete_info.get("active_draft_id") == v2["draft"]["id"] and
          after_delete_draft["active_draft"]["id"] == v2["draft"]["id"] and
          after_delete_draft["results"][0]["prompt_draft_id"] is None)

    _, _ = json_request("PATCH", f"/api/plugin/project_manager/stages/{s0}/status", {"status": "satisfied"})
    _, project_after = json_request("GET", f"/api/plugin/project_manager/projects/{project_id}")
    check("satisfied advances latest stage to S1", project_after["latest_stage_id"] == stages["S1"]["id"])
    _, s1_result = json_request("POST", f"/api/plugin/project_manager/stages/{stages['S1']['id']}/results", {
        "body": "S1 现状盘点正文。", "summary_json": '{"objective":"现状盘点完成"}'})
    check("context includes satisfied prior-stage summary", "S0 需求澄清 — 确认目标与边界" in s1_result["context_header"])
    _, s1_again = json_request("POST", f"/api/plugin/project_manager/stages/{stages['S1']['id']}/results", {"body": "第二次导入"})
    _, s1_detail = json_request("GET", f"/api/plugin/project_manager/stages/{stages['S1']['id']}")
    check("existing result context remains an immutable snapshot", s1_detail["results"][1]["context_header"] == s1_result["context_header"])

    delete_result_status, delete_result = json_request("DELETE", f"/api/plugin/project_manager/results/{s1_again['id']}")
    _, s1_after = json_request("GET", f"/api/plugin/project_manager/stages/{stages['S1']['id']}")
    check("delete result without cascading into other results", delete_result_status == 200 and
          delete_result["deleted_id"] == s1_again["id"] and len(s1_after["results"]) == 1)

    deleted_v2, empty_info = json_request("DELETE", f"/api/plugin/project_manager/prompt-drafts/{v2['draft']['id']}")
    _, empty_stage = json_request("GET", f"/api/plugin/project_manager/stages/{s0}")
    check("delete last active prompt returns stage to empty", deleted_v2 == 200 and
          empty_info.get("active_draft_id") is None and empty_stage["active_draft"] is None and
          empty_stage["stage"]["status"] == "empty")

    bad_status, bad = json_request("GET", "/api/plugin/project_manager/not-a-route")
    check("unknown API yields status and short error for conditional error bar", bad_status == 404 and
          "未找到接口" in bad.get("error", ""))
    check("error bar is conditional, closable, and status-aware", "id = 'pm-error'" in script and
          "error.status" in script and "close.onclick = pmClearError" in script and "id=\"pm-error\"" not in script)
    check("obsolete prompt action is absent", "pm-generate" not in script)

    server.shutdown(); server.server_close()
    server = start_server()
    persisted_status, persisted = json_request("GET", f"/api/plugin/project_manager/projects/{project_id}")
    check("projects and stage data persist after restart", persisted_status == 200 and
          len(persisted.get("stages", [])) == 6 and persisted["stages"][0]["status"] == "empty" and
          persisted["latest_stage_id"] == stages["S0"]["id"])
    delete_project_status, delete_project = json_request("DELETE", f"/api/plugin/project_manager/projects/{project_id}")
    remaining = {table: get_conn().execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                 for table in ("pm_projects", "pm_stages", "pm_prompt_drafts", "pm_results")}
    missing_project_status, _ = json_request("GET", f"/api/plugin/project_manager/projects/{project_id}")
    check("delete project removes project, stages, drafts, and results", delete_project_status == 200 and
          delete_project.get("deleted_id") == project_id and all(count == 0 for count in remaining.values()) and
          missing_project_status == 404)
    server.shutdown(); server.server_close()
    print(f"\nRESULT: {sum(checks)}/{len(checks)} PASS")
    return 0 if all(checks) else 1


if __name__ == "__main__":
    raise SystemExit(main())
