# 插件规范性审查报告（round 71）

## 0. 审查依据与边界

- 依据：`docs/plugin-development-guide.md` 第 4 节检查清单；白皮书正文 §二–§六、§十 与附录 A–E；`plugins/lib.json` 分类清单。
- 阅读边界：22 份 `manifest.json`、目录文件清单、`schema.sql` 的表名/列名；仅通读 4 个 `backend.py`（webchat/tts/ai/cobuild）；其余 18 个 `backend.py` 只核对 `def handle` 存在性，未读正文；`feature.js` 只核对存在与是否注册 `__toolRenderers`，未读实现。
- 日期：2026-10-31；round：71。本次无背景库数据（背景库不可用，未导入）。
- 严重度：`blocker`=违反硬规则需修；`should`=应修但可运行；`nice`=改进项。

## 1. 全局结论

- 22 个插件 manifest 均为 v2，`id`/`name`/`version`/`enabled`/`entries`/`backend`/`db`/`style` 无缺失或类型错误；`id` 与目录名一致；`plugins/lib.json` 的 `kind`/`has_ui`/`called_by` 与 manifest 全部一致。
- 全部 22 个插件**缺少 `plugins/<id>/README.md`**（规则缺口 G1）。
- 12 个有 `schema.sql` 的插件中，11 个存在内容表缺 `raw_json`/`live_json` 的情况（见各插件与汇总）。
- 18 个未读 `backend.py` 的插件，其根路由非空、`__binary__` 格式、import 约定：**需执行 Agent 核实**（本轮不判缺失）。

## 2. 逐插件审查

### ai
- 关键文件：`plugins/ai/manifest.json`；`ai_bridge.py`、`backend.py`、`feature.js`、`plugin.css`、`repo.py`、`schema.sql`。
- 合规项：manifest 完整；1 entry 且 feature 注册 `__toolRenderers`；`backend.py::handle` 非空（keys/chat/state）；`from plugins.ai import ...`；`ai_sessions`、`ai_tx_logs` 均含 `raw_json`+`live_json`；`shared_features: ["webchat"]`；分类与 lib.json 一致。
- 缺失项：无 blocker/should；`[nice]` 无 README（G1）；`[nice]` `consumes` 未声明 webchat（实际调用，声明可选）。
- 建议补充项：README 说明“AI 工作台 + webchat 依赖”；声明 `provides`/`consumes`。
- 规则缺口：G1。

### aidebug
- 关键文件：`plugins/aidebug/manifest.json`；`backend.py`、`feature.js`、`plugin.css`、`repo.py`、`schema.sql`。
- 合规项：manifest 完整；entry feature 注册；`handle` 存在；`aidebug_history` 含 `raw_json`+`live_json`；`shared_features: ["webchat"]`；分类一致。
- 缺失项：`[nice]` 无 README（G1）；`[nice]` `consumes` 未声明 webchat。
- 建议补充项：README；声明依赖。
- 规则缺口：G1。

### bg_library
- 关键文件：`plugins/bg_library/manifest.json`；`__init__.py`、`backend.py`、`bg_library.py`、`feature.js`、`file_preview.py`、`plugin.css`、`repo.py`、`schema.sql`。
- 合规项：manifest 完整；entry feature 注册；`handle` 存在；分类一致；背景库当前不可用（业务状态，非结构问题）。
- 缺失项：`[blocker]` `bg_nodes`、`bg_versions`、`file_notes`、`db_rules` 均缺 `raw_json`/`live_json`（4/4）；`[nice]` 无 README。
- 建议补充项：按 §五 评估 4 表加列/迁移；README。
- 规则缺口：G1、G2。

