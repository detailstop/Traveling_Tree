# 像素画与插件绘制（pixel_art）

## 职责
像素画与插件绘制：作品、素材引用与视觉设置。

## 入口与路由
- 分类：functional（有卡片）
- 入口：entry `pixel-art` → `feature.js`
- 后端：`backend.py`；路由前缀 `/api/plugin/pixel_art/*`，子路径见 `backend.py::handle`

## 数据表
- `pixel_artworks`
- `pixel_asset_refs`
- `visual_settings`

- raw/live 状态：3 表缺 `raw_json`/`live_json`（round 71 blocker，按 G2 待 round 73）

## 依赖
- 被 `book_reader` 直接 import `service`（G4 已标注）

## 注意事项
- `visual_settings` 若为纯 UI 偏好可按 G2 豁免 `live_json`。
- 作品为内容资产，勿清空。
