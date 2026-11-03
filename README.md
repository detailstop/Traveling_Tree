# 旅行之木

本机运行的旅行之木：俄语单词背诵与可插件化工具均以插件形式加载，宿主只负责 Web 服务、插件发现/分发与共享设置。业务内容数据保存在本机 SQLite，只有 UI 偏好保留在浏览器 localStorage，不需要账号，也不做云同步。

> 根目录的早期整理稿与一次性调试/变更残留已于 2026-10-27 清理，去留与审查记录见 `docs/appendix/file_navigation.json`（`docs/appendix/file_navigation.md` 为只读摘要）；本 README 为当前主说明。

## 1. 快速开始

在项目根目录执行：

```bat
python main.py          :: 启动 127.0.0.1:8765 的本地 Web 界面并尝试打开浏览器
```

Windows 也可双击 `tools\启动旅行之木.cmd`。该脚本用 `%~dp0..` 定位项目根，优先使用 PATH 中的 `pythonw.exe`，没有时回退 `python.exe`；不再写死盘符、用户名或 Conda 环境路径。

首次启动时创建数据库表、执行插件迁移并导入插件种子；数据库文件已存在时不会因为条目被删空而重新播种。若检测到 8765 已有实例，会提示复用；Web 启动失败会直接报错退出，不再回退旧 GUI。

## 1.1 首次使用（新克隆环境）

主仓库只跟踪白名单 5 个插件（`market`/`cobuild`/`webchat`/`tts`/`pixel_art`），其余插件在独立插件库仓库、靠市场安装（规则见白皮书 §十二）：

1. 运行 `python main.py` 启动本地服务；
2. 在 `data/plugins/market/settings.json` 配置 `market_source_url` 为插件库仓库的 raw index 地址（为空时「拉取最新插件」置灰）；
3. 打开左侧栏「插件市场」→「拉取最新插件」，让 `remote_index` 覆盖为插件库清单；
4. 在市场中安装所需插件（安装到 `plugins/<id>/`），已安装项按提示重启服务后生效；
5. 重启后插件卡片出现；`local_index` 只扫描本地 `plugins/*/INFO.md`，新克隆下只有白名单。

注意：非白名单插件目录被 `.gitignore` 排除，`git clean -fdx` 会删除它们；恢复需从插件库重新安装。

## 2. 技术栈与真实依赖

- **语言/运行时**：Python 3；本地 HTTP 服务使用标准库 `ThreadingHTTPServer`；数据库为 SQLite。
- **前端**：原生 HTML/CSS/JavaScript，无前端框架、无构建步骤；工具模块按需加载。
- **基础学习/CLI/GUI**：只依赖 Python 标准库。
- **可选第三方库**（按功能启用，缺失通常只影响对应工具）：
  - `pikepdf`、`Pillow`：PDF 合并/分割/压缩、图片压缩、图片转 PDF；
  - `PyPDF2`：部分 PDF 读取/处理路径；
  - `python-docx`：Word/文档预览相关功能；
  - `edge-tts`：在线神经语音；失败时可走系统 SAPI/RHVoice 回退；
  - `uiautomation`：Windows 桌面 UI 自动化（如豆包 UIA 监听面板）；
  - `Playwright`：网页会话通道/DeepSeek 网页自动化，需要浏览器二进制与登录态；
  - `packaging`：插件市场依赖版本比较（`dependencies.python` 的版本约束）；缺失时降级为只判存在性，不影响插件加载。
- **安装示例**：

```bat
python -m pip install pikepdf Pillow PyPDF2 python-docx edge-tts uiautomation playwright packaging
python -m playwright install chromium
```

不是所有工具都强制需要上述全部依赖；只运行学习核心时不需要它们。后端并**不是“仅标准库”**：上述可选库会在对应工具中实际导入。

### Playwright 浏览器目录

默认使用项目内相对目录 `data/playwright_browsers`。若浏览器二进制装在别处，可在 `data/settings.json` 中覆盖：

```json
{
  "paths": {
    "playwright_browsers": "相对项目根的目录，或绝对目录"
  }
}
```

未配置时按默认相对目录；目录不存在时 `modules/web_chat.py` 会报明确错误，不会静默回退到某个固定盘符。若外部已设置 `PLAYWRIGHT_BROWSERS_PATH` 环境变量，则尊重该变量。

## 3. 入口

| 入口 | 适用场景 | 说明 |
| --- | --- | --- |
| `python main.py` | 日常使用 | 本地 Web UI；默认监听 `127.0.0.1:8765` |

经典 Tkinter GUI 与 CLI 已随俄语学习功能插件化退役：两者原先直接依赖 `core.models` / `core.repository` / `core.planner`，在业务表与学习逻辑下沉到 `plugins/russian/` 后不再维护。`russian` 不是宿主主体/默认必装，仅为可卸载（非预置）功能插件。背景库导入、共建打卡等操作保留在 Web UI；宿主只保留 Web 入口。

## 4. 目录与职责

