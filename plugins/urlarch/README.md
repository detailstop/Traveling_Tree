# 网址归档（urlarch）

## 职责
网址归档：分组、链接与打开间隔。

## 入口与路由
- 分类：functional（有卡片）
- 入口：entry `urlarch` → `feature.js`
- 后端：`backend.py`；路由前缀 `/api/plugin/urlarch/*`，子路径见 `backend.py::handle`

## 数据表
- `urlarch_assets`
- `urlarch_groups`
- `urlarch_links`

- raw/live 状态：全部表含 `raw_json` + `live_json`（round 72 补齐；round 73 核实写入路径同时写 `live_json`）

## 依赖
- 无跨插件依赖

## 注意事项
- round 72 已补 `live_json` 并加幂等 migrate。
