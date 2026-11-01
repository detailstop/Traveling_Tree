---
id: sim
name: 随机模拟器
version: 1.0
kind: functional
has_ui: true
has_backend: false
db_module_key: null
routes_prefix: null
summary: 蒙特卡洛 · 醉汉 / 粒子沉积 / 自由运动
icon: 🎲
entries: [sim]
tables: []
data_dirs: []
shared_features: []
provides: []
consumes: []
market_package: false
source: local
known_limits: 本地开发，不通过市场分发
sensitive_data: []
---
# 随机模拟器 信息卡

## 职责
蒙特卡洛 · 醉汉 / 粒子沉积 / 自由运动

## 入口与路由
- entry：sim
- 后端路由：无

## 数据表
- 无业务表

## 依赖
- provides：无
- consumes：无

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
