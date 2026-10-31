# 模型用量与消费（model_usage）

## 职责
模型用量与消费：调用记录、定价与统计。

## 入口与路由
- 分类：functional（有卡片）
- 入口：entry `model-usage` → `feature.js`
- 后端：`backend.py`；路由前缀 `/api/plugin/model_usage/*`，子路径见 `backend.py::handle`

## 数据表
- `model_usage_logs`

- raw/live 状态：缺 `raw_json`/`live_json`（日志表口径待 G2，round 73）

## 依赖
- 无跨插件依赖

## 注意事项
- 日志表是否属内容表需按 G2 判定；勿手工补数。
