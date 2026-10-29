"""项目管理器固定六阶段模板 seed（仅首次建库由 manifest.db.seed 调用）。"""
from __future__ import annotations

import json
from datetime import datetime, timezone

from db.connection import get_conn


_STAGES = [
    ("S0", "需求澄清", "明确目标、边界、非目标与验收标准。"),
    ("S1", "现状盘点", "盘点仓库与文档，识别可复用点、约束与风险。"),
    ("S2", "方案设计", "形成对象模型、表结构、页面流程与接口方案。"),
    ("S3", "任务拆解", "将设计拆成依赖清晰、可独立验收的原子任务。"),
    ("S4", "执行提示词生成", "记录当前任务的执行提示词与结果。"),
    ("S5", "结果回填与验收", "回填外部执行输出与总结，人工确认后完成当前任务。"),
]


def load_seed() -> int:
    conn = get_conn()
    if conn.execute("SELECT 1 FROM pm_stage_templates LIMIT 1").fetchone():
        return 0
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    for order_index, (code, name, purpose) in enumerate(_STAGES, 1):
        summary_schema = {"objective": "string", "details": "object"}
        conn.execute(
            """INSERT INTO pm_stage_templates
               (order_index, code, name, purpose, prompt_template, variable_spec,
                summary_schema, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (order_index, code, name, purpose, "", "{}",
             json.dumps(summary_schema, ensure_ascii=False), now, now),
        )
    conn.commit()
    return len(_STAGES)
