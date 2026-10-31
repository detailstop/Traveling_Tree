# 插件开发守则（round 70）

> 本文是开发者动线说明，不是规则本体。规则以[白皮书](plugin-development-whitepaper.md)为准；凡白皮书已有条文，这里只引用章节号，不重复。
> 提示词模板：`docs/appendix/prompts/plugin-dev-prompt.md`；市场草案：`docs/appendix/plugin-market-schema-draft.md`。

## 1. 快速开始：最小可运行插件

插件目录最小结构（`plugins/<id>/`）：

```text
plugins/<id>/
├── manifest.json     必需：字段定义见白皮书 §二（Manifest v2 契约）
├── feature.js        有卡片时必需：入口约定见 §三
├── plugin.css        有卡片时建议：样式自包含，见 §三
├── backend.py        需要后端时：handle 约定见 §四
└── schema.sql        需要建表时：见 §五；可另配 seed.py / migrate.py
```

参考最小实现：`plugins/sim/`（无 backend、有卡片）；backend-only 参考 `plugins/cobuild/`（`entries: []` + `backend`，分类例外见附录 E）。
不要复制字段清单或代码到本文：动手前先读白皮书 §二–§六。

自测入口：`python tests/smoke_plugins.py`（双向绑定校验，§六）。

## 2. 三类信息导航

| 需求 | 去哪 |
|---|---|
| 基础必需信息 | 本守则 §1、§4；白皮书 §二–§六；附录 A–E；工程约束 §十 |
| 提示词模板 | `docs/appendix/prompts/plugin-dev-prompt.md`；批量替换用 `tools/scaffold_plugin.py` |
| 对接接口 | 本守则 §5；`plugins/lib.json`（只读索引）；`docs/appendix/plugin-market-schema-draft.md`（未来市场接口索引草案） |

## 3. 开发流程（每步都有检查点）

1. **提出**：写清用户场景、卡片还是 backend-only、是否持久化、是否被其他插件调用。检查点：`kind`（functional/library）与 `has_ui` 已定，能对应附录 E 口径。
2. **设计**：列出目录、manifest 字段、路由子路径、表与数据目录。检查点：`id` 与目录名一致；根路由有语义子路径（附录 B）；schema 含 `raw_json`/`live_json`（§五）。
3. **脚手架**：`python tools/scaffold_plugin.py --id ... --name ... --kind ... --has-ui ...` 生成 AI 提示词。检查点：生成的 prompt 无未替换占位符；脚本不写 `plugins/`。
4. **实现**：按 feature/backend/schema 分文件落地。检查点：import 用 `from plugins.<id> import <module>`（附录 D）；二进制用 `__binary__: True` + `body`/`mime`/`filename`/`headers`（附录 C）；不在插件里写宿主业务。
5. **自测**：`python tests/smoke_plugins.py` + 相关功能 smoke（§六、§七.2）。检查点：全绿或仅已知 TTS 502。
6. **接入**：卡片由 `GET /api/plugins/list` 自动发现；如新增数据目录，确认 `data/plugins/<id>/` 自动创建（§四、附录 D）。检查点：清单数量与目录一致，宿主无 Traceback。
7. **文档**：更新 README/白皮书相关说明；规则变化先改白皮书再引用。检查点：无重复规则、链接可点。
8. **打卡**：调用 `plugins.cobuild.cobuild.checkin(...)`，写清改动、文件、风险。
9. **导航登记**：在 `docs/appendix/file_navigation.json` 的 `decided[]` 追加；运行 `python tools/gen_file_navigation_md.py`。

## 4. 检查清单

