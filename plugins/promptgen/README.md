# 提示词生成器（promptgen）

## 职责
提示词生成器：流程、模块、任务、分组与资源。

## 入口与路由
- 分类：functional（有卡片）
- 入口：entry `promptgen` → `feature.js`
- 后端：`backend.py`；路由前缀 `/api/plugin/promptgen/*`，子路径见 `backend.py::handle`

## 数据表
- `pg_assets`
- `pg_flows`
- `pg_modules`
- `pg_tasks`
- `pg_flow_groups`

- raw/live 状态：全部表含 `raw_json` + `live_json`（round 72 补齐；round 73 核实写入路径同时写 `live_json`）

## 依赖
- `shared_features: ["webchat"]`（宿主公共前端脚本，按既有 shared_features 加载）
- 调用：`/api/plugin/webchat/*`
- 跨插件关系：`consumes: ["webchat"]`（webchat 为宿主内插件，非第三方包；本插件无 Python 第三方依赖，故不声明 `dependencies`）

## 注意事项
- `pg_assets` 为迁移兜底；round 72 已补 `live_json` 并加幂等 migrate。