### book_reader
- 关键文件：`plugins/book_reader/manifest.json`；`__init__.py`、`backend.py`、`book_reader.py`、`bookmarks_repo.py`、`feature.js`、`migrate.py`、`plugin.css`、`reader_screen.js`、`schema.sql`。
- 合规项：manifest 完整；entry feature 注册；`handle` 存在；`reader_bookmarks` 含 `raw_json`+`live_json`；分类一致。
- 缺失项：`[blocker]` 12 张表缺 `raw_json`/`live_json`：`reader_books`、`reader_sections`、`reader_sentences`、`reader_placeholders`（仅 raw）、`reader_words`、`reader_phrases`、`reader_translation_pairs`、`reader_marks`、`reader_import_batches`、`reader_cleaning_tasks`、`reader_cleaning_records`、`reader_return_errors`；`[should]` `plugins/book_reader/book_reader.py` 直接 `from plugins.pixel_art import service`（跨插件直接 import，违背守则 §5 走 HTTP 的约定）；`[nice]` 无 README。
- 建议补充项：评估 12 表迁移；改为 `/api/plugin/pixel_art/*` 或明确豁免；README。
- 规则缺口：G1、G2、G4。

### cobuild
- 关键文件：`plugins/cobuild/manifest.json`；`backend.py`、`cobuild.py`。
- 合规项：backend-only（`entries: []`、`backend`）符合附录 A；`handle` 非空（data/checkin/void）；`from plugins.cobuild import cobuild`；无表/无 data_dirs 合理；分类例外（functional）与 lib.json 一致。
- 缺失项：`[should]` 无 README（底层/无卡片插件，需要说明打卡入口与接口）；`[nice]` `provides` 未声明（可作为能力声明）。
- 建议补充项：README 说明 `/api/plugin/cobuild/*` 与打卡入口。
- 规则缺口：G1。

### expdata
- 关键文件：`plugins/expdata/manifest.json`；`feature.js`、`plugin.css`。
- 合规项：manifest 完整；entry feature 注册；无 backend/db 合理；分类一致。
- 缺失项：`[nice]` 无 README。
- 建议补充项：README 说明无后端与数据存浏览器/SQLite 的边界。
- 规则缺口：G1。

### filejudge
- 关键文件：`plugins/filejudge/manifest.json`；`backend.py`、`feature.js`、`plugin.css`。
- 合规项：manifest 完整；entry feature 注册；`handle` 存在；`data_dirs: ["filejudge"]`；分类一致；无 db 合理。
- 缺失项：`[nice]` 无 README。
- 建议补充项：README 说明删除/预览能力与 `data/plugins/filejudge/keep.json`。
- 规则缺口：G1。

### finance
- 关键文件：`plugins/finance/manifest.json`；`backend.py`、`crawler.py`、`feature_finance.js`、`feature_finquant.js`、`fund_nav.py`、`migrate_localstorage.py`、`plugin.css`、`repo.py`、`schema.sql`、`shared.js`。
- 合规项：manifest 完整（2 entries，feature 均注册）；`handle` 存在；`data_dirs: ["finance"]`；分类一致；`finance_quant_assets`、`finance_fund_cache` 含 `raw_json`+`live_json`。
- 缺失项：`[blocker]` 17 张表缺 `raw_json`/`live_json`（`finance_account_groups`、`finance_accounts`、`finance_fx_history`、`finance_inv_*` 6 张、`finance_liabs`、`finance_reals`、`finance_reasons`、`finance_settings`、`finance_snapshot_*` 4 张、`finance_snapshots`）；`[should]` 无 README（多入口插件）；`[nice]` `consumes` 未声明 webchat/ai（实际调用）。
- 建议补充项：区分内容表与快照/派生表后迁移；README。
- 规则缺口：G1、G2、G6。

### model_usage
- 关键文件：`plugins/model_usage/manifest.json`；`backend.py`、`feature.js`、`migrate.py`、`plugin.css`、`repo.py`、`schema.sql`、`service.py`。
- 合规项：manifest 完整；entry feature 注册；`handle` 存在；分类一致。
- 缺失项：`[should]` `model_usage_logs` 缺 `raw_json`/`live_json`（日志表是否属“内容表”需核实）；`[nice]` 无 README。
- 建议补充项：明确日志表口径（豁免或加列）。
- 规则缺口：G1、G2。

