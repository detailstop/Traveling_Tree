# 旅行之木

本机运行的旅行之木：学习核心与可插件化工具均以插件形式加载，宿主只负责 Web 服务、插件发现/分发与共享设置。业务内容数据保存在本机 SQLite，只有 UI 偏好保留在浏览器 localStorage，不需要账号，也不做云同步。

> 根目录的早期整理稿与一次性调试/变更残留已于 2026-10-27 清理，去留与审查记录见 `docs/appendix/file_navigation.json`（`docs/appendix/file_navigation.md` 为只读摘要）；本 README 为当前主说明。

## 1. 快速开始

在项目根目录执行：

```bat
python main.py          :: 启动 127.0.0.1:8765 的本地 Web 界面并尝试打开浏览器
```

Windows 也可双击 `tools\启动旅行之木.cmd`。该脚本用 `%~dp0..` 定位项目根，优先使用 PATH 中的 `pythonw.exe`，没有时回退 `python.exe`；不再写死盘符、用户名或 Conda 环境路径。

首次启动时创建数据库表、执行插件迁移并导入插件种子；数据库文件已存在时不会因为条目被删空而重新播种。若检测到 8765 已有实例，会提示复用；Web 启动失败会直接报错退出，不再回退旧 GUI。

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
  - `Playwright`：网页会话通道/DeepSeek 网页自动化，需要浏览器二进制与登录态。
- **安装示例**：

```bat
python -m pip install pikepdf Pillow PyPDF2 python-docx edge-tts uiautomation playwright
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

经典 Tkinter GUI 与 CLI 已随学习核心插件化退役：两者原先直接依赖 `core.models` / `core.repository` / `core.planner`，在业务表与学习逻辑下沉到 `plugins/russian/` 后不再维护。背景库导入、共建打卡等操作保留在 Web UI；宿主只保留 Web 入口。

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
├── plugins/                 22 个插件目录：19 个有卡片插件（russian/、book_reader/、project_manager/、bg_library/、promptgen/、ai/、aidebug/、sim/、expdata/、schedule/、screeps/、urlarch/、netexp/、rivet/、filejudge/、pdf/、model_usage/、pixel_art/、finance/）+ 3 个 backend-only（webchat/、cobuild/、tts/）；manifest + backend.py，有卡片的另有 feature.js + plugin.css，有表的另有 schema.sql
├── data/                    运行时数据：SQLite、settings、缓存、会话、备份
├── docs/
│   ├── plugin-development-whitepaper.md   开发白皮书（最高准则）
│   ├── 多AI共建日志.md                    多 AI 打卡镜像（自动生成，勿手改）
│   └── appendix/                          白皮书附件：附录 A–D + 三份说明性文件
├── tools/                   生成器与启动脚本（启动旅行之木.cmd 等）
└── tests/                   冒烟测试（多数使用临时数据库）
```

分层约定：`ui/` 通过 `/api/plugin/<id>/*` 动态分发到各插件 backend；宿主不再有 `core/`，全部 SQL 在插件内（model_usage/pixel_art/finance/bg_library/book_reader/russian/project_manager）；`db/schema/` 为空，新增表只写 `plugins/<id>/schema.sql` 并由 manifest 的 `db` 声明，`db/connection.py` 启动时扫描执行；`data/settings.json` 的 `modules.enabled` 控制按模块建表，默认全启用。

插件可有/无业务表：无表插件不声明 `db` 或声明 `"db": null`。当前 22 个插件中 **13 个有 `schema.sql`、9 个无表**（cobuild、expdata、filejudge、netexp、pdf、rivet、sim、tts、webchat）。

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
- **清单**：[plugins/lib.json](plugins/lib.json)（22 条：id / kind / has_ui / called_by / notes，仅作文档索引，宿主与测试不读取）。
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

