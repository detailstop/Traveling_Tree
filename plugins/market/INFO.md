---
id: market
name: 插件市场
version: 1.0
kind: functional
has_ui: true
has_backend: true
db_module_key: market
routes_prefix: /api/plugin/market
summary: 本地插件包浏览、安装、卸载与预置状态
icon: 🛍️
entries: [market]
tables: [market_installed]
data_dirs: []
shared_features: []
provides: [market]
consumes: []
market_package: false
source: preset
known_limits: 预置，不可卸载
sensitive_data: []
---
# 插件市场 信息卡

## 职责
本地插件包浏览、安装、卸载与预置状态；含「开发插件」提示词生成（写盘到通用下载地址）与从远程拉取/本地组装双索引，含插件校验打包。

## 入口与路由
- entry：market
- 后端路由：/api/plugin/market

## 数据表
- `market_installed`

## 依赖
- provides：market
- consumes：无

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