### netexp
- 关键文件：`plugins/netexp/manifest.json`；`feature.js`、`plugin.css`。
- 合规项：manifest 完整；entry feature 注册；无 backend/db 合理；分类一致。
- 缺失项：`[nice]` 无 README。
- 建议补充项：README 说明纯前端/网络探索能力。
- 规则缺口：G1。

### pdf
- 关键文件：`plugins/pdf/manifest.json`；`backend.py`、`feature_batch.js`、`feature_pdf.js`、`plugin.css`。
- 合规项：manifest 完整（2 entries，feature 均注册）；`handle` 存在；无 db 合理；分类一致；二进制响应格式：**需执行 Agent 核实**（未读 backend 正文）。
- 缺失项：`[should]` 无 README（多入口插件）；`[nice]` 无 `data_dirs`/输入输出契约说明。
- 建议补充项：README 说明批量压缩会原位改写、PDF 二进制协议。
- 规则缺口：G1、G6。

### pixel_art
- 关键文件：`plugins/pixel_art/manifest.json`；`backend.py`、`feature.js`、`plugin.css`、`repo.py`、`schema.sql`、`service.py`、`visual_settings.py`。
- 合规项：manifest 完整；entry feature 注册；`handle` 存在；分类一致；被 `book_reader` 直接 import（见 book_reader）。
- 缺失项：`[blocker]` `pixel_artworks`、`pixel_asset_refs`、`visual_settings` 缺 `raw_json`/`live_json`（`visual_settings` 若为纯 UI 偏好可评估豁免）；`[nice]` 无 README。
- 建议补充项：内容表加列/迁移；README。
- 规则缺口：G1、G2。

### project_manager
- 关键文件：`plugins/project_manager/manifest.json`；`__init__.py`、`backend.py`、`feature.js`、`plugin.css`、`pm_repository.py`、`pm_service.py`、`schema.sql`、`seed.py`。
- 合规项：manifest 完整；entry feature 注册；`handle` 存在；分类一致。
- 缺失项：`[blocker]` `pm_stage_templates`、`pm_projects`、`pm_stages`、`pm_prompt_drafts`、`pm_results` 均缺 `raw_json`/`live_json`（5/5）；`[nice]` 无 README。
- 建议补充项：5 表迁移；README。
- 规则缺口：G1、G2。

### promptgen
- 关键文件：`plugins/promptgen/manifest.json`；`__init__.py`、`backend.py`、`feature.js`、`migrate.py`、`plugin.css`、`repo.py`、`schema.sql`。
- 合规项：manifest 完整；entry feature 注册；`handle` 存在；`shared_features: ["webchat"]`；`pg_assets` 含 `raw_json`+`live_json`；分类一致。
- 缺失项：`[blocker]` `pg_flows`、`pg_modules`、`pg_tasks`、`pg_flow_groups` 有 `raw_json` 但缺 `live_json`；`[nice]` 无 README；`[nice]` `consumes` 未声明 webchat。
- 建议补充项：补 `live_json`；README。
- 规则缺口：G1、G2。

### rivet
- 关键文件：`plugins/rivet/manifest.json`；`backend.py`、`feature.js`、`plugin.css`。
- 合规项：manifest 完整；entry feature 注册；`handle` 存在；`data_dirs: ["rivet"]`；无 db 合理；分类一致。
- 缺失项：`[nice]` 无 README。
- 建议补充项：README 说明打卡数据位置。
- 规则缺口：G1。

### russian
- 关键文件：`plugins/russian/manifest.json`；`__init__.py`、`backend.py`、`feature.js`、`importer.py`、`migrate.py`、`models.py`、`planner.py`、`plugin.css`、`repo.py`、`schema.sql`、`seed.py`、`srs.py`。
- 合规项：manifest 完整；entry feature 注册；`handle` 存在；分类一致；展示名“俄语单词背诵”（round 68）。
- 缺失项：`[blocker]` `items`、`item_stats`、`review_logs`、`daily_logs`、`themes` 缺 `raw_json`/`live_json`（5/5；其中 stats/logs 可评估是否属内容表）；`[nice]` 无 README。
- 建议补充项：按内容表口径迁移；README。
- 规则缺口：G1、G2。

