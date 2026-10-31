---
id: filejudge
name: 文件判官
version: 1.0
kind: functional
has_ui: true
has_backend: true
db_module_key: null
routes_prefix: /api/plugin/filejudge
summary: 扫描筛选 · 逐张审判 · 确认删除
entries: [filejudge]
tables: []
data_dirs: [filejudge]
shared_features: []
provides: []
consumes: []
market_package: false
source: local
known_limits: 
sensitive_data: []
---
# 文件判官 信息卡

## 职责
扫描筛选 · 逐张审判 · 确认删除

## 入口与路由
- entry：filejudge
- 后端路由：/api/plugin/filejudge

## 数据表
- 无业务表

## 依赖
- provides：无
- consumes：无

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
