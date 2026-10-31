# 接口调试器（aidebug）

## 职责
接口调试器：记录与重放调试请求。

## 入口与路由
- 分类：functional（有卡片）
- 入口：entry `aidebug` → `feature.js`
- 后端：`backend.py`；路由前缀 `/api/plugin/aidebug/*`，子路径见 `backend.py::handle`

## 数据表
- `aidebug_history`

- raw/live 状态：全部表含 `raw_json` + `live_json`

## 依赖
- `shared_features: ["webchat"]`
- 调用：`/api/plugin/webchat/*`（经共享 `features/webchat.js`）

## 注意事项
- 历史记录可能含请求内容，注意体积与敏感信息。
