---
id: model_usage
name: 模型用量与消费
version: 1.0
kind: functional
has_ui: true
has_backend: true
db_module_key: model_usage
routes_prefix: /api/plugin/model_usage
summary: 单次调用记录 · 对话/功能/模型分组 · 趋势与消费
entries: [model-usage]
tables: [model_usage_logs]
data_dirs: []
shared_features: []
provides: []
consumes: []
market_package: false
source: local
known_limits: 
sensitive_data: []
---
# 模型用量与消费 信息卡

## 职责
单次调用记录 · 对话/功能/模型分组 · 趋势与消费

## 入口与路由
- entry：model-usage
- 后端路由：/api/plugin/model_usage

## 数据表
- `model_usage_logs`

## 依赖
- provides：无
- consumes：无

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
