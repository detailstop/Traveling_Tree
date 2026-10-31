---
id: cobuild
name: 多 AI 共建
version: 1.0
kind: functional
has_ui: false
has_backend: true
db_module_key: null
routes_prefix: /api/plugin/cobuild
summary: 多 AI 共建打卡与日志镜像（无前端卡片）
entries: []
tables: []
data_dirs: []
shared_features: []
provides: []
consumes: []
market_package: false
source: local
known_limits: 
sensitive_data: []
---
# 多 AI 共建 信息卡

## 职责
多 AI 共建打卡与日志镜像（无前端卡片）

## 入口与路由
- entry：无（backend-only）
- 后端路由：/api/plugin/cobuild

## 数据表
- 无业务表

## 依赖
- provides：无
- consumes：无

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
