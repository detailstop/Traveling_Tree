---
id: tts
name: 语音朗读
version: 1.0
kind: library
has_ui: false
has_backend: true
db_module_key: null
routes_prefix: /api/plugin/tts
summary: edge-tts 语音合成与缓存（无前端卡片，供各插件共用）
entries: []
tables: []
data_dirs: []
shared_features: []
provides: [tts]
consumes: []
market_package: false
source: local
known_limits: 
sensitive_data: []
---
# 语音朗读 信息卡

## 职责
edge-tts 语音合成与缓存（无前端卡片，供各插件共用）

## 入口与路由
- entry：无（backend-only）
- 后端路由：/api/plugin/tts

## 数据表
- 无业务表

## 依赖
- provides：tts
- consumes：无

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
