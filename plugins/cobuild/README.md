# 多 AI 共建（cobuild）

## 职责
多 AI 共建打卡、作废与数据读取；镜像 `docs/多AI共建日志.md`。

## 入口与路由
- 分类：functional（backend-only 例外）
- 入口：无卡片（`entries: []`）
- 后端：`backend.py`；路由前缀 `/api/plugin/cobuild/*`，子路径见 `backend.py::handle`；契约 `docs/appendix/interfaces/cobuild.md`

## 数据表
- 无业务表

## 依赖
- 数据源：`data/ai_cobuild.json`
- 镜像：`docs/多AI共建日志.md`（自动生成，勿手改）

## 注意事项
- 只追加/作废，不删除历史。
- 打卡入口在首页「多 AI 共建的声明」。
