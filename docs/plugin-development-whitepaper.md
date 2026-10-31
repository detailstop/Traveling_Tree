# 旅行之木 · 微内核架构与插件开发白皮书 (v2.0)

> v2.1 补充见文末附录 A–D 索引（2026-10-29）；附录全文已拆到 `docs/appendix/` 下的四个附件文件。附录 A 为 backend-only 插件规范；附录 B 为根路由约定；附录 C 修正二进制响应格式；附录 D 为其他约定。原章节编号不变。附录 E 为底层下沉插件分类（round 67）。

本文档是“旅行之木”项目的最高开发准则，涵盖了微内核架构设计、插件生命周期管理以及数据安全铁律。任何新增功能的开发都必须严格遵守本白皮书。

## 一、 核心理念与架构定位

“旅行之木”采用极端的**微内核（Microkernel）**架构：

1. **宿主（Host）是白纸**：主程序仅负责启动 Web 服务、扫描插件目录、挂载 API 路由、执行 SQL 初始化以及提供静态服务。主程序内**没有任何业务逻辑**（`TOOLS = []`）。
2. **插件（Plugin）是器官**：所有业务功能（学习、记账、阅读等）均是独立插件。插件必须高度自包含，拔掉任何一个插件文件夹，宿主依然能零报错正常运行。
3. **完全脱离浏览器绑架**：用户的业务内容资产 100% 存放在 SQLite 数据库，界面偏好同步落盘至本地 JSON 文件。浏览器仅作为无状态的渲染器与一级缓存。

## 二、 Manifest v2 契约 (插件的身份证)

插件的存在依赖于根目录下的 `manifest.json`，标准结构如下：

```jsonc
{
  "schema_version": 2,
  "id": "your_plugin_id",
  "name": "插件名称",
  "version": "1.0",
  "enabled": true,
  "entries": [
    {
      "id": "entry_id",
      "name": "卡片名称",
      "icon": "🛠️",
      "feature": "feature.js",
      "shelf": "gen"
    }
  ],
  "backend": "backend.py",      // 若无后端填 null
  "db": {                       // 若无业务表填 null
    "module_key": "your_plugin_id",
    "schema": "schema.sql",
    "seed": "seed.py",          // 可选，首次建库执行
    "migrate": "migrate.py"     // 可选，旧表升级执行
  },
  "style": "plugin.css",        // 若无专属样式填 null
  "data_dirs": ["your_plugin_id"], // 宿主自动在 data/plugins/ 下建目录
  "shared_features": []         // 依赖的宿主公共脚本，如 ["webchat"]
}
```

## 三、 前端开发规范 (feature.js)

- **ESM 动态加载**：插件前端必须是 ES Module，导出 `render(container)` 函数。宿主会在用户点击卡片时通过 `import('/plugins/<id>/feature.js')` 动态加载。
- **样式自包含**：所有专属 CSS 必须写在 `plugin.css` 中，禁止污染主程序的 `app.css`。禁止直接写全局 DOM 样式。
- **API 请求前缀**：所有后端请求必须走 `/api/plugin/<id>/*`。
- **UI 防闪烁与偏好存储**：
  - 前端直接使用 `localStorage.setItem` 保存 UI 偏好（如主题、折叠状态）。
  - 主程序底层已通过拦截器（`Storage.prototype`）监听了白名单内的偏好键，会自动触发防抖并异步同步至后端的 `data/user_preferences.json`。
  - 页面启动时优先读取 `localStorage` 保证秒开，随后异步从后端拉取配置进行对齐。
  - **铁律**：前端不得主动调用 `localStorage.removeItem` 删除用户旧数据。

## 四、 后端开发规范 (backend.py)

- **统一入口**：后端必须暴露 `handle(method, subpath, query, body) -> dict` 函数。
- **路由隔离**：宿主会将 `/api/plugin/<id>/*` 的分发权全权交由该函数处理。
- **二进制响应**：若涉及文件下载（如 PDF），需返回特殊字典结构：`{"__binary__": bytes_data, "__status__": 200, "Content-Type": "application/pdf"}`。
- **模块启停**：如果用户在 `data/settings.json` 中关闭了某模块，宿主的 `_GuardedConnection` 会拦截请求并返回 503。前端应做好 503 容错。

## 五、 数据存储与安全原则（防丢失铁律）

