# 接口契约：ai（`/api/plugin/ai/*`）

- 插件 id：`ai`（kind=functional，有卡片）
- 职责：AI 工作台：Key/模型设置、对话代理、前端状态与流水持久化。
- 路由前缀：`/api/plugin/ai/`
- 契约来源：`plugins/ai/backend.py::handle`（round 71 通读）；`ai_bridge`/`repo` 的返回字段**需执行 Agent 核实**。

## 子路径

| 方法 | 路径 | 入参 | 返回（概要） | 错误码 |
|---|---|---|---|---|
| GET | `/keys` | 无 | `ai_bridge.status()`：Key/模型状态 | 404/405 |
| PUT / POST | `/keys` | body：`provider`（可选）、`deepseek` 或 `kimi`、`deepseek_model` 或 `kimi_model` | `ai_bridge.save_keys(...)` 结果 | 405 |
| POST | `/chat` | body：`provider`（默认 deepseek）、`message`、`history`（数组，可选） | `ai_bridge.chat(...)` 结果 | 405 |
| GET | `/state` | 无 | `{ok:true, ...repo.load_state()}` | 404/405 |
| PUT / POST | `/state` | body：`state`（对象）、`txlog`（对象） | `{ok:true, ...repo.save_state(...)}` | 400/405 |

- `/keys` 的 provider 缺省规则：有 `deepseek` 字段取 deepseek，否则取 kimi；Key/模型字段按 `provider` 或 `deepseek*` 读取。
- `/state` 入参非对象：`{ok:false, error:"state/txlog 必须是对象"}`，HTTP 400；保存时 `ValueError`/`TypeError` 也返回 400。
- 未匹配子路径：`{ok:false, error:"not_found"}`，HTTP 404；方法不符：`method_not_allowed`，HTTP 405。
- 二进制响应：不适用。

## 调用方（`plugins/lib.json` 的 `called_by`）

无插件被列为调用方；但平级插件会调用本接口：`plugins/finance` → `/api/plugin/ai/keys`、`/api/plugin/ai/chat`（round 71 grep 证实）。

## 注意事项

- `data/ai_keys.json` 保存 Key（明文，敏感）；不要读取正文或提交。
- 状态保存是全量对象覆盖语义，调用方应传完整 `state`/`txlog`。
- 无鉴权/限流，仅监听 `127.0.0.1`。
- `/chat` 依赖外部网络与 provider 可用性；失败返回由 `ai_bridge` 决定（需核实）。
