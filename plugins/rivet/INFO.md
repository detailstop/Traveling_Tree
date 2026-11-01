---
id: rivet
name: 铆钉点
version: 1.0
kind: functional
has_ui: true
has_backend: true
db_module_key: null
routes_prefix: /api/plugin/rivet
summary: 长期任务打卡 · 统计 · 循序 · 激励
icon: 🔩
entries: [rivet]
tables: []
data_dirs: [rivet]
shared_features: []
provides: []
consumes: []
market_package: true
source: local
known_limits: 包已生成，待上传 Release；download_url 为空时安装报“包地址未配置”
sensitive_data: []
---
# 铆钉点 信息卡

## 职责
长期任务打卡 · 统计 · 循序 · 激励

## 入口与路由
- entry：rivet
- 后端路由：/api/plugin/rivet

## 数据表
- 无业务表

## 依赖
- provides：无
- consumes：无

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