- **业务内容必须有 `schema.sql`**：工作流、计划、书签、对话历史等用户核心内容资产，必须通过插件自己的 `schema.sql` 建表并入库。绝对禁止将业务资产长期存放在浏览器 `localStorage`。
- **仅纯 UI 偏好留在浏览器**：只有主题、折叠、图表模式等不承载业务内容的纯 UI 偏好可以放在本地。判断标准：清空浏览器数据只会损失外观，不会损失用户内容。
- **`raw_json` 与 `live_json` 兜底机制**：所有内容表必须包含：

```sql
raw_json  TEXT NOT NULL,      -- 迁移或初始创建时的原文，永不覆盖
live_json TEXT NOT NULL DEFAULT '' -- 当前编辑状态
```

  前端读取优先使用 `live_json`，为空时回退 `raw_json`。迁移脚本必须打印“原始条目数 / 成功入库条目数”并校验一致，以防静默丢失数据。

- **派生/日志/快照表口径（round 72 G2）**：内容表、日志/事件表必须同时含 `raw_json` 与 `live_json`；纯派生/缓存/快照表可豁免 `live_json`，但必须保留 `raw_json`，或在 `schema.sql` 注释中写明可重建来源。豁免表必须在插件 README 的「数据表」中列出，未标注视为违规。

- **SQL 集中与隔离**：插件的 SQL 必须集中在自己的 `repo.py` 或 `backend.py` 中，严禁跨插件 JOIN，严禁去宿主里找 SQL。表名必须以插件 ID 或功能为前缀。

## 六、 测试与解耦红线

- **双向绑定校验**：新增插件后必须运行 `python tests/smoke_plugins.py`，确保宿主与插件的清单一致。
- **解耦极限测试**：必须通过 `python tests/smoke_plugin_decoupling.py` 的改名/重启测试。如果你的插件消失或损坏，绝不允许导致宿主启动崩溃（日志无 Error/Traceback）。

## 七、项目状态与交接（2026-10-30）

### 7.1 插件清单
- **22 个插件目录**：19 个有前端卡片的插件（ai、aidebug、bg_library、book_reader、expdata、filejudge、finance、market、model_usage、netexp、pdf、pixel_art、project_manager、promptgen、rivet、russian、schedule、screeps、urlarch）；3 个 backend-only 插件（webchat、cobuild、tts，`entries: []`，`/api/plugin/<id>/*` 正常分发）。`sim` 试点包源码在 `market/sources/sim/`，市场安装后进入 `plugins/sim/`。22 个插件目录 + `sim` 源共 **23 份 `INFO.md`** 市场信息卡；规则见 [plugin-info-card-template.md](appendix/plugin-info-card-template.md)。
- **russian 定位**：`russian` 是普通功能插件（非预置、可卸载），不是宿主主体或默认必装核心。
- **宿主剩余**：`modules/__init__.py`、`modules/settings_store.py`、`ui/web/server.py`、`ui/web/static/app.js`。原 `core/` 与 `db/schema/` 业务 DDL 已清除。

### 7.2 15 个 smoke 基线（round 85 更新）
| 测试 | 覆盖 | 基线 |
|---|---|---|
| smoke_books.py | 书籍导入/列表 | 11/11 |
| smoke_reader_range.py | 阅读范围/settings/quota | 25/25 |
| smoke_finance.py | 记账、基金、插件路由 | 34/34 |
| smoke_web.py | 宿主 API、cobuild、tts、webchat | 74/75（TTS 502） |
| smoke_pm.py | 项目管理 | 23/23 |
| smoke_model_usage.py | 模型用量与定价 | 49/49 |
| smoke_file_preview.py | 文件预览 | 17/17 |
| smoke_pdf.py | PDF 与二进制响应 | 17/17 |
| smoke_plugin_data_dirs.py | 插件 data_dirs | 13/13 |
| smoke_plugin_decoupling.py | 19 卡片插件改名/重启解耦 | 454/454 |
| smoke_plugin_module_off.py | 模块关闭 503/不建表 | 10/10 |
| smoke_plugins.py | manifest/清单/静态资源/后端 | 183/183 |
| smoke_startup_once.py | 首次启动建表/API | 34/34 |
| smoke_market.py | 市场安全/安装/拉取/开发插件 | 40/40 |
| smoke_info_cards.py | 22+1 份 INFO.md 字段/一致性 | 9/9 |

合计 **993/994**（14 项全 PASS；`smoke_web` 74/75，TTS 502 为唯一允许 FAIL）。

