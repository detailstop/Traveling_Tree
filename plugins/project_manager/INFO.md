---
id: project_manager
name: 项目管理
version: 1.0
kind: functional
has_ui: true
has_backend: true
db_module_key: pm
routes_prefix: /api/plugin/project_manager
summary: 六阶段项目推进 · 手填提示词 · 结果留档与上下文声明
icon: 🗂️
entries: [project-manager]
tables: [pm_stage_templates, pm_projects, pm_stages, pm_prompt_drafts, pm_results]
data_dirs: []
shared_features: []
provides: []
consumes: []
market_package: true
source: local
known_limits: 包已生成，待上传 Release；download_url 为空时安装报“包地址未配置”
sensitive_data: []
---
# 项目管理 信息卡

## 职责
六阶段项目推进 · 手填提示词 · 结果留档与上下文声明

## 入口与路由
- entry：project-manager
- 后端路由：/api/plugin/project_manager

## 数据表
- `pm_stage_templates`
- `pm_projects`
- `pm_stages`
- `pm_prompt_drafts`
- `pm_results`

## 依赖
- provides：无
- consumes：无

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
