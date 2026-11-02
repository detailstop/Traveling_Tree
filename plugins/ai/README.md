# AI 工作台（ai）

## 职责
AI 工作台：Key/模型设置、对话代理、前端状态与流水。

## 入口与路由
- 分类：functional（有卡片）
- 入口：entry `ai` → `feature.js`
- 后端：`backend.py`；路由前缀 `/api/plugin/ai/*`，子路径见 `backend.py::handle`；契约 `docs/appendix/interfaces/ai.md`

## 数据表
- `ai_sessions`
- `ai_tx_logs`

- raw/live 状态：全部表含 `raw_json` + `live_json`

## 依赖
- `shared_features: ["webchat"]`
- 调用：`/api/plugin/webchat/*`
- 跨插件关系：`consumes: ["webchat"]`（round 110 按代码实际调用补全；webchat 为宿主内插件，非第三方包）
- 对外提供能力：`provides: ["ai"]`（round 73）
- 被 `finance` 平级调用（`/api/plugin/ai/keys`、`/chat`）
- 外部：AI provider 网络、`data/ai_keys.json`

## 注意事项
- Key 为明文（`data/ai_keys.json`），勿提交/外传。
- 对话依赖外部 provider，失败可能以 `{ok:false}` 返回。