```text
Traveling_Tree/
├── main.py                  Web 宿主启动、数据库初始化
├── config.py                宿主/插件共享路径与默认设置
├── db/
│   ├── connection.py        线程本地连接；启动时显式 init_db 一次
│   └── schema/              空目录：宿主不再持有任何 DDL
├── modules/                 宿主配置基础设施：settings_store.py（业务已全部下沉/归档）
├── ui/
│   ├── web/server.py        本地 HTTP 静态资源 + 插件分发 + 宿主 API
│   └── web/static/          原生前端；features/*.js 按需加载
├── plugins/                 本地 24 个插件目录（主仓库仅跟踪白名单 5 个：market/cobuild/webchat/tts/pixel_art；其余 19 个进插件库、.gitignore 排除）：21 个有卡片插件（russian/、book_reader/、project_manager/、bg_library/、promptgen/、ai/、aidebug/、market/、expdata/、schedule/、screeps/、urlarch/、netexp/、rivet/、filejudge/、pdf/、model_usage/、pixel_art/、finance/、css_exp/、sim/）+ 3 个 backend-only（webchat/、cobuild/、tts/）；manifest + backend.py，有卡片的另有 feature.js + plugin.css，有表的另有 schema.sql
├── data/                    运行时数据：SQLite、settings、缓存、会话、备份
├── docs/
│   ├── plugin-development-whitepaper.md   开发白皮书（最高准则）
│   ├── 多AI共建日志.md                    多 AI 打卡镜像（自动生成，勿手改）
│   └── appendix/                          白皮书附件：附录 A–D + 三份说明性文件
├── tools/                   生成器与启动脚本（启动旅行之木.cmd 等）
└── tests/                   冒烟测试（多数使用临时数据库）
```

分层约定：`ui/` 通过 `/api/plugin/<id>/*` 动态分发到各插件 backend；宿主不再有 `core/`，全部 SQL 在插件内（model_usage/pixel_art/finance/bg_library/book_reader/russian/project_manager）；`db/schema/` 为空，新增表只写 `plugins/<id>/schema.sql` 并由 manifest 的 `db` 声明，`db/connection.py` 启动时扫描执行；`data/settings.json` 的 `modules.enabled` 控制按模块建表，默认全启用。宿主视图基础设施（左栏 / 主区 / 右栏、上下分屏、聚焦区、右栏快捷按钮）只做布局与偏好：快捷按钮列表存 `data/settings.json` 的 `quickbar`，右栏收缩状态存 localStorage；插件入口 `render(container)` 使用传入容器（上下两区各自独立），宿主不再设置或切换 `#tool-view`。

插件可有/无业务表：无表插件不声明 `db` 或声明 `"db": null`。当前 24 个插件目录中 **15 个有 `schema.sql`、9 个无表**（cobuild、expdata、filejudge、netexp、pdf、rivet、sim、tts、webchat）；`sim` 已回归 `plugins/sim/`。

### 说明性文件分工

三份说明性文件统一放在 `docs/appendix/`，作为白皮书附件，不并入白皮书正文：

| 文件 | 性质 | 使用规则 |
| --- | --- | --- |
| `docs/appendix/file_navigation.json` | 文件去留与审查决策主数据源（pending/decided） | 新增决定只追加；历史语义保留；不改 schema |
| `docs/appendix/file_navigation.md` | 由 JSON 生成的只读摘要 | **严禁手改**；修改 JSON 后运行 `python tools/gen_file_navigation_md.py` |
| `docs/appendix/files_manifest.json` | 文件预览导出的工作区文件清单快照 | 只读参考；不是实时索引，文件变动后需重新导出 |

白皮书附录 A–D 亦在 `docs/appendix/`（`A-backend-only.md`、`B-root-routing.md`、`C-binary-format.md`、`D-conventions.md`）。

### 插件分类

- **口径**：有卡片（`manifest.entries` 非空）= 功能性；无卡片 = 底层下沉；`cobuild` 例外归功能性（无卡片，但用户直接使用打卡入口）。
- **清单**：[plugins/lib.json](plugins/lib.json)（24 条：id / kind / has_ui / called_by / notes，仅作文档索引，宿主与测试不读取）。
- **当前底层下沉**：`webchat`、`tts`；说明见 [lib/webchat.md](docs/appendix/lib/webchat.md)、[lib/tts.md](docs/appendix/lib/tts.md)。
- 分类口径、调用关系与未来物理移动风险见白皮书 [附录 E](docs/plugin-development-whitepaper.md)。

## 5. 主要功能

### 俄语单词背诵

- 知识点字段：类型（日常/术语/句式）、俄语、中文、例句、主题、标签。
- 三区域卡片：句式 / 例句 / 翻译可分别遮盖；支持逐条学习、背诵评级、到期复习。
- SRS：C→B→A→LONG 升降档，默认间隔 C=1、B=3、A=7、LONG=30 天；配额可在今日计划页调整。
- 主题统一池；修改主题类型会同步条目类型，删除主题归入「默认」。
- 批量导入支持 Markdown 表格、管道文本、JSON 数组；先预览再导入，按俄语去重。
- 知识库按周→日→类型→条目树管理；统计含档位/类型分布与按月活动图。
- Web 朗读通过 `/api/plugin/tts/speak` 走 edge-tts 缓存；失败时可回退系统语音。

### 通用工具