- [ ] `manifest.json`：`id` 与目录名一致、`schema_version: 2`、`entries` 结构合法（§二）
- [ ] 文件结构：有卡片→`feature.js`（+`plugin.css`）；有后端→`backend.py`；有表→`schema.sql`（§二–§五）
- [ ] 内容表含 `raw_json TEXT NOT NULL` 与 `live_json TEXT NOT NULL DEFAULT ''`（§五）
- [ ] 根路由非空，`/api/plugin/<id>/<subpath>` 语义化（附录 B）
- [ ] 二进制响应格式正确（附录 C）
- [ ] `backend.py` 内部 import 用 `from plugins.<id> import <module>`（附录 D）
- [ ] `data_dirs` 声明与 `config.plugin_data_dir()` 使用一致（附录 D）
- [ ] `shared_features` 只引用宿主共享脚本；注入时机标注“需执行 Agent 核实”（附录 D）
- [ ] `provides`/`consumes` 如声明则与能力一致（§十）
- [ ] 解耦：删除/改名插件后宿主零 Traceback（§六）
- [ ] 测试：`smoke_plugins` + 相关 smoke 通过（§六）
- [ ] 文档：README/白皮书/附件已同步，规则不重复（§八、§十一）
- [ ] 插件 `README.md` 存在且含固定小节：职责 / 入口与路由 / 数据表 / 依赖 / 注意事项（§4.1；白皮书 §十一）
- [ ] 对外提供能力时已声明 `provides`（§十.4）；`consumes` 可选
- [ ] 派生/缓存/快照表按 G2 口径豁免时，已在 README「数据表」列出，且保留 `raw_json` 或来源说明（白皮书 §五）
- [ ] 跨插件直接 import 已在该插件 README 与 `plugins/lib.json` notes 标注（§十.5）
- [ ] 打卡：`cobuild.checkin` 成功
- [ ] 导航：`file_navigation.json` 已登记并重生成 md

### 4.1 插件 README 格式

每个 `plugins/<id>/README.md` 固定五节，只写事实、不复制代码：

1. **职责**：一句话说明插件做什么、给谁用。
2. **入口与路由**：卡片 entry 与 feature 文件；有无后端；路由前缀 `/api/plugin/<id>/*`（子路径见 `backend.py::handle`，已有契约则链接 `docs/appendix/interfaces/<id>.md`）。
3. **数据表**：表名清单；`raw_json`/`live_json` 状态；按 G2 豁免的表要写明“豁免 `live_json`，保留 `raw_json`/可重建来源”。
4. **依赖**：`data_dirs`、`shared_features`、跨插件调用（含直接 import 标注）、可选第三方库。
5. **注意事项**：敏感数据、破坏性操作、已知环境失败（如 TTS 502）、未核实事项。

README 不写实现细节，不复制代码；事实以 manifest/schema/backend 为准。

### 4.2 触发器维护约定（round 80）

- 采用触发器的插件：`book_reader`（22 个）、`finance`（29 个）、`project_manager`（10 个）；其余插件用显式列名写入。
- 触发器统一由各插件 `migrate.py` 创建（**不写入 `schema.sql`**）：迁移时先删除旧触发器，按 `PRAGMA table_info` 当前列生成 `AFTER INSERT`（填 raw/live）与 `AFTER UPDATE`（刷 live、保留 raw）。
- 给上述插件**加列后必须跑一次 migrate**（启动 `init_db` 即会执行），重建触发器以纳入新列；否则 JSON 快照缺字段。
- 触发器依赖 SQLite JSON1（≥3.38，本机 3.45）；新插件如采用该方案，须在 README「数据表」与 `migrate.py` 中说明。
- 合规状态与触发器覆盖见 [plugin-schema-compliance-matrix.md](appendix/plugin-schema-compliance-matrix.md)。

插件打包与本地市场安装：`tools/build_market_packages.py` 从 `market/sources/<id>/` 生成 `market/packages/<id>.zip` 与 `market/index.json`；安装/卸载/安全校验在 `plugins/market/`，使用说明见 README §12。

> `provides` 示例（round 73 核实）：`webchat` → `["webchat"]`；`ai` → `["ai"]`；`pixel_art` → `["pixel_assets"]`。`cobuild` 不声明 `provides`：它面向用户打卡入口，没有被其他插件调用。`consumes` 可选。

## 5. 接口索引（只列路由与调用方，不抄签名）

