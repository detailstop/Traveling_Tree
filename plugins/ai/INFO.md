---
id: ai
name: AI 工作台
version: 1.0
kind: functional
has_ui: true
has_backend: true
db_module_key: ai
routes_prefix: /api/plugin/ai
summary: 多平台对话：DeepSeek · Kimi · 豆包待接入
entries: [ai]
tables: [ai_sessions, ai_tx_logs]
data_dirs: []
shared_features: [webchat]
provides: [ai]
consumes: []
market_package: false
source: local
known_limits: 
sensitive_data: [data/ai_keys.json]
---
# AI 工作台 信息卡

## 职责
多平台对话：DeepSeek · Kimi · 豆包待接入

## 入口与路由
- entry：ai
- 后端路由：/api/plugin/ai

## 数据表
- `ai_sessions`
- `ai_tx_logs`

## 依赖
- provides：ai
- consumes：无

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