以 `ui/web/static/app.js` 的内置 `TOOLS` + `GET /api/plugins/list` 为准。像素动画/Godot 功能已整体下线；模型用量与消费、像素画、记账本与理财量化、AI 工作台、接口调试器、项目管理、俄语书籍阅读、背景库/文件预览、提示词生成器已分别迁为 `plugins/model_usage/`、`plugins/pixel_art/`、`plugins/finance/`、`plugins/ai/`、`plugins/aidebug/`、`plugins/project_manager/`、`plugins/book_reader/`、`plugins/bg_library/`、`plugins/promptgen/`。共享的 `ui/web/static/features/webchat.js` 是唯一内置前端依赖，通过 manifest 的 `shared_features` 在插件 feature 前加载。随机模拟器、实验数据获取、计划表、Screeps Arena、网址归档、网络与互联探索、铆钉点、文件判官、PDF 工具、批量压缩、模型用量与消费、像素画、记账本、理财量化、AI 工作台、接口调试器、项目管理、书籍阅读、背景库/文件预览、提示词生成器均已迁为插件；PDF 工具与批量压缩共用 `plugins/pdf` 的两个 entry。插件入口、backend、建表语句、数据目录与样式统一由各插件 `manifest.json` 声明，主程序按 `entries[].feature` 动态 `import()`、按 `/api/plugin/<id>/*` 动态分发，启动时扫描 `manifest.db` 执行 `plugins/<id>/schema.sql`、按 `data_dirs` 创建 `data/plugins/<id>/`，不再维护 `plugin_routes.py` 式的硬编码路由表（全部 24 个插件目录已升级 manifest v2）。插件卡片可在「所有功能」中禁用（`rt_plugins_disabled` 按插件 id，禁用后该插件所有 entry 一起消失），隐藏仍用工具架子 `hidden`（只影响显示）。当前内置 0 + 21 个有卡片插件（23 个 entry）= 23 张卡片；另有 3 个 backend-only 插件（webchat/cobuild/tts）。v2 插件样式随插件放 `plugins/<id>/plugin.css`（24 个 v2 插件目录已迁移/占位）。插件规范见[白皮书](docs/plugin-development-whitepaper.md)（附录 A–D）；CSS 约定见本节与 [§9 开发约定](#9-开发约定)。

其中：
- **批量压缩**会原位改写/替换所选目录中的原文件；**文件判官**可按确认删除文件。使用前先预览。文件判官的图片/PDF/DOCX 预览分别依赖 Pillow/PyPDF2/python-docx，缺失时返回 `missing_dependency` 提示，不影响插件加载。
- **记账本**数据存于主库 `finance_*` 表（经 `/api/plugin/finance/*`），旧 `rt_fin` 仅保留为只读历史备份；提示词工作流、周计划、网址库、Screeps 工作区已迁入 SQLite，页面通过插件 API 读写；仅 UI 偏好仍存浏览器 localStorage。**理财量化**数据已重置，当前仅保留占位入口，待后续重构。
- **站点统筹**（插件 id `urlarch`；round 103 起显示名由「网址归档」改为「站点统筹」，id / 目录 / 路由 / 表名不变）的组别、网址与启动间隔已迁入 SQLite（`urlarch_*` 表，经 `/api/plugin/urlarch/*`）；组别可折叠、卡片可上传图片（≤2MB，png/jpg/jpeg/webp/gif，落 `data/plugins/urlarch/images/`）、功能性组可点击卡片一键启动组内网址、软件条目可拖拽改组、组名事务内去重；删除条目会清理其图片。
- **CSS 动效组件库**（插件 id `css_exp`，round 113 新增）以 iframe 托管 AWA UI（MIT）静态导出产物（`plugins/css_exp/static/app/`），可把当前详情页的标题/作者/CSS/HTML 收藏到 `css_exp_favorites` 表并在「我的收藏」查看、预览（严格沙箱）与删除；外部项目只读、不重新构建。
- **项目优化与当前综述**提供树形背景库、导入/导出、历史归档与手动变更留痕；其「文件预览与说明卡片」可浏览工作区文件树、标注数据库文件、维护 `file_notes` / `db_rules`，并导出 `docs/appendix/files_manifest.json`。文件预览只写说明元数据，不改源码。

### 宿主视图：右栏快捷按钮与上下分屏

- **右栏**：主区右侧新增窄右栏，分上下两区；上区是分屏开关（按钮组容器留扩展位），下区是「＋ 添加快捷按钮 + 快捷按钮列表」。右栏可收缩为窄边，点击窄边展开；收缩状态存 localStorage（键 `rt_quickrail_collapsed`，只 `setItem`）。
- **快捷按钮**：列表存宿主 `data/settings.json` 的 `quickbar.pinned`（`[{id, order}]`，只存有卡片插件的 entry id 与顺序；backend-only 插件不出现）。加号从 `/api/plugins/list` 的有卡片插件中选择，叉号删除；插件被禁用/删除后按钮置灰并提示，不产生 Traceback，也不自动改写列表。
- **上下分屏**：开启后上区保留当前视图（工具总览或插件），下区为空并提示「点击右栏快捷按钮，把插件加载到当前聚焦区」；上下区高度 50/50 固定，本轮不做拖动分隔条。点击某区**非交互空白处**切换聚焦（按钮/输入框/卡片不抢聚焦），聚焦区有高亮；分屏开启默认上区聚焦。
- **聚焦区加载**：快捷按钮与「所有功能」卡片都把插件加载到当前聚焦区（分屏关闭时即唯一主视图）；同一插件不能同时占用上下区，重复放入会轻提示。关闭分屏时清空下半区 DOM、保留上半区并聚焦回上区。
- **全屏视图**：右栏上区与分屏开关并列新增「全屏」按钮（图标 `⤢`/`⤡` 两态）。进入后工具内容区（单视图主区域，或分屏上下两区整体）以 CSS 覆盖铺满视口（`position: fixed` 覆盖层），左栏/上栏/右栏隐藏；分屏保持 50/50。**ESC 一律退出**（输入框内也退出），非全屏态不监听 ESC；退出恢复进入前的单视图/分屏布局、上下区插件与聚焦区，不改变分屏开关、右栏收缩与快捷按钮。全屏中 hub 仍铺满、卡片仍按聚焦区加载；分屏下半区为空时提示改为「按 ESC 退出全屏后，从右栏快捷按钮加载插件」。全屏状态是内存态，刷新即退出；不用浏览器 Fullscreen API。
- **状态**：分屏开关、上下区所选插件、聚焦区、全屏状态都是内存态，刷新恢复单视图；右栏收缩状态与快捷按钮列表会保留（分别存 localStorage 与 `data/settings.json`）。

## 6. 数据保存与备份

| 内容 | 位置 |
| --- | --- |
| 俄语条目、SRS、复习流水、主题、阅读、项目管理、背景库、文件说明、css_exp 收藏 | `data/russian_tutor.db` |
| 配额、字体、模型价目、下载分组、路径覆盖、右栏快捷按钮（`quickbar.pinned`） | `data/settings.json` |
| API Key / 模型设置 | `data/ai_keys.json`（明文） |
| 语音缓存 | `data/voice_cache/` |
| Web Chat 会话列表 / 登录态 | `data/webchat_sessions.json`、`data/plugins/webchat/webchat_profile/`（round 59 从项目根迁入；备份 `data/` 现在会包含约 14MB profile，round 58 之前口径不同） |
| 文件判官保留标记 | `data/plugins/filejudge/keep.json`（旧 `data/filejudge_keep.json` 只读保留） |
| 基金缓存等 | `data/` 下对应 JSON/缓存 |
| 铆钉点打卡数据 | `data/plugins/rivet/rivet.json`（旧 `data/rivet.json` 只读保留） |
| 前端 UI 偏好 | 浏览器 localStorage（主题 `rt_theme`、左右侧栏折叠 `rt_sidebar_collapsed` / `rt_quickrail_collapsed`、工具架子等纯 UI 偏好）；内容资产在 SQLite |

首次启动：若 `data/` 不存在，`config.py` 自动创建；`db/connection.py` 的 `init_db()` 扫描 `plugins/*/manifest.json` 的 `db` 声明，执行 `schema.sql` 建表、`seed.py` 播种、`migrate.py` 迁移；`manifest.data_dirs` 声明的目录自动创建。克隆本项目后直接 `python main.py` 即可，无需手动建库。`data/` 不进 Git（见 `.gitignore`），备份需单独保存。

市场分发：**GitHub Release 为唯一分发源**；`market/packages/` 仅保留空目录，不再作为默认产物（原 18 个本地 zip 已清空，脚本保留备用、勿随意运行）。非白名单插件不在主仓库，靠 `remote_index` 展示与 Release 安装；新克隆环境 `local_index` 只有白名单 5 个，其余需先拉取 remote。远程 index（`data/plugins/market/remote_index.json`）的 `download_url` 指向 Release；安装时下载到 `downloads/`，校验后删 zip。

插件市场双索引：`remote_index.json`（拉取覆盖，公共库包字段）+ `local_index.json`（扫描 `plugins/*/INFO.md` 组装）；展示合并优先级 INFO > remote > local；`downloads/` 存放下载 zip。三类：预置 5（不可卸载）、公共库 2（finance/promptgen，可从 Release 安装）、本地开发 17（无安装/卸载按钮）。注：`data/plugins/market/local_index.json` 本轮只读实测落盘 **21 条**（生成于 `css_exp` 之前，未复核），展示数以市场 API 实际返回为准。

插件市场运行态：`data/plugins/market/remote_index.json`（覆盖式，拉取写入）+ `local_index.json`（扫描 INFO 组装；首次请求生成；旧单文件已迁移删除）。远程源配置在 `data/plugins/market/settings.json` 的 `market_source_url`（https raw index；为空时「拉取最新插件」置灰）；拉取成功只覆盖 remote，失败不动本地。

设置页「通用下载地址（本地路径）」对应 `data/settings.json` 的 `download_dir`（绝对路径）；供市场「开发插件」等后端写盘使用。未设置、路径不是绝对路径或目录不存在/不可写时，后端明确报错，不自动创建目录、不静默回退；浏览器下载句柄与该项相互独立，原有下载分组不受影响。

备份应保存 `data/`（尤其 SQLite、settings、ai_keys、webchat_sessions、`data/plugins/`、各工具 JSON）以及浏览器 localStorage。`归档/` 与 `data/backup/` 为 round 制历史快照，已于 round 59 整体移出项目；如需恢复历史版本，从项目外归档目录取回，勿放回项目根或 `data/backup/`（会被 file_preview 与未来 .gitignore 排除）。

## 7. 风险提示（重要）

本项目定位为**单机、本地、可信环境**工具，不是公网服务：

1. **无鉴权**：所有 `/api/*` 接口没有账号/Token 校验；只应监听 `127.0.0.1`，不要改成 `0.0.0.0` 或暴露到公网/局域网。
2. **无速率限制、无请求体上限**：本机其他程序可调用接口；异常大请求可能占用内存/磁盘。
3. **任意本地路径**：批量压缩、文件判官、PDF/文件工具、文件预览等接受本地路径；不要在不可信目录或共享目录上运行破坏性操作。
4. **会改写/删除原文件**：批量压缩原位替换；文件判官确认删除；PDF 工具可能写输出文件。使用前备份。
5. **明文密钥**：`data/ai_keys.json` 保存 API Key；不要提交到版本库、不要共享整个 `data/` 目录。
6. **浏览器登录态**：网页会话使用 `data/plugins/webchat/webchat_profile/`（round 59 从项目根迁入），包含登录 Cookie；按敏感数据处理。
7. **网络与第三方依赖**：在线语音、AI、基金、网页会话、网页抓取需要网络或第三方库；页面改版/限流会导致失败。不要把失败静默当作成功。
8. **数据只在本机**：没有云同步、自动备份、迁移保障；清理浏览器数据或 `data/` 可能永久丢失工具状态。
9. **文件预览是只读元数据**：它会递归扫描工作区（排除 `.git`、`__pycache__`、缓存/备份等）；不要把秘密文件放进工作区后指望它自动隐藏。数据库规则/文件说明为人工维护，可能过时。
10. **克隆后登录态为空**：`webchat_profile` 已被 `.gitignore` 排除，克隆项目后网页会话通道需重新扫码登录；`data/` 下其他文件（DB、keys、settings）同样不随 Git 同步。
11. **css_exp 为同源弱沙箱**：`plugins/css_exp` 的 iframe 使用 `allow-scripts allow-same-origin`（抓取详情页 DOM 所需），**不是严格隔离**；外部 AWA UI 为已审阅的 MIT 开源代码，若替换外部项目须重新审阅。收藏按钮依赖外部详情页 DOM（`pre.language-css` / `pre.language-html`、`article [class*="content__title"]`）与 `{type}/{slug}` 路由，外部升级可能导致抓取失败（会提示并拒绝写入空数据）。
12. **`.gitignore` 例外需复核后再 push**：`.gitignore` 为 css_exp 的 `_next/data/` 加了精确例外（`!plugins/css_exp/static/app/_next/data/`），push 前应确认 `data/`、`data/ai_keys.json`、`data/webchat_sessions.json`、`data/plugins/webchat/webchat_profile/` 仍被忽略，且例外未放宽为 `!data/` 等宽规则。
13. **分屏/右栏是宿主视图基础设施**：只做布局与偏好（上下分屏、聚焦区、右栏快捷按钮），不含业务逻辑；快捷按钮列表是宿主偏好（`data/settings.json` 的 `quickbar`），不是插件业务数据。插件前端入口统一为 `render(container)`：宿主给上下两区各传独立容器，插件必须使用传入容器（`container.querySelector` 等），**禁止直接取 `#tool-view`**；`smoke_plugins` 会静态检查并阻断回归。因此后台插件异步重绘只影响自己所在区，不会再覆盖另一区；**已知边界**：插件入口把传入容器缓存为模块级 `ROOT`，关闭该区后重开同一插件时，若旧回调尚未返回，可能渲染到新容器（仍是同一插件，数据不丢；重开或刷新即可）。若某插件漏迁，`smoke_plugins` 直接 FAIL 并列出插件 id:行号。
14. **全屏为 CSS 覆盖而非浏览器真全屏**：全屏只覆盖工具内容区（`position: fixed` 覆盖层）并隐藏左栏/上栏/右栏，不调用 Fullscreen API、不改变系统窗口；ESC 由宿主监听退出（全屏态在 `capture` 阶段监听并 `stopPropagation`、非全屏态不绑定），输入框内 ESC 也会退出。全屏状态不持久化、刷新即退出，不影响分屏开关/上下区插件/聚焦区/快捷按钮列表；因此插件自身的 ESC 语义（如关闭弹窗）在全屏时会被宿主优先拦截用于退出全屏，退出全屏后插件 ESC 恢复正常。
15. **非白名单插件目录被 `.gitignore` 排除**：它们只存在于本地或插件库仓库；`git clean -fdx`、换机克隆等会删除/缺失，恢复需从插件库重新安装。主仓库提交前确认 `git status` 不包含非白名单插件；白名单调整须同步 `plugins/lib.json` 与 `.gitignore`。

## 8. 多 AI 共建与打卡

本项目由多个 AI 轮流接手。每次改动前先读首页「🤝 关于多 AI 共建的声明」
和 `docs/多AI共建日志.md` 最近记录；改完必须打卡（首页按钮，或直接调用
cobuild 插件）。

`main.py` 的 CLI 子命令已随 GUI/CLI 退役，打卡改为：

```python
from plugins.cobuild import cobuild
result = cobuild.checkin(
    agent="AI 名称",
    action="改了什么",
    files="涉及文件，逗号分隔",  # 也可传 list[str]
    note="下一步 / 已知问题 / 未完成项",
    kind="fix",  # feature / fix / refactor / ui / docs / data / handoff / other
)
```

完整签名、返回值结构与 `kind` 取值见 `plugins/cobuild/cobuild.py::checkin`。
数据源为 `data/ai_cobuild.json`，镜像为 `docs/多AI共建日志.md`；不要手改镜像表格。

规则：先读后写、改动必留痕、如实写清影响与风险、不覆盖他人成果、
只追加/作废不删除、留下接手指南。

## 9. 开发约定

- 开发新插件先读[插件开发守则](docs/plugin-development-guide.md)（7 节动线，规则引用白皮书）；AI 提示词模板见 [plugin-dev-prompt.md](docs/appendix/prompts/plugin-dev-prompt.md)，在市场页「开发插件」按字段生成并写盘；市场数据库草案见 [plugin-market-schema-draft.md](docs/appendix/plugin-market-schema-draft.md)（未建表）。
- 不引入 Web 框架；接口保持本地 JSON；前端不引入框架/构建步骤。
- SQL 分层：全部 SQL 在插件内（`plugins/russian/repo.py`、`plugins/project_manager/pm_repository.py`、`plugins/book_reader/book_reader.py`、`plugins/bg_library/`、`plugins/model_usage/repo.py`、`plugins/pixel_art/repo.py`、`plugins/finance/repo.py`）；宿主 `db/schema/` 为空，新增表只写 `plugins/<id>/schema.sql`，由 manifest 的 `db` 声明，`db/connection.py` 启动时扫描执行；`data/settings.json` 的 `modules.enabled.<module_key>` 可关闭对应建表（默认全启用）。
- 新增工具：在 `ui/web/static/features/` 放按需模块，通过 `window.__toolRenderers` 注册；入口/架子在 `app.js`。
- 新增插件：在 `plugins/<id>/` 放 `manifest.json` + `feature.js`，feature 末尾写 `window.__toolRenderers.<id> = render`；清单由 `GET /api/plugins/list` 扫描并合并，无需改 `app.js` 的 `TOOLS`。新增/改名后运行 `python tests/smoke_plugins.py`。
- 多入口插件：`manifest.json` 的 `entries` 数组配置 `{id,name,icon,shelf,feature,desc?}`；每个 entry 生成一张卡片并加载自己的 feature，禁用仍按插件 id。`/api/plugins/list` 统一返回 `plugins[].entries[]`。
- 共享主程序前端模块：`manifest.json` 声明 `"shared_features": ["webchat"]`；`app.js` 会先从主程序 `features/` 加载这些经典脚本，再 `import()` 插件 feature。当前 `ai` / `aidebug` 共享 `webchat.js`，该文件仍留在主程序。
- 插件依赖声明：`manifest.dependencies` **只保留 `python` 子键**（第三方 PyPI 包；可写字符串或 `{name, version}` 约束），只声明不安装；`python` 之外的历史子键（`plugins`/`plugin`/`shared`/`js`）均不再采用。跨插件关系只用既有 `provides`（能力名，能力描述、不参与依赖检查）与 `consumes`（插件 id，只表直接调用；宿主中介不算）；语义见白皮书 §二。`packaging` 缺失时市场依赖检测降级为只判存在性，不阻断加载。
- 插件后端（可选）：`manifest.json` 声明 `"backend": "backend.py"`，在 `backend.py` 暴露 `handle(method, subpath, query, body)`；只通过 `/api/plugin/<id>/*` 调用，源码不会经 `/plugins/*` 静态暴露。插件私有数据放 `data/plugins/<id>/`。返回二进制时用 `{"__binary__": true, "body": bytes, "mime": "...", "filename": "...", "headers": {...}}`。
- 宿主视图基础设施（round 115/118）：布局/分屏/全屏/聚焦/右栏属宿主职责，业务内容仍不得进宿主；右栏快捷按钮列表存 `data/settings.json` 的 `quickbar.pinned`（经 `modules/settings_store.py` 浅合并写入，只存有卡片插件 entry id 与顺序），右栏收缩状态存 localStorage（`rt_quickrail_collapsed`，只 `setItem`）；分屏开关、上下区所选插件、聚焦区不持久化；新增 `/api/settings/quickbar`（GET/POST）只做设置读写，不写业务 SQL。全屏实现固定为「CSS 覆盖类 + 宿主 ESC 监听」：给工具内容区加 `.app.fullscreen` 覆盖层、隐藏三栏，ESC 仅在进入时注册 `keydown`（capture）、退出即解绑，禁止调用 `requestFullscreen`/`exitFullscreen`；全屏状态存内存（不写 localStorage/settings）。
- 插件建表（可选）：`manifest.json` 声明 `"db": {"module_key": "model_usage", "schema": "schema.sql", "migrate": "migrate.py"}`；schema 在 `plugins/<id>/schema.sql`，migrate 暴露 `migrate(conn)`；`modules.enabled.<module_key>=false` 时两者都跳过。无表插件写 `"db": null`。
- 插件数据目录（可选）：`manifest.json` 声明 `"data_dirs": ["rivet"]`；主程序启动时创建 `data/plugins/rivet/`，后端用 `config.plugin_data_dir()` 读写，不再自行拼接绝对路径。
- finance 的 rt_fin 一次性迁移逻辑在 `plugins/finance/migrate_localstorage.py`；旧 `tools/migrate_finance_localstorage.py` 兼容入口已删除。
- 插件 CSS：v2 插件写入 `plugins/<id>/plugin.css` 并在 manifest 中声明 `"style": "plugin.css"`；共享 `.fin-note`（sim/filejudge/finance）、`.rv-card`（screeps/rivet）、`.pi-check`/`.pi-badge` 留在 `app.css`。规则见[白皮书](docs/plugin-development-whitepaper.md)与本节约定。
- 新增 Web API：在 `ui/web/server.py` 按现有路由方式接入；不要绕过 repository 写 SQL。
- 文件路径一律相对项目根（`config.BASE_DIR`）；需要外部路径时放 `data/settings.json` 的 `paths.<名称>`，缺失时明确报错，不静默回退。
- 修改数据库结构：插件表同步 `plugins/<id>/schema.sql` 与插件 migration；`db/schema/` 不再放任何表；不要改 `bg_nodes` / `bg_versions` 的结构字段与 id/path/node_type/version_tag 规则。
- 新增可持久化前端内容时，优先写 SQLite 插件表并保留 `raw_json` 兜底；只有纯 UI 偏好才使用 localStorage。
- `docs/` 目录只允许长期存放三类内容：白皮书、`多AI共建日志.md`（自动镜像）、`appendix/` 附件；其他说明性/一次性材料一律视为临时文件。
- docs 临时文件必须走闭环：**提出 → 确定 → 并入主文件 → 删除**。未闭环视为违规，下次接手的 AI 优先处理或先询问用户；未闭环项登记到 `docs/appendix/file_navigation.json` 的 `pending[]`，处理完并入主文件并删除临时文件后移入 `decided[]`。

## 10. 验证

```bat
python tests/smoke_web.py
python tests/smoke_startup_once.py
python tests/smoke_plugins.py
python tests/smoke_file_preview.py
python tests/smoke_model_usage.py
python tests/smoke_reader_range.py
python tests/smoke_books.py
python tests/smoke_pm.py
```

基线以本地实际插件目录数为准：白名单环境参考 5 个插件，完整开发环境参考 24 个；`smoke_plugins`/`smoke_plugin_decoupling`/`smoke_info_cards`/`smoke_market` 的插件数/INFO 数运行时扫描，不写死。`smoke_web.py` 会启动临时数据库并调用本地 HTTP 服务；若运行 `/api/tts` 需要网络，可能因环境网络失败。其余测试多数使用临时目录，不碰真实数据。`smoke_plugins.py` 校验插件清单/静态资源/扫描容错/CSS 阈值；存在 `node` 时会额外做 ESM 语法检查，无 `node` 自动跳过。

## 11. 文档

- [旅行之木 · 微内核架构与插件开发白皮书 (v2.0)](docs/plugin-development-whitepaper.md)
- [插件开发守则](docs/plugin-development-guide.md) · [AI 提示词模板](docs/appendix/prompts/plugin-dev-prompt.md) · [插件市场草案](docs/appendix/plugin-market-schema-draft.md)
- 白皮书附录：[A backend-only](docs/appendix/A-backend-only.md) · [B 根路由](docs/appendix/B-root-routing.md) · [C 二进制格式](docs/appendix/C-binary-format.md) · [D 其他约定](docs/appendix/D-conventions.md)
- 说明性文件：[file_navigation.json](docs/appendix/file_navigation.json) · [file_navigation.md](docs/appendix/file_navigation.md) · [files_manifest.json](docs/appendix/files_manifest.json)

## 12. 项目状态与交接（2026-11-03，round 119 后）

- **round 119 主仓库白名单**：`.gitignore` 逐目录排除 19 个非白名单插件（白名单 5 个：market/cobuild/webchat/tts/pixel_art），`plugins/lib.json` 每条加 `in_main_repo`；4 个 smoke 改为按实际插件数动态断言（本地 24 全绿；模拟新克隆 5 个：smoke_plugins 86/86、decoupling 49/49、info_cards 11/11、market 37/37）；白皮书新增 §十二。`_migration/css_exp` 已核实完整（文件数/大小/结构一致，无未归并独有文件），**待用户确认后删除**。
- **round 118 全屏视图**：右栏上区新增全屏按钮（`⤢`/`⤡` 两态）；工具内容区 CSS 覆盖铺满视口、三栏隐藏、分屏保持 50/50；ESC 全屏态一律退出（含输入框），非全屏不绑定；退出恢复原布局/插件/聚焦，状态存内存、刷新退出；空区提示按全屏态切换。未改插件、未改 settings 结构、未建表。全量 15 项 smoke 仍为 **1045/1046**（仅 TTS 502）。
- **round 117 渲染契约**：宿主分屏改为两区独立容器，不再设置/切换 `#tool-view`；20 个插件入口统一 `render(container)` 并使用传入容器（`filejudge`/`finance` 的异步回调、`model_usage` 的作用域查询一并迁移）；`smoke_plugins` 新增静态检查，直接引用 `#tool-view` 即 FAIL。全量 15 项 smoke **1045/1046**（仅 TTS 502）。
- **round 115 宿主视图**：新增可收缩右栏快捷按钮与上下分屏（`ui/web/static/index.html`、`app.js`、`app.css`、`modules/settings_store.py`、`ui/web/server.py` 的 `/api/settings/quickbar`）。快捷按钮列表存 `data/settings.json` 的 `quickbar.pinned`（宿主偏好，非业务数据）；右栏收缩存 localStorage；分屏开关、上下区插件、聚焦区为内存态，刷新回单视图。未改任何插件代码、未建表、未向 `plugins/` 写运行时数据。已知限制见 §7 第 13 条。
- **插件**：24 个插件目录——21 个有前端卡片（ai、aidebug、bg_library、book_reader、css_exp、expdata、filejudge、finance、market、model_usage、netexp、pdf、pixel_art、project_manager、promptgen、rivet、russian、schedule、screeps、sim、urlarch）+ 3 个 backend-only（webchat、cobuild、tts）；23 个 entry。
- **插件市场（round 91）**：左侧栏「插件市场」；双索引 remote（覆盖）+ local（INFO 组装），展示四源合并 INFO > remote > local；三类：预置 5、公共库 2（finance/promptgen，Release 安装）、本地开发 17（无按钮）。**Release 为唯一分发源**，`market/packages/` 为空目录；安装下载到 `downloads/`，卸载默认保留 `data/plugins/<id>/`。
- **15 项 smoke 基线**：round 117 全量复跑 **1045/1046**（唯一 FAIL：`smoke_web` 的 TTS 502 外部网络问题）；`validate` 24/24 插件 `ok: true`。分项：smoke_plugins 190/190、smoke_startup_once 34/34、smoke_web 74/75、smoke_plugin_decoupling 500/500、smoke_finance 34/34、smoke_model_usage 49/49、smoke_reader_range 25/25、smoke_pm 23/23、smoke_books 11/11、smoke_file_preview 17/17、smoke_pdf 17/17、smoke_plugin_data_dirs 13/13、smoke_plugin_module_off 10/10、smoke_market 37/37、smoke_info_cards 11/11。
- **Git**：`main` 领先 `origin/main`（round 115 提交后 21 个），**未 push**（push 前需用户确认，并复核 `.gitignore` 例外）。
- **剩余待办**：以交接文档三项必做为上（本轮未改其内容）；css_exp 后续（跨插件读取收藏接口、创建器、外链图片本地化）留待后续轮。
- **剩余 pending**：无（`Server.start` 已在 round 80 修复并连续 20 次通过）。
- **交接建议**：新功能进 `plugins/<id>/`，不碰宿主；改现有功能直接改对应插件；每轮下沉、改 settings 或改 API 后跑全量 15 个 smoke；`/api/plugin/<id>/*` 必须用语义子路径；二进制响应按附录 C。
- 完整状态、数据资产与 docs 闭环规则见白皮书 [§7 项目状态与交接](docs/plugin-development-whitepaper.md) 与 [§8 docs 目录与临时文件闭环](docs/plugin-development-whitepaper.md)。
- **schema 合规（round 79）**：round 75–78 完成 22 插件表结构收口——67 张表全部合规（9 张豁免 live 且有注释），61 个触发器；矩阵见 [plugin-schema-compliance-matrix.md](docs/appendix/plugin-schema-compliance-matrix.md)。
- **round 80 收口**：`Server.start` 已修复（健康检查捕获 `BadStatusLine`/`HTTPException`，`stop()` 包裹进程退出竞态），连续 20 次 452/452 通过；**pending 清零**。触发器维护约定见守则 §4.2，无表插件说明见 §4。
- **验收完成（round 81）**：项目验收通过——schema 合规 67/67、测试稳定、pending 清零、备份齐全；验收报告见 [project-acceptance-round80.md](docs/appendix/project-acceptance-round80.md)，合规矩阵见 [plugin-schema-compliance-matrix.md](docs/appendix/plugin-schema-compliance-matrix.md)。
- **round 65 删除核对**：v2.1 草案四项（backend-only / 根路由 / `__binary__` / import 约定）已分别落在 `docs/appendix/A–D`；结项报告的 22 插件清单、13 smoke 基线、剩余 pending、交接建议已落在白皮书 §7.1–7.4。核对表见白皮书 §7.6；两份源文档未恢复。

### 本轮文档同步与核查记录（round 114）

- **`.gitignore`**：例外规则精确指向 `plugins/css_exp/static/app/_next/data/`（第 39–40 行），未使用 `!data/`、`!**/data/` 等宽规则；`data/`（第 2 行）仍忽略 `russian_tutor.db`、`ai_keys.json`、`webchat_sessions.json`、`webchat_profile/`；目标 JSON 未被忽略，`git ls-files` 计 **175** 个（与 round 113 交接记录一致）。
- **css_exp 抓取 URL 解析**：`feature.js::parseLocation` 改为 `new URL(...).pathname` 解析，兼容 `index.html` 后缀、带/不带 trailingSlash、静态路由前缀（旧 `/api/plugin/css_exp/app/...` 前缀仍兼容）；分类页/根路径/`_next/...` 内部路径不再误判为详情页。
- **文档同步**：README（技术栈依赖、目录/分类计数、功能、数据保存、风险、开发约定、§12 状态）、白皮书 §7 与附录 E、`plugins/lib.json` 口径与 manifest 扫描结果对齐（24 目录 / 21 有卡片 / 3 backend-only / 23 entry / 15 有表 / 9 无表 / 24 份 INFO / lib.json 24 条）。
- **未 push、未重启宿主**；css_exp 端到端走查须在重启后人工复验。

### 市场 UI 手动点测清单

1. **左侧栏入口**：打开首页，确认「插件市场」与「旅行之木」首页标识同级显示；移除 `plugins/market/` 后入口消失且服务无 Traceback（名称/图标来自 manifest，非宿主硬编码）。
2. **搜索**：输入 `sim`、`随机`、`market`，卡片列表按名称/简介/id 过滤；清空恢复全部。
3. **按 kind 过滤**：切换下拉（functional/library），列表仅保留对应分类；计数 `x / y` 同步。
4. **展开详情**：点击卡片标题，显示简介全文、版本、包大小、SHA256 前 8 位、来源；再次点击收起。
5. **预置不可卸载**：market/cobuild/webchat/tts/pixel_art 显示「预置 / 内置，不可卸载」，无卸载按钮。
6. **安装**：未安装的 `sim` 点击安装 → 提示「安装完成，重启服务后生效」；`plugins/sim/` 出现，列表状态变「已安装」。
7. **卸载二次确认**：已安装的 `sim` 点击卸载 → 浏览器确认框；取消不生效，确认后移出 `plugins/sim/` 并提示重启。
8. **删私有目录备份提示**：卸载详情勾选「同时删除私有数据目录」→ 出现二次确认；确认后 `data/plugins/<id>/` 备份到 `data/backup/uninstall_<id>_<ts>/` 再删除；默认不勾选。
9. **重启生效**：安装/卸载后重启服务，插件清单/卡片与市场状态一致；`sim` 可重装。
