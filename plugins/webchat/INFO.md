---
id: webchat
name: 网页会话
version: 1.0
kind: library
has_ui: false
has_backend: true
db_module_key: null
routes_prefix: /api/plugin/webchat
summary: Playwright 网页会话后端（无前端卡片）
icon: 💬
entries: []
tables: []
data_dirs: [webchat]
shared_features: []
provides: [webchat]
consumes: []
market_package: false
source: local
known_limits: 
sensitive_data: [data/plugins/webchat/webchat_profile/]
---
# 网页会话 信息卡

## 职责
Playwright 网页会话后端（无前端卡片）

## 入口与路由
- entry：无（backend-only）
- 后端路由：/api/plugin/webchat

## 数据表
- 无业务表

## 依赖
- provides：webchat
- consumes：无

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
