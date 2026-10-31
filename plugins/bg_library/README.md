# 项目优化与当前综述（bg_library）

## 职责
背景库与文件预览：树形背景库、导入/导出、文件说明与数据库规则。

## 入口与路由
- 分类：functional（有卡片）
- 入口：entry `bg-library` → `feature.js`
- 后端：`backend.py`；路由前缀 `/api/plugin/bg_library/*`，子路径见 `backend.py::handle`

## 数据表
- `bg_nodes`
- `bg_versions`
- `file_notes`
- `db_rules`

- raw/live 状态：4 表缺 `raw_json`/`live_json`（round 71 blocker，按 G2 待 round 73 处理）

## 依赖
- `file_preview.py` 提供文件预览/说明
- 无跨插件依赖

## 注意事项
- 背景库当前不可用；file_notes/db_rules 为人工维护，可能过时。
- `file_preview` 只写说明元数据，不改源码。