### schedule
- 关键文件：`plugins/schedule/manifest.json`；`backend.py`、`feature.js`、`migrate.py`、`plugin.css`、`repo.py`、`schema.sql`。
- 合规项：manifest 完整；entry feature 注册；`handle` 存在；`schedule_assets` 含 `raw_json`+`live_json`；分类一致。
- 缺失项：`[blocker]` `schedule_week_plans`、`schedule_tasks` 有 `raw_json` 但缺 `live_json`；`[nice]` 无 README。
- 建议补充项：补 `live_json`；README。
- 规则缺口：G1、G2。

### screeps
- 关键文件：`plugins/screeps/manifest.json`；`backend.py`、`feature.js`、`migrate.py`、`plugin.css`、`repo.py`、`schema.sql`。
- 合规项：manifest 完整；entry feature 注册；`handle` 存在；`screeps_assets` 含 `raw_json`+`live_json`；分类一致。
- 缺失项：`[blocker]` `screeps_units`、`screeps_modules` 有 `raw_json` 但缺 `live_json`；`[nice]` 无 README。
- 建议补充项：补 `live_json`；README。
- 规则缺口：G1、G2。

### sim
- 关键文件：`plugins/sim/manifest.json`；`feature.js`、`plugin.css`。
- 合规项：manifest 完整；entry feature 注册；无 backend/db 合理；最小插件示例；分类一致。
- 缺失项：`[nice]` 无 README。
- 建议补充项：README 作为最小示例说明。
- 规则缺口：G1。

### tts
- 关键文件：`plugins/tts/manifest.json`；`backend.py`、`tts.py`。
- 合规项：backend-only 符合附录 A；`handle` 非空（speak/clear-cache）；`from plugins.tts import tts`；二进制响应为 `__binary__: True` + `body`/`mime`/`headers`；`provides: ["tts"]`；分类一致。
- 缺失项：`[should]` 无 README（底层插件）；`[should]` 语音缓存写 `data/voice_cache/`（不在 `data/plugins/tts/`，且未声明 `data_dirs`），与“插件私有数据放 data/plugins/<id>/”约定不一致；`[nice]` 依赖 edge-tts/系统语音未在 manifest 声明（manifest 无依赖字段，属文档缺口）。
- 建议补充项：README；决定共享缓存是否豁免或迁入插件目录。
- 规则缺口：G1、G5。

### urlarch
- 关键文件：`plugins/urlarch/manifest.json`；`backend.py`、`feature.js`、`migrate.py`、`plugin.css`、`repo.py`、`schema.sql`。
- 合规项：manifest 完整；entry feature 注册；`handle` 存在；`urlarch_assets` 含 `raw_json`+`live_json`；分类一致。
- 缺失项：`[blocker]` `urlarch_groups`、`urlarch_links` 有 `raw_json` 但缺 `live_json`；`[nice]` 无 README。
- 建议补充项：补 `live_json`；README。
- 规则缺口：G1、G2。

### webchat
- 关键文件：`plugins/webchat/manifest.json`；`backend.py`、`web_chat.py`。
- 合规项：backend-only 符合附录 A；`handle` 非空（status/sessions/chat/restart/new/login/sessions/delete）；`from plugins.webchat import web_chat`；`data_dirs: ["webchat"]`；分类一致；`called_by` 与代码调用一致。
- 缺失项：`[should]` 无 README（底层插件）；`[should]` `provides` 未声明（实际向 ai/aidebug/finance/promptgen 提供 webchat 能力）。
- 建议补充项：README；`provides: ["webchat"]`（需评估宿主是否消费，见 §10.1）。
- 规则缺口：G1。

## 3. 汇总表

