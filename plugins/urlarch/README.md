# 网址归档（urlarch）

## 职责
网址归档：分组、链接与打开间隔；每个组别可在标题栏做组别级收起 / 展开（round 95）；软件快捷入口——白名单条目以卡片展示，点击即启动本机软件（round 100 方向修正：不是键盘热键）。

## 入口与路由
- 分类：functional（有卡片）
- 入口：entry `urlarch` → `feature.js`；样式 `plugin.css`
- 后端：`backend.py`（安全校验在 `security.py`，SQL 在 `repo.py`），路由前缀 `/api/plugin/urlarch/*`
- 子路径：
  - `state`（GET 读 / PUT、POST 写网址库）
  - `shortcuts`（GET 列表 / POST 登记，入口自 `urlarch_shortcuts`）
  - `shortcuts/<id>`（DELETE 只删登记，不卸载软件）
  - `launch`（POST，请求体只接受 `{"id": "<白名单id>"}`）

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
- round 98 白名单表（R3 前置）：`urlarch_shortcuts` 存用户登记的本地软件条目（名称 / 绝对路径 / 可选参数；`hotkey` 列为历史遗留字段），供 R4 轮“白名单注册制”启动能力使用。
- 数据落在本机 SQLite（`data/` 下），不进 Git、不写成 `data/` 下的 JSON 配置、不放在 `plugins/` 目录；白名单属用户登记数据，不可重建，故保留 `raw_json`+`live_json` 双列。
- 迁移：`manifest.db.migrate` → `migrate.py`；缺表时建表、缺列时补列、缺 `raw`/`live` 时按行回填，全部加性语句，连跑两次无变更（旧库三表数据不变）。
- round 99/100 R4 启动能力（**白名单注册制 + 点击快捷入口**）：只启动 `urlarch_shortcuts` 内已登记的软件。页面内「🚀 软件快捷入口」把每条白名单渲染成卡片（首字图标 + 名称 + 路径 + 参数摘要），点击卡片 → `POST /launch`，入参只有 `{"id": ...}`；删除按钮只删登记、不卸载软件。这是页面内入口，**不是键盘热键、不是系统桌面快捷方式**，不注册任何 keydown 监听、不创建 `.lnk`、不写桌面/开始菜单。
- 启动请求只接受白名单 `id`：`path`/`args` 一律由后端按 id 查表得到；请求体里出现的 `path`、`args`、`cmd` 等字段一律忽略。启动用 `subprocess.Popen([path] + args, shell=False)`，不拼命令字符串、不经 shell、不等待进程结束。
- 路径校验：必须绝对路径 + 真实存在的普通文件，拒绝 `..`、UNC 网络路径与控制字符；扩展名黑名单显式拦截脚本/快捷方式/安装包类（`.bat`、`.cmd`、`.lnk`、`.ps1`、`.vbs`、`.js`、`.wsf`、`.msi`、`.scr`、`.com`、`.reg`、`.py`、`.sh` 等，返回 `PATH_EXT_BLOCKED`）。**不使用“任意路径 + 扩展名白名单”**。
- 参数校验：`args` 必须是 JSON 字符串数组，≤20 项、单项 ≤200 字符、总长 ≤1000；含 `;`、`&&`、`||`、`|`、`>`、`<`、反引号、`$(`、换行等 shell 元字符一律拒绝（`ARGS_INVALID`）。
- `hotkey` 列（R3 建表遗留）：本轮起**可选且不参与任何逻辑**——不校验组合格式、不检查冲突、可为空；仅为兼容旧数据保留，快捷入口一律靠点击触发。同一 `path` **允许重复登记**（同一程序可挂不同参数或不同入口名），不设 `PATH_DUPLICATE`。
- 稳定错误码：`SHORTCUT_NOT_FOUND`(404)、`PATH_INVALID`、`PATH_EXT_BLOCKED`、`ARGS_INVALID`、`NAME_INVALID`、`HOTKEY_INVALID`(400，仅 hotkey 类型/长度/控制字符的基础清洗)、`LAUNCH_FAILED`(500)、`METHOD_NOT_ALLOWED`(405)、`INTERNAL_ERROR`(500)；失败不启动、不静默、不向宿主抛 Traceback。
- 安全边界：宿主只监听 `127.0.0.1`，但**不要**把服务暴露到 `0.0.0.0`；本接口不做“请求来自 localhost”的可信假设，安全完全依赖白名单注册制 + 参数校验 + `shell=False`。白名单只在本机 `data/` 库内，不进 Git。
