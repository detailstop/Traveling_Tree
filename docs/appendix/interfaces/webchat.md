# 接口契约：webchat（`/api/plugin/webchat/*`）

- 插件 id：`webchat`（kind=library，无卡片）
- 职责：Playwright 持久化浏览器会话，提供会话列表、登录、聊天、重启、新建与删除。
- 路由前缀：`/api/plugin/webchat/`
- 契约来源：`plugins/webchat/backend.py::handle`（round 71 通读）；返回字段来自 `plugins/webchat/web_chat.py`，其具体结构**需执行 Agent 核实**。

## 子路径

| 方法 | 路径 | 入参 | 返回（概要） | 错误码 |
|---|---|---|---|---|
| GET | `/status` | 无 | `web_chat.status()` 的 dict（状态字段需核实） | 404/405 |
| GET | `/sessions` | 无 | 会话列表（结构需核实） | 404/405 |
| POST | `/chat` | body：`url`、`message`、`expect`（可选） | 聊天结果 dict（字段需核实） | 404/405 |
| POST | `/restart` | 无 | 重启结果 dict | 404/405 |
| POST | `/new` | 无 | 新建会话结果 dict | 404/405 |
| POST | `/login` | 无 | 登录流程结果 dict | 404/405 |
| POST | `/sessions` | body：`name`、`url` | 新增结果 dict | 404/405 |
| POST | `/sessions/delete` | body：`id` | 删除结果 dict | 404/405 |

- 未匹配子路径：`{ok:false, error:"not_found"}`，HTTP 404。
- 子路径匹配但方法不符：`{ok:false, error:"method_not_allowed"}`，HTTP 405。
- 二进制响应：不适用（全部 JSON）。

## 调用方（`plugins/lib.json` 的 `called_by`）

`ai`、`aidebug`、`finance`、`promptgen`、`ui/web/static/app.js`、`ui/web/static/features/webchat.js`。

## 注意事项

- 请求串行执行；长任务会阻塞后续请求，可用 `/restart` 打断。
- 依赖 Playwright 与 `data/plugins/webchat/webchat_profile/` 登录态（敏感，不读正文、不进 Git）。
- 无鉴权/限流，仅监听 `127.0.0.1`。
- 业务错误可能以 `{ok:false,error:...}` + HTTP 200 返回（宿主只映射 `not_found`/`method_not_allowed`），调用方应同时检查 `ok`。
