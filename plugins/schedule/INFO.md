---
id: schedule
name: 计划表
version: 1.0
kind: functional
has_ui: true
has_backend: true
db_module_key: schedule
routes_prefix: /api/plugin/schedule
summary: 周计划 · 打卡热力图
icon: 📅
entries: [schedule]
tables: [schedule_assets, schedule_week_plans, schedule_tasks]
data_dirs: []
shared_features: []
provides: []
consumes: []
market_package: true
source: local
known_limits: 包已生成，待上传 Release；download_url 为空时安装报“包地址未配置”
sensitive_data: []
---
# 计划表 信息卡

## 职责
周计划 · 打卡热力图

## 入口与路由
- entry：schedule
- 后端路由：/api/plugin/schedule

## 数据表
- `schedule_assets`
- `schedule_week_plans`
- `schedule_tasks`

## 依赖
- provides：无
- consumes：无

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
