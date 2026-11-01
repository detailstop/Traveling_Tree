---
id: promptgen
name: 提示词生成器
version: 1.0
kind: functional
has_ui: true
has_backend: true
db_module_key: promptgen
routes_prefix: /api/plugin/promptgen
summary: 结构化组装提示词 · 简化生成工作流
icon: 📝
entries: [promptgen]
tables: [pg_assets, pg_flows, pg_modules, pg_tasks, pg_flow_groups]
data_dirs: []
shared_features: [webchat]
provides: []
consumes: []
market_package: true
source: market
known_limits: Release v1，download_url 见远程 index
sensitive_data: []
---
# 提示词生成器 信息卡

## 职责
结构化组装提示词 · 简化生成工作流

## 入口与路由
- entry：promptgen
- 后端路由：/api/plugin/promptgen

## 数据表
- `pg_assets`
- `pg_flows`
- `pg_modules`
- `pg_tasks`
- `pg_flow_groups`

## 依赖
- provides：无
- consumes：无

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
