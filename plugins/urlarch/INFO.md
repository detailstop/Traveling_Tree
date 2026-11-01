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
tables: [urlarch_assets, urlarch_groups, urlarch_links, urlarch_shortcuts, urlarch_shortcut_groups]
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
- `urlarch_shortcuts`（白名单：本地软件条目；round 101 加 `group_id`）
- `urlarch_shortcut_groups`（软件入口组别，round 101 新增）

## 依赖
- provides：无
- consumes：无

## 注意事项
- 组别级收起 / 展开：点某组标题栏或 ▾ 按钮切换该组链接与拦截提示的显隐（▾→▸）；状态仅存页面会话内存，刷新恢复展开；不改后端与表结构。
- 白名单存数据库表 `urlarch_shortcuts`，组别存 `urlarch_shortcut_groups`，数据库文件在 `data/` 下不进 Git；接口为 `shortcuts`、`shortcuts/<id>`、`shortcut-groups`、`shortcut-groups/<id>`、`launch`。
- 软件快捷入口按组列表展示（名称 + 完整路径），点击列表行 → `POST /launch`（只传 id）启动；组可收缩/展开（状态仅存内存，刷新恢复展开）；**不是键盘热键、不是系统桌面快捷方式**，不创建 `.lnk`、不写桌面/开始菜单。
- 组名唯一：新建/改名同名返回 `GROUP_NAME_CONFLICT`(409)；组用按钮上移/下移调序（持久化），条目可拖拽到其他组（只改 `group_id`，不触发启动）。
- 只启动白名单内已登记的软件：后端按 id 取路径，前端不能传路径或命令；`subprocess.Popen([path]+args, shell=False)`；拒绝相对路径 / `..` / UNC / 脚本与快捷方式类扩展名（.bat/.lnk/.ps1 等）。
- 参数输入已移除：新增条目不再填参数，后端默认 `args='[]'`；`args` 列保留，API 对显式传入仍按 JSON 字符串数组校验。
- 删除组时组内软件移到「未分组」，条目不删；`hotkey` 为历史字段，可选、不参与逻辑。
- 仅本机使用，勿把服务暴露到 `0.0.0.0`；不以“请求来自 localhost”作为安全措施。
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
