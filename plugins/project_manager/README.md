# 项目管理（project_manager）

## 职责
项目管理：项目、阶段、模板、提示词草稿与结果。

## 入口与路由
- 分类：functional（有卡片）
- 入口：entry `project-manager` → `feature.js`
- 后端：`backend.py`；路由前缀 `/api/plugin/project_manager/*`，子路径见 `backend.py::handle`

## 数据表
- `pm_stage_templates`
- `pm_projects`
- `pm_stages`
- `pm_prompt_drafts`
- `pm_results`

- raw/live 状态：round 78 已补 5 表 raw+live（迁移快照；触发器同步写入）

## 依赖
- `seed.py` 初始化阶段模板

## 注意事项
- 项目/阶段/结果为内容资产；schema 变更同步 migrate。