已知 FAIL：`smoke_web` 的 TTS 502 来自 edge-tts 外部网络不可用，不阻塞其他断言；出现非 TTS 的 FAIL 按回滚规则处理。

### 7.3 剩余 pending
- 无（`Server.start` 已在 round 80 修复并连续 20 次 452/452 通过；本轮市场无新增 pending）。

### 7.4 交接建议
- 新功能：在 `plugins/` 下新建插件，写 `manifest.json` + `backend.py`；有业务表加 `schema.sql`，参照附录 A–D。
- 改现有功能：直接改对应插件目录，不碰宿主。
- 每轮下沉、改 settings 或改 API 后运行全量 13 个 smoke。
- `/api/plugin/<id>/*` 必须有语义子路径，按附录 B 命名。
- 二进制响应用 `__binary__: True` + `body`/`mime`/`filename`/`headers`，不要用旧版 bytes 直传。
- TTS 502 是已知外部网络问题；出现其他 FAIL 先回滚再定位。

### 7.5 数据资产
- 主库 `data/russian_tutor.db`（唯一业务主库；文件名与项目目录名解耦，不改）。
- `data/settings.json`：`download_groups` + `modules.enabled`；插件 settings 在 `data/plugins/<id>/settings.json`。
- 敏感文件：`data/ai_keys.json`、`data/webchat_sessions.json`、`data/plugins/webchat/webchat_profile/`、`data/plugins/finance/fixtures/rt_fin.json`；只按路径处理，不读正文、不进 Git。
- 市场运行态：`data/plugins/market/index.json`（不进 Git；首次请求从 `market/index.json` 复制 5 条预置；远程拉取覆盖）。
- 市场源：`data/plugins/market/settings.json` 的 `market_source_url`（https raw；空则拉取按钮置灰）。
- 市场资产：`market/index.json`（进 Git，包清单/SHA256）、`market/packages/*.zip`（不进 Git）、`market/sources/<id>/`（试点源码，进 Git）、`market/.trash/`（卸载备份，不进 Git）；安装记录在 `market_installed` 表。
- 通用下载地址：`data/settings.json` 的 `download_dir`（绝对路径）；市场「开发插件」写盘使用，未设置/目录不存在/无权限时明确报错。该路径仅用于插件服务端写盘；浏览器下载仍走浏览器/统一下载句柄，与该项相互独立。
- 市场源：`data/plugins/market/settings.json` 的 `market_source` 只读默认 `market/packages/`（A 阶段）；B3 已决定接受源码公开：`market/sources/` 与未来市场仓库源码可见，无敏感内容。

### 7.6 round 65 删除前核对结论（round 66 补记）
round 65 删除 `plugin-development-whitepaper-v2.1-draft.md` 与 `project-closure-2026-10-29.md` 前，逐项核对结论如下；两份源文档未恢复。

| 来源 | 核对项 | 结论 | 落点 |
|---|---|---|---|
| v2.1 草案 | backend-only 插件规范 | 已覆盖 | `docs/appendix/A-backend-only.md`（A.1–A.4） |
| v2.1 草案 | 根路由约定 | 已覆盖 | `docs/appendix/B-root-routing.md` |
| v2.1 草案 | `__binary__` 二进制格式修正 | 已覆盖 | `docs/appendix/C-binary-format.md` |
| v2.1 草案 | 插件内部 import 约定 | 已覆盖 | `docs/appendix/D-conventions.md`（`shared_features`/`db.migrate` 仍标待确认） |
| 结项报告 | 22 插件清单 | 已覆盖 | 白皮书 §7.1 |
| 结项报告 | 13 smoke 基线 | 已覆盖 | 白皮书 §7.2 |
| 结项报告 | 剩余 pending | 已覆盖 | 白皮书 §7.3 |
| 结项报告 | 交接建议 | 已覆盖 | 白皮书 §7.4 |

未发现未覆盖项，故未恢复源文档、未新增补写内容；仅补本核对表。

## 八、docs 目录与临时文件闭环

- `docs/` 只允许长期存放三类内容：白皮书（本文件）、`多AI共建日志.md`（自动镜像，勿手改）、`appendix/`（白皮书附件）。
- 其他说明性/一次性材料一律视为临时文件，必须走闭环：**提出 → 确定 → 并入主文件 → 删除**。
- 未闭环即违规：下次接手的 AI 应优先处理，或先向用户确认；不得在 `docs/` 长期堆放临时文件。
- 未闭环项登记到 `docs/appendix/file_navigation.json` 的 `pending[]`；处理完成后（内容并入主文件并删除临时文件）移入 `decided[]`，并在记录中写明 resolution。