| 插件 | blocker | should | nice | 需 round 72 |
|---|---|---|---|---|
| ai | 0 | 0 | 2 | 否 |
| aidebug | 0 | 0 | 2 | 否 |
| bg_library | 1 | 0 | 1 | 是 |
| book_reader | 1 | 1 | 1 | 是 |
| cobuild | 0 | 1 | 1 | 是 |
| expdata | 0 | 0 | 1 | 否 |
| filejudge | 0 | 0 | 1 | 否 |
| finance | 1 | 1 | 1 | 是 |
| model_usage | 0 | 1 | 1 | 是 |
| netexp | 0 | 0 | 1 | 否 |
| pdf | 0 | 1 | 1 | 是 |
| pixel_art | 1 | 0 | 1 | 是 |
| project_manager | 1 | 0 | 1 | 是 |
| promptgen | 1 | 0 | 2 | 是 |
| rivet | 0 | 0 | 1 | 否 |
| russian | 1 | 0 | 1 | 是 |
| schedule | 1 | 0 | 1 | 是 |
| screeps | 1 | 0 | 1 | 是 |
| sim | 0 | 0 | 1 | 否 |
| tts | 0 | 2 | 1 | 是 |
| urlarch | 1 | 0 | 1 | 是 |
| webchat | 0 | 2 | 1 | 是 |

- blocker 插件 **10** 个；should-only 插件 **5** 个；需 round 72 修复合计 **15** 个；无需修复 **7** 个（ai、aidebug、expdata、filejudge、netexp、rivet、sim）。
- 契约已覆盖：webchat、tts、ai、cobuild（见 `docs/appendix/interfaces/`）；其余 18 个插件的路由/二进制/import 本轮未读正文，标注“需执行 Agent 核实”。

## 4. 规则缺口汇总

- **G1 README 未入规则**：白皮书与守则第 4 节都没有“插件目录须有 README”的条款，但审查希望有。需 round 72 决定是否入守则/白皮书，并定严重度。
- **G2 `raw_json`/`live_json` 适用范围**：§五要求“所有内容表”，但未定义日志/统计/快照/UI 偏好等派生表是否豁免、历史表如何迁移。导致 11 个插件出现 blocker，需先定口径再修。
- **G3 `provides`/`consumes` 强制程度**：§10.1 已标“需执行 Agent 核实”；本轮发现 webchat 未声明能力、调用方未声明 consumes，但无法判定是否违规。
- **G4 跨插件直接 import**：守则 §5 要求走 HTTP，白皮书未明文禁止直接 import；`book_reader → pixel_art.service` 属此类，需定性与豁免。
- **G5 共享缓存路径**：`tts` 使用 `data/voice_cache/` 而非 `data/plugins/tts/`；白皮书未定义“共享缓存”例外。
- **G6 多入口 feature 命名**：`finance`、`pdf` 使用 `feature_finance.js`/`feature_pdf.js` 等，白皮书 §三示例固定 `feature.js`；实际允许 manifest 声明任意文件名，建议补充说明。

## 5. 需 round 72 修复的插件清单

`bg_library`、`book_reader`、`cobuild`、`finance`、`model_usage`、`pdf`、`pixel_art`、`project_manager`、`promptgen`、`russian`、`schedule`、`screeps`、`tts`、`urlarch`、`webchat`。

修复优先级建议：先定 G2 口径（决定 10 个 blocker 的处理方式），再补 `live_json`（schedule/screeps/urlarch/promptgen 改动最小），最后处理 README 与声明类 should。

## 6. round 72 处理状态（追加）

- G1–G6 已定口径并写入守则/白皮书（见守则 §4/§4.1/§6、白皮书 §五/§十/§十一）。
- 22/22 插件 README 已补（固定五节）。
- 已修复并移入 resolved：`schedule`、`screeps`、`urlarch`、`promptgen`（schema 补 `live_json` + 幂等 migrate）；`cobuild`、`pdf`、`tts`（README / G5 共享缓存决定）。
- 仍保留 pending（round 73）：`bg_library`、`book_reader`、`finance`、`model_usage`、`pixel_art`、`project_manager`、`russian`、`webchat`。
- 阶段 A 全量 13 通过：12 个全 PASS，`smoke_web` 74/75（TTS 502 已知）。
