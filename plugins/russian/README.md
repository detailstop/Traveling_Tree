# 俄语单词背诵（russian）

## 职责
俄语单词背诵：知识卡片、SRS 复习、主题、知识库与统计。

## 入口与路由
- 分类：functional（有卡片）
- 入口：entry `russian` → `feature.js`
- 后端：`backend.py`；路由前缀 `/api/plugin/russian/*`，子路径见 `backend.py::handle`

## 数据表
- `items`
- `item_stats`
- `review_logs`
- `daily_logs`
- `themes`

- raw/live 状态：5 表缺 `raw_json`/`live_json`（round 71 blocker，按 G2 待 round 73）

## 依赖
- 朗读经宿主 `speakBtn()` 间接使用 `tts`
- 主库文件名 `data/russian_tutor.db`（不改名）

## 注意事项
- items/themes 为内容资产；stats/logs 口径按 G2 判定。
- 展示名“俄语单词背诵”，项目整体名仍为“旅行之木 / Traveling_Tree”。
