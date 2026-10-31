---
id: expdata
name: 实验数据获取
version: 1.0
kind: functional
has_ui: true
has_backend: false
db_module_key: null
routes_prefix: null
summary: A 键开始 · 三次点击 · 输出三线段长度
entries: [expdata]
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
# 实验数据获取 信息卡

## 职责
A 键开始 · 三次点击 · 输出三线段长度

## 入口与路由
- entry：expdata
- 后端路由：无

## 数据表
- 无业务表

## 依赖
- provides：无
- consumes：无

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
