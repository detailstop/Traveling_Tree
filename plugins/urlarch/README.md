# 网址归档（urlarch）

## 职责
网址归档：分组、链接与打开间隔；每个组别可在标题栏做组别级收起 / 展开（round 95）。

## 入口与路由
- 分类：functional（有卡片）
- 入口：entry `urlarch` → `feature.js`
- 后端：`backend.py`；路由前缀 `/api/plugin/urlarch/*`，子路径见 `backend.py::handle`

## 数据表
- `urlarch_assets`
- `urlarch_groups`
- `urlarch_links`
- `urlarch_shortcuts`（白名单，round 98 新增）：`id`（后端生成的主键）、`name`、`path`（绝对路径，敏感）、`args`（JSON 数组字符串，默认 `[]`）、`hotkey`、`raw_json`、`live_json`、`created_at`、`updated_at`；索引 `idx_urlarch_shortcuts_hotkey(hotkey)`。属内容表，不豁免 `live_json`；不建触发器，由 SQL 层显式双写（与本插件其余三表一致）。

- raw/live 状态：全部表含 `raw_json` + `live_json`（round 72 补齐；round 73 核实写入路径同时写 `live_json`；round 98 新增白名单表同口径）

## 依赖
- 无跨插件依赖

## 注意事项
- round 72 已补 `live_json` 并加幂等 migrate。
- round 95 组别级收起 / 展开：折叠单位是组别（`.ua-group`），不是单个卡片；点某组标题栏空白处或该组左侧 ▾ 按钮即切换该组，▾ 旋转为 ▸ 表示已收起。
- 收起后该组 `.ua-items`（链接行）与 `.ua-blocked`（拦截提示）隐藏，标题栏仍保留组名、类型、条数、一键启动与重命名 / 删除按钮；展开后恢复。
- 收起状态下该组不接收拖拽放置，展开后恢复可用；其余组不受影响。
- 折叠状态只存页面会话内存（`feature.js` 内的 Set，按组别 id 记录），刷新页面恢复默认展开；不写 localStorage、不落库、不改后端与表结构；只切 class 不重绘列表，不影响输入框焦点与既有拖拽逻辑。
- round 98 白名单表（R3 前置）：`urlarch_shortcuts` 存用户登记的本地软件条目（名称 / 绝对路径 / 参数 / 快捷键），供 R4 轮“白名单注册制”启动能力使用；本轮只建表与迁移，**没有任何读写接口、启动逻辑或前端改动**。
- 数据落在本机 SQLite（`data/` 下），不进 Git、不写成 `data/` 下的 JSON 配置、不放在 `plugins/` 目录；白名单属用户登记数据，不可重建，故保留 `raw_json`+`live_json` 双列。
- 迁移：`manifest.db.migrate` → `migrate.py`；缺表时建表、缺列时补列、缺 `raw`/`live` 时按行回填，全部加性语句，连跑两次无变更（旧库三表数据不变）。
