---
id: pixel_art
name: 像素画与插件绘制
version: 1.0
kind: functional
has_ui: true
has_backend: true
db_module_key: pixel_art
routes_prefix: /api/plugin/pixel_art
summary: 像素画布 · 作品库 · 书签/图标资产 · JSON/PNG/Piskel 导入导出
icon: 🎨
entries: [pixel-art]
tables: [pixel_artworks, pixel_asset_refs, visual_settings]
data_dirs: []
shared_features: []
provides: [pixel_assets]
consumes: []
market_package: false
source: local
known_limits: 
sensitive_data: []
---
# 像素画与插件绘制 信息卡

## 职责
像素画布 · 作品库 · 书签/图标资产 · JSON/PNG/Piskel 导入导出

## 入口与路由
- entry：pixel-art
- 后端路由：/api/plugin/pixel_art

## 数据表
- `pixel_artworks`
- `pixel_asset_refs`
- `visual_settings`

## 依赖
- provides：pixel_assets
- consumes：无

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
