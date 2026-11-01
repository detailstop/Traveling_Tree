---
id: bg_library
name: 项目优化与当前综述
version: 1.0
kind: functional
has_ui: true
has_backend: true
db_module_key: bg
routes_prefix: /api/plugin/bg_library
summary: 功能背景信息库 · 树形浏览 · 勾选导出 · 优化导入 · 历史归档
icon: 🗺️
entries: [bg-library]
tables: [bg_nodes, bg_versions, file_notes, db_rules]
data_dirs: []
shared_features: []
provides: []
consumes: []
market_package: true
source: local
known_limits: 包已生成，待上传 Release；download_url 为空时安装报“包地址未配置”
sensitive_data: []
---
# 项目优化与当前综述 信息卡

## 职责
功能背景信息库 · 树形浏览 · 勾选导出 · 优化导入 · 历史归档

## 入口与路由
- entry：bg-library
- 后端路由：/api/plugin/bg_library

## 数据表
- `bg_nodes`
- `bg_versions`
- `file_notes`
- `db_rules`

## 依赖
- provides：无
- consumes：无

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
