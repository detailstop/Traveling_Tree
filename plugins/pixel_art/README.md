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

- raw/live 状态：round 78 已补：pixel_artworks raw+live；pixel_asset_refs、visual_settings 仅 raw（豁免 live，可重建来源见 schema 注释）；写入显式同步

## 依赖
- 被 `book_reader` 直接 import `service`（G4 已标注）
- 对外提供能力：`provides: ["pixel_assets"]`（round 73）

## 注意事项
- `visual_settings` 若为纯 UI 偏好可按 G2 豁免 `live_json`。
- 作品为内容资产，勿清空。
