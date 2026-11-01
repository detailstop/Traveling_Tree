---
id: urlarch
name: 网址归档
version: 1.0
kind: functional
has_ui: true
has_backend: true
db_module_key: urlarch
routes_prefix: /api/plugin/urlarch
summary: 归档网址信息 · 后续接入网址爬虫
icon: 🔖
entries: [urlarch]
tables: [urlarch_assets, urlarch_groups, urlarch_links, urlarch_shortcuts]
data_dirs: []
shared_features: []
provides: []
consumes: []
market_package: false
source: local
known_limits: 本地开发，不通过市场分发
sensitive_data: []
---
# 网址归档 信息卡

## 职责
归档网址信息 · 后续接入网址爬虫

## 入口与路由
- entry：urlarch
- 后端路由：/api/plugin/urlarch

## 数据表
- `urlarch_assets`
- `urlarch_groups`
- `urlarch_links`
- `urlarch_shortcuts`（白名单：本地软件条目，R4 轮使用；本轮只建表）

## 依赖
- provides：无
- consumes：无

## 注意事项
- 组别级收起 / 展开：点某组标题栏或 ▾ 按钮切换该组链接与拦截提示的显隐（▾→▸）；状态仅存页面会话内存，刷新恢复展开；不改后端与表结构。
- 白名单存数据库表 `urlarch_shortcuts`，数据库文件在 `data/` 下不进 Git；round 99 起提供白名单 CRUD 与启动接口（`shortcuts`、`shortcuts/<id>`、`launch`）。
- 只启动白名单内已登记的软件：后端按 id 取路径，前端不能传路径或命令；`subprocess.Popen([path]+args, shell=False)`；拒绝相对路径 / `..` / UNC / 脚本与快捷方式类扩展名（.bat/.lnk/.ps1 等），参数须为 JSON 字符串数组且不含 shell 元字符。
- 快捷键为**页面内快捷键**（仅 urlarch 视图可见且页面聚焦时生效，输入框聚焦不触发，非系统全局热键）；同一组合重复登记拒绝（`HOTKEY_CONFLICT`）。
- 仅本机使用，勿把服务暴露到 `0.0.0.0`；不以“请求来自 localhost”作为安全措施。
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
