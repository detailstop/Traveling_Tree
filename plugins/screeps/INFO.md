---
id: screeps
name: Screeps Arena
version: 1.0
kind: functional
has_ui: true
has_backend: true
db_module_key: screeps
routes_prefix: /api/plugin/screeps
summary: 编程竞技游戏 · 后续接入游玩代码生成
icon: 🤖
entries: [screeps]
tables: [screeps_assets, screeps_units, screeps_modules]
data_dirs: []
shared_features: []
provides: []
consumes: []
market_package: true
source: local
known_limits: 包已生成，待上传 Release；download_url 为空时安装报“包地址未配置”
sensitive_data: []
---
# Screeps Arena 信息卡

## 职责
编程竞技游戏 · 后续接入游玩代码生成

## 入口与路由
- entry：screeps
- 后端路由：/api/plugin/screeps

## 数据表
- `screeps_assets`
- `screeps_units`
- `screeps_modules`

## 依赖
- provides：无
- consumes：无

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
