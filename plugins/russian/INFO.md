---
id: russian
name: 俄语单词背诵
version: 1.0
kind: functional
has_ui: true
has_backend: true
db_module_key: russian
routes_prefix: /api/plugin/russian
summary: 卡片学习 · 复习 · 知识库 · 统计
entries: [russian]
tables: [items, item_stats, review_logs, daily_logs, themes]
data_dirs: []
shared_features: []
provides: []
consumes: []
market_package: false
source: local
known_limits: 
sensitive_data: []
---
# 俄语单词背诵 信息卡

## 职责
卡片学习 · 复习 · 知识库 · 统计

## 入口与路由
- entry：russian
- 后端路由：/api/plugin/russian

## 数据表
- `items`
- `item_stats`
- `review_logs`
- `daily_logs`
- `themes`

## 依赖
- provides：无
- consumes：无

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