## 九、白皮书附件（说明性文件）

三份说明性文件作为白皮书附件统一放在 `docs/appendix/`，不并入本白皮书正文：

| 附件 | 性质 | 使用规则 |
|---|---|---|
| `docs/appendix/file_navigation.json` | 文件去留与审查决策主数据源（pending/decided） | 新增决定追加；历史语义保留；不改 schema |
| `docs/appendix/file_navigation.md` | 由 JSON 生成的只读摘要 | 严禁手改；改 JSON 后运行 `python tools/gen_file_navigation_md.py` |
| `docs/appendix/files_manifest.json` | file_preview 导出的工作区文件清单快照 | 只读参考；不是实时索引，文件变动后需重新导出 |

## 十、工程约束补充（round 70）

### 10.1 `provides` / `consumes`
- 两者为 manifest v2 的**可选能力声明**数组，用于描述“提供/消费的能力名”；不替代运行时分发或鉴权。
- 当前宿主对这两个字段的强制程度：**需执行 Agent 核实**（实现见 `ui/web/server.py`）；文档与未来市场索引只把它们当作声明信息。
- 声明应保持稳定、可读（如 `["webchat"]`），不要写临时路径或版本号。

### 10.2 `plugins/` 目录扫描边界
- 宿主只扫描 `plugins/<目录>/manifest.json`，并要求 `manifest.id == 目录名`；把插件移出 `plugins/` 或改目录名会导致其不再被发现、API 404。
- `tests/smoke_plugins.py` 会把 `plugins/` 下**任意子目录**计入插件目录数（当前 22）；因此不要把索引/文档放在 `plugins/lib/` 之类的子目录，统一用单文件 `plugins/lib.json`（宿主与测试不读取该文件）。
- 插件目录内可自由增加实现文件，但不要新增会被误认为插件的子目录。

### 10.3 Windows 批处理必须 CRLF
- `.cmd` 脚本必须保存为 CRLF 行尾；LF 行尾会导致 `cmd.exe` 解析异常（round 69 实测）。
- 当前启动脚本 `tools/启动旅行之木.cmd` 必须保持 CRLF；编辑后请复核行尾。

### 10.4 `provides` 必须、`consumes` 可选（round 72 G3）
- 插件向其他插件或宿主前端提供能力时，必须在 manifest 声明 `provides`（能力名数组，如 `["webchat"]`）。
- `consumes` 为可选声明；跨插件调用仍以 HTTP `/api/plugin/<id>/*` 为主。
- 宿主是否强制消费这两个字段：**需执行 Agent 核实**；规则层面按声明要求执行。

### 10.5 跨插件调用与标注（round 72 G4）
- 跨插件调用优先走 HTTP；不把其他插件的 backend/业务模块当作库直接 import。
- 历史实现若确需直接 import（如 `book_reader` → `pixel_art.service`），必须在该插件 README 的「依赖」与 `plugins/lib.json` 的 `notes` 中标注，作为已知耦合。
- 新增直接 import 需在代码评审中说明理由。

### 10.6 共享缓存路径例外（round 72 G5）
- 插件私有数据默认放 `data/plugins/<id>/`（`data_dirs`）。
- 跨插件共享的缓存（当前仅 `tts` 的 `data/voice_cache/`）保留为共享缓存例外；必须在插件 README 与 `plugins/lib.json` notes 说明，不要求迁入插件私有目录。

### 10.7 多入口 feature 命名（round 72 G6，建议）
- 推荐多入口插件使用 `feature_<entry>.js`（如 `feature_pdf.js`）；manifest 的 `entries[].feature` 是唯一事实来源，文件名不强制。
- 采用自定义命名时，在 README「入口与路由」列出 entry 与文件对应关系。

## 十一、开发者文档索引

- 插件信息卡模板：[plugin-info-card-template.md](appendix/plugin-info-card-template.md)（INFO.md 必需结构）（round 70）

