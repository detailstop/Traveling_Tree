---
id: urlarch
name: 网址归档
version: 1.0
kind: functional
has_ui: true
has_backend: true
db_module_key: urlarch
routes_prefix: /api/plugin/urlarch
summary: 归档网址信息 · 后续接入网址爬虫
icon: 🔖
entries: [urlarch]
tables: [urlarch_assets, urlarch_groups, urlarch_links]
data_dirs: []
shared_features: []
provides: []
consumes: []
market_package: false
source: local
known_limits: 本地开发，不通过市场分发
sensitive_data: []
---
# 网址归档 信息卡

## 职责
归档网址信息 · 后续接入网址爬虫

## 入口与路由
- entry：urlarch
- 后端路由：/api/plugin/urlarch

## 数据表
- `urlarch_assets`
- `urlarch_groups`
- `urlarch_links`

## 依赖
- provides：无
- consumes：无

## 注意事项
- 组别级收起 / 展开：点某组标题栏或 ▾ 按钮切换该组链接与拦截提示的显隐（▾→▸）；状态仅存页面会话内存，刷新恢复展开；不改后端与表结构。
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
