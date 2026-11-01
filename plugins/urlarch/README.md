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

- raw/live 状态：全部表含 `raw_json` + `live_json`（round 72 补齐；round 73 核实写入路径同时写 `live_json`）

## 依赖
- 无跨插件依赖

## 注意事项
- round 72 已补 `live_json` 并加幂等 migrate。
- round 95 组别级收起 / 展开：折叠单位是组别（`.ua-group`），不是单个卡片；点某组标题栏空白处或该组左侧 ▾ 按钮即切换该组，▾ 旋转为 ▸ 表示已收起。
- 收起后该组 `.ua-items`（链接行）与 `.ua-blocked`（拦截提示）隐藏，标题栏仍保留组名、类型、条数、一键启动与重命名 / 删除按钮；展开后恢复。
- 收起状态下该组不接收拖拽放置，展开后恢复可用；其余组不受影响。
- 折叠状态只存页面会话内存（`feature.js` 内的 Set，按组别 id 记录），刷新页面恢复默认展开；不写 localStorage、不落库、不改后端与表结构；只切 class 不重绘列表，不影响输入框焦点与既有拖拽逻辑。
