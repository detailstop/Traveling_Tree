# 接口契约：cobuild（`/api/plugin/cobuild/*`）

- 插件 id：`cobuild`（kind=functional 例外，backend-only 无卡片）
- 职责：多 AI 共建打卡、作废与数据读取；镜像 `docs/多AI共建日志.md`。
- 路由前缀：`/api/plugin/cobuild/`
- 契约来源：`plugins/cobuild/backend.py::handle`（round 71 通读）；`cobuild.data()/checkin()/void_entry()` 的完整返回字段**需执行 Agent 核实**。

## 子路径

| 方法 | 路径 | 入参 | 返回（概要） | 错误码 |
|---|---|---|---|---|
| GET | `/data` | 无 | `cobuild.data()`：打卡数据（含 `checkins`、`kinds` 等） | 404/405 |
| POST | `/checkin` | body：`agent`、`action`、`files`、`note`、`kind` | `checkin()` 结果（含最新全量数据与 `entry`；校验失败为 `{ok:false,error:...}`） | 405；业务校验错误通常 HTTP 200（需核实） |
| POST | `/void` | body：`id`、`reason` | `void_entry()` 结果 | 405 |

- 未匹配子路径：`{ok:false, error:"not_found"}`，HTTP 404；方法不符：`method_not_allowed`，HTTP 405。
- 二进制响应：不适用。

## 调用方（`plugins/lib.json` 的 `called_by`）

无其他插件调用；用户经首页打卡入口与 AI 打卡脚本直接使用（分类例外，见附录 E）。

## 注意事项

- `body` 非对象时按空对象处理；缺少 `agent`/`action` 由 `checkin()` 返回 `{ok:false,error:...}`。
- 打卡只追加/作废，不删除；镜像由数据源自动生成，**不要手改** `docs/多AI共建日志.md`。
- `kind` 非法值会被归为 `other`（以 `cobuild.py` 为准）。
- 宿主仅把 `not_found`/`method_not_allowed` 映射为 404/405；业务错误多为 HTTP 200 + `ok:false`，调用方必须检查 `ok`。
- 数据源在 `data/ai_cobuild.json`（不进 Git，不读敏感无关内容）。