以 `ui/web/static/app.js` 的内置 `TOOLS` + `GET /api/plugins/list` 为准。像素动画/Godot 功能已整体下线；模型用量与消费、像素画、记账本与理财量化、AI 工作台、接口调试器、项目管理、俄语书籍阅读、背景库/文件预览、提示词生成器已分别迁为 `plugins/model_usage/`、`plugins/pixel_art/`、`plugins/finance/`、`plugins/ai/`、`plugins/aidebug/`、`plugins/project_manager/`、`plugins/book_reader/`、`plugins/bg_library/`、`plugins/promptgen/`。共享的 `ui/web/static/features/webchat.js` 是唯一内置前端依赖，通过 manifest 的 `shared_features` 在插件 feature 前加载。随机模拟器、实验数据获取、计划表、Screeps Arena、网址归档、网络与互联探索、铆钉点、文件判官、PDF 工具、批量压缩、模型用量与消费、像素画、记账本、理财量化、AI 工作台、接口调试器、项目管理、书籍阅读、背景库/文件预览、提示词生成器均已迁为插件；PDF 工具与批量压缩共用 `plugins/pdf` 的两个 entry。插件入口、backend、建表语句、数据目录与样式统一由各插件 `manifest.json` 声明，主程序按 `entries[].feature` 动态 `import()`、按 `/api/plugin/<id>/*` 动态分发，启动时扫描 `manifest.db` 执行 `plugins/<id>/schema.sql`、按 `data_dirs` 创建 `data/plugins/<id>/`，不再维护 `plugin_routes.py` 式的硬编码路由表（全部 22 个插件目录已升级 manifest v2）。插件卡片可在「所有功能」中禁用（`rt_plugins_disabled` 按插件 id，禁用后该插件所有 entry 一起消失），隐藏仍用工具架子 `hidden`（只影响显示）。当前内置 0 + 19 个有卡片插件（21 个 entry）= 21 张卡片；另有 3 个 backend-only 插件（webchat/cobuild/tts）。v2 插件样式随插件放 `plugins/<id>/plugin.css`（22 个 v2 插件目录已迁移/占位）。插件规范见[白皮书](docs/plugin-development-whitepaper.md)（附录 A–D）；CSS 约定见本节与 [§9 开发约定](#9-开发约定)。

其中：
- **批量压缩**会原位改写/替换所选目录中的原文件；**文件判官**可按确认删除文件。使用前先预览。文件判官的图片/PDF/DOCX 预览分别依赖 Pillow/PyPDF2/python-docx，缺失时返回 `missing_dependency` 提示，不影响插件加载。
- **记账本**数据存于主库 `finance_*` 表（经 `/api/plugin/finance/*`），旧 `rt_fin` 仅保留为只读历史备份；提示词工作流、周计划、网址库、Screeps 工作区已迁入 SQLite，页面通过插件 API 读写；仅 UI 偏好仍存浏览器 localStorage。**理财量化**数据已重置，当前仅保留占位入口，待后续重构。
- **网址归档**的组别、网址与启动间隔已迁入 SQLite（`urlarch_*` 表，经 `/api/plugin/urlarch/*`）。
- **项目优化与当前综述**提供树形背景库、导入/导出、历史归档与手动变更留痕；其「文件预览与说明卡片」可浏览工作区文件树、标注数据库文件、维护 `file_notes` / `db_rules`，并导出 `docs/appendix/files_manifest.json`。文件预览只写说明元数据，不改源码。

## 6. 数据保存与备份

| 内容 | 位置 |
| --- | --- |
| 俄语条目、SRS、复习流水、主题、阅读、项目管理、背景库、文件说明 | `data/russian_tutor.db` |
| 配额、字体、模型价目、下载分组、路径覆盖 | `data/settings.json` |
| API Key / 模型设置 | `data/ai_keys.json`（明文） |
| 语音缓存 | `data/voice_cache/` |
| Web Chat 会话列表 / 登录态 | `data/webchat_sessions.json`、`data/plugins/webchat/webchat_profile/`（round 59 从项目根迁入；备份 `data/` 现在会包含约 14MB profile，round 58 之前口径不同） |
| 文件判官保留标记 | `data/plugins/filejudge/keep.json`（旧 `data/filejudge_keep.json` 只读保留） |
| 基金缓存等 | `data/` 下对应 JSON/缓存 |
| 铆钉点打卡数据 | `data/plugins/rivet/rivet.json`（旧 `data/rivet.json` 只读保留） |
| 前端 UI 偏好 | 浏览器 localStorage（仅主题、折叠、视图位置等）；内容资产在 SQLite |

首次启动：若 `data/` 不存在，`config.py` 自动创建；`db/connection.py` 的 `init_db()` 扫描 `plugins/*/manifest.json` 的 `db` 声明，执行 `schema.sql` 建表、`seed.py` 播种、`migrate.py` 迁移；`manifest.data_dirs` 声明的目录自动创建。克隆本项目后直接 `python main.py` 即可，无需手动建库。`data/` 不进 Git（见 `.gitignore`），备份需单独保存。

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

- 开发新插件先读[插件开发守则](docs/plugin-development-guide.md)（7 节动线，规则引用白皮书）；AI 提示词模板见 [plugin-dev-prompt.md](docs/appendix/prompts/plugin-dev-prompt.md)，可用 `python tools/scaffold_plugin.py` 填充占位符；市场数据库草案见 [plugin-market-schema-draft.md](docs/appendix/plugin-market-schema-draft.md)（未建表）。
- 不引入 Web 框架；接口保持本地 JSON；前端不引入框架/构建步骤。
- SQL 分层：全部 SQL 在插件内（`plugins/russian/repo.py`、`plugins/project_manager/pm_repository.py`、`plugins/book_reader/book_reader.py`、`plugins/bg_library/`、`plugins/model_usage/repo.py`、`plugins/pixel_art/repo.py`、`plugins/finance/repo.py`）；宿主 `db/schema/` 为空，新增表只写 `plugins/<id>/schema.sql`，由 manifest 的 `db` 声明，`db/connection.py` 启动时扫描执行；`data/settings.json` 的 `modules.enabled.<module_key>` 可关闭对应建表（默认全启用）。
- 新增工具：在 `ui/web/static/features/` 放按需模块，通过 `window.__toolRenderers` 注册；入口/架子在 `app.js`。
- 新增插件：在 `plugins/<id>/` 放 `manifest.json` + `feature.js`，feature 末尾写 `window.__toolRenderers.<id> = render`；清单由 `GET /api/plugins/list` 扫描并合并，无需改 `app.js` 的 `TOOLS`。新增/改名后运行 `python tests/smoke_plugins.py`。
- 多入口插件：`manifest.json` 的 `entries` 数组配置 `{id,name,icon,shelf,feature,desc?}`；每个 entry 生成一张卡片并加载自己的 feature，禁用仍按插件 id。`/api/plugins/list` 统一返回 `plugins[].entries[]`。
- 共享主程序前端模块：`manifest.json` 声明 `"shared_features": ["webchat"]`；`app.js` 会先从主程序 `features/` 加载这些经典脚本，再 `import()` 插件 feature。当前 `ai` / `aidebug` 共享 `webchat.js`，该文件仍留在主程序。
- 插件后端（可选）：`manifest.json` 声明 `"backend": "backend.py"`，在 `backend.py` 暴露 `handle(method, subpath, query, body)`；只通过 `/api/plugin/<id>/*` 调用，源码不会经 `/plugins/*` 静态暴露。插件私有数据放 `data/plugins/<id>/`。返回二进制时用 `{"__binary__": true, "body": bytes, "mime": "...", "filename": "...", "headers": {...}}`。
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

`smoke_web.py` 会启动临时数据库并调用本地 HTTP 服务；若运行 `/api/tts` 需要网络，可能因环境网络失败。其余测试多数使用临时目录，不碰真实数据。`smoke_plugins.py` 校验插件清单/静态资源/扫描容错/CSS 阈值；存在 `node` 时会额外做 ESM 语法检查，无 `node` 自动跳过。

## 11. 文档

- [旅行之木 · 微内核架构与插件开发白皮书 (v2.0)](docs/plugin-development-whitepaper.md)
- [插件开发守则](docs/plugin-development-guide.md) · [AI 提示词模板](docs/appendix/prompts/plugin-dev-prompt.md) · [插件市场草案](docs/appendix/plugin-market-schema-draft.md)
- 白皮书附录：[A backend-only](docs/appendix/A-backend-only.md) · [B 根路由](docs/appendix/B-root-routing.md) · [C 二进制格式](docs/appendix/C-binary-format.md) · [D 其他约定](docs/appendix/D-conventions.md)
- 说明性文件：[file_navigation.json](docs/appendix/file_navigation.json) · [file_navigation.md](docs/appendix/file_navigation.md) · [files_manifest.json](docs/appendix/files_manifest.json)

## 12. 项目状态与交接（2026-10-30）

- **插件**：22 个插件目录——19 个有前端卡片（ai、aidebug、bg_library、book_reader、expdata、filejudge、finance、model_usage、netexp、pdf、pixel_art、project_manager、promptgen、rivet、russian、schedule、screeps、sim、urlarch）+ 3 个 backend-only（webchat、cobuild、tts）。
- **13 smoke 基线**：smoke_plugins 181/181、smoke_startup_once 33/33、smoke_web 74/75（TTS 502 已知）、smoke_plugin_decoupling 452/452、smoke_finance 34/34、smoke_model_usage 49/49、smoke_reader_range 25/25、smoke_pm 23/23、smoke_books 11/11、smoke_file_preview 17/17、smoke_pdf 17/17、smoke_plugin_data_dirs 13/13、smoke_plugin_module_off 10/10。
- **剩余 pending**：`tests/smoke_plugin_decoupling.py::Server.start` 的 `stop()` 异常保护（低概率进程竞态，三次 452/452 通过，留观察）。
- **交接建议**：新功能进 `plugins/<id>/`，不碰宿主；改现有功能直接改对应插件；每轮下沉、改 settings 或改 API 后跑全量 13 个 smoke；`/api/plugin/<id>/*` 必须用语义子路径；二进制响应按附录 C。
- 完整状态、数据资产与 docs 闭环规则见白皮书 [§7 项目状态与交接](docs/plugin-development-whitepaper.md) 与 [§8 docs 目录与临时文件闭环](docs/plugin-development-whitepaper.md)。
- **schema 合规（round 79）**：round 75–78 完成 22 插件表结构收口——67 张表全部合规（9 张豁免 live 且有注释），61 个触发器；矩阵见 [plugin-schema-compliance-matrix.md](docs/appendix/plugin-schema-compliance-matrix.md)。
- **round 80 收口**：`Server.start` 已修复（健康检查捕获 `BadStatusLine`/`HTTPException`，`stop()` 包裹进程退出竞态），连续 20 次 452/452 通过；**pending 清零**。触发器维护约定见守则 §4.2，无表插件说明见 §4。
- **round 65 删除核对**：v2.1 草案四项（backend-only / 根路由 / `__binary__` / import 约定）已分别落在 `docs/appendix/A–D`；结项报告的 22 插件清单、13 smoke 基线、剩余 pending、交接建议已落在白皮书 §7.1–7.4。核对表见白皮书 §7.6；两份源文档未恢复。
