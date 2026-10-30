# 网页会话（webchat）· 底层下沉插件

> 分类：`library`（无前端卡片）。分类清单见 `plugins/lib.json`；分类口径见白皮书附录 E。

## 职责
用 Playwright 维护一个常驻的持久化浏览器会话：专用 worker 线程串行执行请求，保存登录态，向上层提供会话列表、登录、聊天、重启、新建与删除能力。它本身不渲染任何卡片或页面。

## 暴露接口（`/api/plugin/webchat/*`）
| 方法 | 子路径 | 说明 |
|---|---|---|
| GET | `/status` | 浏览器/会话状态 |
| GET | `/sessions` | 会话列表 |
| POST | `/chat` | 发送消息，body 含 `url`、`message`、`expect`（可选） |
| POST | `/restart` | 强制重启浏览器上下文（可打断卡住的等待） |
| POST | `/new` | 新建会话 |
| POST | `/login` | 打开登录流程 |
| POST | `/sessions` | 新增会话，body 含 `name`、`url` |
| POST | `/sessions/delete` | 删除会话，body 含 `id` |

未匹配子路径返回 404 `not_found`；方法不符返回 405 `method_not_allowed`；异常统一由宿主转为 `plugin_error`，不冒泡到宿主日志。

## 调用方（called_by）
- `plugins/ai`（`feature.js`：status / sessions / chat / login / delete）
- `plugins/aidebug`（经共享 `ui/web/static/features/webchat.js`）
- `plugins/finance`（`feature_finance.js`：chat / restart / sessions / new）
- `plugins/promptgen`（经共享 `features/webchat.js`：默认会话与 chatPost）
- `ui/web/static/app.js`（restart、卡住请求中断）
- `ui/web/static/features/webchat.js`（共享前端封装：sessions / chat）

## 依赖
- `playwright`（懒加载 `sync_api`）与浏览器二进制：默认 `data/playwright_browsers`，可用 `data/settings.json` 的 `paths.playwright_browsers` 覆盖。
- 登录态 profile：`data/plugins/webchat/webchat_profile/`（敏感，禁止读取正文、禁止提交）。
- `config` 与 `modules.settings_store`（路径与设置）。

## 注意事项
- 请求串行：同一时刻只有一个浏览器操作，长任务会阻塞后续请求；必要时用 `/restart` 打断。
- 页面改版、限流、断网都会导致失败；失败以 JSON 错误返回，调用方应做降级提示。
- 无鉴权/限流，仅应监听 `127.0.0.1`。
- `data/` 不进 Git；profile 克隆后为空，需重新扫码登录。

## 不面向用户
没有卡片、没有独立入口、没有前端资源，不出现在「所有功能」列表；只作为其他插件与宿主前端的共享能力存在。
