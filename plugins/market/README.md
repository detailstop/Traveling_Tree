# 插件市场（market）

## 职责
本地插件市场：读取 `market/index.json`，展示/搜索/过滤插件；安装/卸载本地 zip 包，维护安装记录；预置插件不可卸载。

## 入口与路由
- 分类：functional（有卡片；导航型 entry，左侧栏入口）
- 入口：entry `market` → `feature.js`（`nav: true`）
- 后端：`backend.py`；路由前缀 `/api/plugin/market/*`
  - `GET /list`、`GET /index`、`GET /status?id=`
  - `POST /install`（body `id`）、`POST /uninstall`（body `id`、`delete_data`）

## 数据表
- `market_installed`（id/version/source/installed_at/status/raw_json/live_json）
- raw/live：双列；安装/卸载记录写入 raw=live=当前状态 JSON。

## 依赖
- `market/index.json`（只读）、`market/packages/*.zip`（A 阶段本地包，不进 Git）
- 预置插件：`market`、`cobuild`、`webchat`、`tts`、`pixel_art`
- 插件源码试点：`market/sources/sim/`（进 Git，zip 由脚本生成）

## 注意事项
- 安装前强制 SHA256 + zip 路径穿越/符号链接校验；安装=解压到 `plugins/<id>/`，重启生效。
- 卸载=移出 `plugins/<id>/`（保留 `data/plugins/<id>/`）；勾选删除私有数据时先备份到 `data/backup/uninstall_<id>_<ts>/`，不 DROP 主库表。
- `market` 自身为预置，不提供卸载；B 阶段远程市场预留 `fetch_package` / `market_source`。
