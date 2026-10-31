# 网页会话（webchat）

## 职责
网页会话：Playwright 持久化浏览器、会话/登录/聊天/重启。

## 入口与路由
- 分类：library（底层下沉，无卡片）
- 入口：无卡片（`entries: []`）
- 后端：`backend.py`；路由前缀 `/api/plugin/webchat/*`，子路径见 `backend.py::handle`；契约 `docs/appendix/interfaces/webchat.md`

## 数据表
- 无业务表（登录态在 `data/plugins/webchat/webchat_profile/`）

## 依赖
- `data_dirs: ["webchat"]`
- 调用方：ai、aidebug、finance、promptgen、宿主 `app.js` 与共享 `features/webchat.js`
- 外部：Playwright 与浏览器二进制

## 注意事项
- profile 为敏感登录态，不读正文、不进 Git。
- 请求串行，可用 `/restart` 打断；`provides` 尚未声明（G3，round 73）。
