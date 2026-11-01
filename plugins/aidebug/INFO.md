---
id: aidebug
name: 接口调试器
version: 1.0
kind: functional
has_ui: true
has_backend: true
db_module_key: aidebug
routes_prefix: /api/plugin/aidebug
summary: 网页 DS 对接：发送 · 抓取原文 · JSON 解码
icon: 🛠️
entries: [aidebug]
tables: [aidebug_history]
data_dirs: []
shared_features: [webchat]
provides: []
consumes: []
market_package: true
source: local
known_limits: 包已生成，待上传 Release；download_url 为空时安装报“包地址未配置”
sensitive_data: []
---
# 接口调试器 信息卡

## 职责
网页 DS 对接：发送 · 抓取原文 · JSON 解码

## 入口与路由
- entry：aidebug
- 后端路由：/api/plugin/aidebug

## 数据表
- `aidebug_history`

## 依赖
- provides：无
- consumes：无

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
