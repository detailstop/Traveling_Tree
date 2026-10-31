# Screeps Arena（screeps）

## 职责
Screeps Arena：单位与模块管理。

## 入口与路由
- 分类：functional（有卡片）
- 入口：entry `screeps` → `feature.js`
- 后端：`backend.py`；路由前缀 `/api/plugin/screeps/*`，子路径见 `backend.py::handle`

## 数据表
- `screeps_assets`
- `screeps_units`
- `screeps_modules`

- raw/live 状态：全部表含 `raw_json` + `live_json`（round 72 补齐）

## 依赖
- 无跨插件依赖

## 注意事项
- round 72 已补 `live_json` 并加幂等 migrate。