- 插件开发守则（7 节开发者动线）：[docs/plugin-development-guide.md](plugin-development-guide.md)
- 提示词模板（含占位符）：[docs/appendix/prompts/plugin-dev-prompt.md](appendix/prompts/plugin-dev-prompt.md)
- 开发提示词（只做占位符替换，不写 `plugins/`）：市场页「开发插件」→ `/api/plugin/market/scaffold/*`（原 CLI 已退役）
- 插件市场数据库设计草案（未建表）：[docs/appendix/plugin-market-schema-draft.md](appendix/plugin-market-schema-draft.md)
- 插件分类清单（只读）：`plugins/lib.json`
- 每个插件目录必须提供 `plugins/<id>/README.md`，固定小节：职责 / 入口与路由 / 数据表 / 依赖 / 注意事项；格式见守则 §4.1（round 72 G1）。

规则本体仍以本文 §二–§六、附录 A–E 与 §十 为准；守则与模板只做引用与流程引导，不重复条文。

---

## 附录 A：backend-only 插件规范（v2.1）

全文见 [appendix/A-backend-only.md](appendix/A-backend-only.md)：定义、判断标准、manifest 字段，以及与「宿主是白纸」的关系。

## 附录 B：根路由约定（v2.1）

全文见 [appendix/B-root-routing.md](appendix/B-root-routing.md)：`/api/plugin/<id>/*` 不接受空子路径，下沉路由按语义化子路径映射。

## 附录 C：二进制响应格式修正（v2.1）

全文见 [appendix/C-binary-format.md](appendix/C-binary-format.md)：`__binary__: True` + `body`/`mime`/`filename`/`headers` 的实际格式与宿主解析行为。

## 附录 D：其他约定（v2.1）

全文见 [appendix/D-conventions.md](appendix/D-conventions.md)：插件内部 import、`data_dirs`、`shared_features` 与 `db.migrate` 的待确认项。

## 附录 E：底层下沉插件（round 67）

### E.1 分类口径
- **functional（功能性）**：`manifest.entries` 非空，渲染前端卡片，用户可直接进入。
- **library（底层下沉）**：`entries` 为空，不渲染卡片，只通过 `/api/plugin/<id>/*` 被其他插件或宿主前端调用。
- **例外**：`cobuild` 为 backend-only（无卡片），但用户直接使用「多 AI 共建 → 打卡」入口，归 functional。
- 机器可读清单：`plugins/lib.json`（22 条，字段 `id`/`kind`/`has_ui`/`called_by`/`notes`）。该文件仅作文档索引，宿主、测试与插件运行时不读取。

### E.2 当前清单
| 插件 | kind | has_ui | 直接调用方 | 文档 |
|---|---|---|---|---|
| webchat | library | 否 | ai、aidebug、finance、promptgen、`ui/web/static/app.js`、`ui/web/static/features/webchat.js` | [lib/webchat.md](appendix/lib/webchat.md) |
| tts | library | 否 | `ui/web/static/app.js`（russian 经此间接使用） | [lib/tts.md](appendix/lib/tts.md) |
| cobuild | functional（例外） | 否 | 用户打卡入口 | — |

其余 19 个有卡片插件均为 functional。

### E.3 调用关系摘要
- `webchat`：AI 工作台、接口调试器、记账本/理财量化、提示词生成器与宿主中断逻辑共用；依赖 Playwright 与登录态 profile。
- `tts`：宿主 `speakBtn()` 与缓存清理调用；russian 朗读经宿主函数间接使用；依赖 edge-tts，失败回落系统语音。
- `pixel_art` 虽为 functional，但被 `book_reader` 直接 import（`plugins.book_reader.book_reader` → `plugins.pixel_art.service`）；分类仍按「有卡片」判定。

### E.4 单插件文档索引
- [docs/appendix/lib/webchat.md](appendix/lib/webchat.md)
- [docs/appendix/lib/tts.md](appendix/lib/tts.md)

### E.5 未来物理移动的风险（仅说明，不执行）
- 宿主只扫描 `plugins/<目录>/manifest.json` 且要求 `id == 目录名`；把插件移出 `plugins/` 或改变目录名会导致它不再被发现、其 API 404。
- `tests/smoke_plugins.py` 把 `plugins/` 下**任意目录**计入插件目录数（当前 22）；新增或移动目录会改变该计数，需同步调整测试，否则 smoke 失败。
- 因此本轮不移动任何插件目录；`plugins/lib.json` 用单文件而非 `plugins/lib/` 子目录，正是为了避免被计为第 23 个插件目录。