| 插件 | 路由前缀 | 直接调用方（`plugins/lib.json` 的 `called_by`） | 接口契约 |
|---|---|---|---|
| `webchat` | `/api/plugin/webchat/*` | ai、aidebug、finance、promptgen、`ui/web/static/app.js`、`ui/web/static/features/webchat.js` | [interfaces/webchat.md](appendix/interfaces/webchat.md) |
| `tts` | `/api/plugin/tts/*` | `ui/web/static/app.js`（russian 经 `speakBtn()` 间接） | [interfaces/tts.md](appendix/interfaces/tts.md) |
| `ai` | `/api/plugin/ai/*` | 无插件声明；`finance` 平级调用 keys/chat | [interfaces/ai.md](appendix/interfaces/ai.md) |
| `cobuild` | `/api/plugin/cobuild/*` | 用户打卡入口 | [interfaces/cobuild.md](appendix/interfaces/cobuild.md) |

已有契约的插件：`webchat`、`tts`、`ai`、`cobuild`（见 `docs/appendix/interfaces/`）。其余插件暂无契约，接口位置为 `plugins/<id>/backend.py::handle`。

平级跨调用案例：
- `finance` → `/api/plugin/ai/keys`、`/api/plugin/ai/chat`（AI 能力）。
- `finance` / `aidebug` / `promptgen` / `ai` → `/api/plugin/webchat/*`（网页会话能力）。

约定：跨插件调用一律走 HTTP `/api/plugin/<id>/*`，不要直接 import 其他插件的 backend/业务模块。调用前先读 `docs/appendix/interfaces/<id>.md`；没有契约的插件读其 `backend.py::handle`。契约未覆盖的参数/返回细节仍需核实。未来市场的接口索引见 `docs/appendix/plugin-market-schema-draft.md`。

## 6. 常见错误

| 错误 | 后果/原因 | 正确做法 |
|---|---|---|
| 根路由为空 `/api/plugin/<id>` | 宿主不分发空子路径 | 用语义子路径（附录 B） |
| 二进制按旧版 `{"__binary__": bytes}` 返回 | 宿主返回 500 `plugin_error` | `__binary__: True` + `body`（附录 C） |
| `backend.py` 写 `from . import` | 宿主按文件路径加载，`__name__` 非包名 | `from plugins.<id> import <module>`（附录 D） |
| 内容表缺 `raw_json`/`live_json` | 迁移/编辑兜底失效 | 按 §五 建表 |
| 前端调用 `localStorage.removeItem` | 会删除用户旧数据 | 只 `setItem`，清理走显式入口（§三） |
| 插件直接 import 其他插件业务/宿主 SQL | 解耦破坏、宿主不再是白纸 | 走 `/api/plugin/<id>/*`；SQL 留在本插件（§一、§五） |
| 在 `plugins/` 下新建 `lib/` 等子目录放索引 | `smoke_plugins` 会把任意子目录计为第 23 个插件 | 用单文件 `plugins/lib.json`（§十、附录 E.5） |
| 派生/缓存表误豁免 | 未保留 `raw_json` 或未写可重建来源，无法兜底 | 按白皮书 §五 G2 口径：豁免 `live_json` 但保留 `raw_json`/来源说明，并在 README 标注 |
| 跨插件直接 import 未标注 | 依赖关系隐形，后续重构易断 | 优先走 HTTP；确需直接 import 时在 README 与 `plugins/lib.json` notes 标注（§十.5） |
| Windows 批处理用 LF 行尾 | cmd 解析异常（round 69 实测） | 脚本保存为 CRLF（§十） |

## 7. 参考实现

| 插件 | 演示什么 |
|---|---|
| `plugins/sim` | 最小有卡片插件（无后端、无表） |
| `plugins/cobuild` | backend-only（`entries: []`），分类例外归 functional（附录 E） |
| `plugins/pdf` | 二进制响应（附录 C） |
| `plugins/ai` | 被平级插件调用（finance → `/api/plugin/ai/*`） |
