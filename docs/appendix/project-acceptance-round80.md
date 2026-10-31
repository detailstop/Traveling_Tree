# 项目验收与结项（round 80 收口，round 81 验收）

## 1. 验收结论

**通过。** 项目 schema 已合规收口（67/67 表）、测试稳定（连续 20 次解耦测试全过）、pending 清零、文档齐全、Git 工作区 clean，可交付/可公开。

- 收口轮次：round 80（`Server.start` 修复、pending 清零）
- 验收轮次：round 81（2026-10-31）
- 验收性质：只读验收，未改代码/schema/测试/插件。

## 2. 项目定位

“旅行之木 / Traveling_Tree”是**微内核 + 全插件化 + 无状态前端**的本地个人工作台：宿主只做启动、扫描插件、挂路由、建表、静态服务与设置读写；业务全部在 `plugins/`；个人数据全部在 `data/`（不进 Git）。

## 3. 架构摘要

- **22 个插件**：19 个有卡片的功能性插件 + 3 个 backend-only（webchat、cobuild、tts；cobuild 例外归功能性）。
- 其中 **13 个有 `schema.sql`**，**9 个无业务表**：cobuild、expdata、filejudge、netexp、pdf、rivet、sim、tts、webchat（无表插件不声明 `db` 或 `db: null`）。
- 宿主剩余：`modules/__init__.py`、`modules/settings_store.py`、`ui/web/server.py`、`ui/web/static/app.js`；原 `core/`、`db/schema/` 业务 DDL 已清除。
- 数据隔离：业务 SQL 全部在插件（manifest `db` 声明）；`data/` 由 `.gitignore` 排除；`data/russian_tutor.db` 文件名不改。
- 目录与职责详见 README §4（不在此复制）。

## 4. schema 合规

- 合规矩阵：[plugin-schema-compliance-matrix.md](plugin-schema-compliance-matrix.md)。
- **67/67 表合规**；13 个有 schema 的插件，无待修表。
- **豁免 `live_json` 9 张**（均保留 `raw_json` 且 schema 有注释）：
  `reader_placeholders`、`item_stats`、`finance_settings`、`finance_snapshot_account_subs`、`finance_snapshot_accounts`、`finance_snapshot_fx`、`finance_snapshots`、`pixel_asset_refs`、`visual_settings`。
- **触发器 61 个**：book_reader 22、finance 29、project_manager 10；均在各插件 `migrate.py` 中按 PRAGMA 列生成（不写入 `schema.sql`）。
- 显式写入插件：bg_library、russian、pixel_art、promptgen、schedule、screeps、urlarch、ai、aidebug、model_usage 等。
- 触发器维护约定见守则 §4.2；依赖 SQLite JSON1（≥3.38）。

## 5. 测试基线（13 项）

来源：round 80 全量 13 实测 + 白皮书 §7.2 基线。

| # | 测试 | 断言结果 | 备注 |
|---|---|---|---|
| 1 | smoke_books.py | 11/11 PASS | |
| 2 | smoke_reader_range.py | 25/25 PASS | |
| 3 | smoke_finance.py | 34/34 PASS | |
| 4 | smoke_web.py | 74/75 PASS | 唯一 FAIL：tts audio 502（外部网络，已知） |
| 5 | smoke_pm.py | 23/23 PASS | |
| 6 | smoke_model_usage.py | 49/49 PASS | |
| 7 | smoke_file_preview.py | 17/17 PASS | |
| 8 | smoke_pdf.py | 17/17 PASS | |
| 9 | smoke_plugin_data_dirs.py | 13/13 PASS | |
| 10 | smoke_plugin_decoupling.py | 452/452 PASS | 连续 20 次通过，单次 104.6–129.1s |
| 11 | smoke_plugin_module_off.py | 10/10 PASS | |
| 12 | smoke_plugins.py | 181/181 PASS | |
| 13 | smoke_startup_once.py | 33/33 PASS | |

合计 **939/940**（1 项为已知 TTS 502）。`smoke_plugin_decoupling` 的 `Server.start` 两处竞态已在 round 80 修复并 20 次验证。

## 6. 提交链（round 65–80，16 轮）

| 轮次 | 提交 | 摘要 |
|---|---|---|
| 65 | `0aa8b21` | 说明性文件收敛到 docs/appendix/；白皮书附录拆分与 docs 闭环 |
| 66 | `9562db5` | 补 round 65 核对结论；更正 resolved 说法；manifest 快照与提交状态 |
| 67 | `c2e9111` | 插件分类与底层下沉文档；lib.json 路径调整 |
| 68 | `8bf68b1` | russian 展示名改为“俄语单词背诵”；README/历史名称统一 |
| 69 | `3ab7391` | 删除失效 webchat_probe.py；启动脚本迁 tools/ |
| 70 | `8a3785b` | 提示词模板、脚手架、插件市场草案；README 指引 |
| 71 | `a1b5ccb` | 22 插件审查报告与 4 份接口契约 |
| 72 | `2941064` | G1–G6 口径；22 插件 README；4 插件 live_json 迁移 |
| 73 | `8844720` | G3 provides；4 插件写入补齐；model_usage 双列 |
| 74 | `fdb1bcc` | 审查报告补 round 73；4 插件保存回归；B 暂缓 |
| 75 | `79af8d9` | 49 表盘点；bg_library/russian 补 raw/live；关第一批 pending |
| 76 | `641de6c` | book_reader 位置式 INSERT 改造；raw/live + 触发器；russian 级联 |
| 77 | `c376eae` | finance 17 表 raw/live 与豁免；关 finance pending |
| 78 | `2cb6dae` | pixel_art/project_manager 迁移；Server.start 10 次稳定性 |
| 79 | `7ca7ba6` | 22 插件 schema 合规矩阵；pm seed 验证；README 收口 |
| 80 | `b21a663` | 修复 Server.start；20 次通过；触发器约定；pending 清零 |

当前 `HEAD == origin/main == b21a663`（验收提交前）；round 81 的文档提交紧随其后。

## 7. 数据备份（round 75–81）

| 轮次 | 路径 | 大小 | SHA256 |
|---|---|---|---|
| 75 | data/backup/round75_db/russian_tutor.db.bak | 9,023,488 B | `8E526BB9C678EFE9AAC367CF71A6EA764195BA8EFA492A0A3FADF393CD6A6F58` |
| 76 | data/backup/round76_db/russian_tutor.db.bak | 16,285,696 B | `1C5C4E247279BACCF23CB6F1BED1B073FB87D4B9F1812028D5C069231E355C1A` |
| 77 | data/backup/round77_db/russian_tutor.db.bak | 19,103,744 B | `80F869CB3E2C20038341F9C81E6522606C041BF94784578CAC2025A2F8E4827B` |
| 78 | data/backup/round78_db/russian_tutor.db.bak | 19,255,296 B | `F8DC093538660029ADD8F0A32DF4AA4028660C11D0A9573D66BC294BC49EBBFD` |
| 79 | data/backup/round79_db/russian_tutor.db.bak | 19,263,488 B | `A29291AABD8BBFED2DAAA5EFC8D4670F8315C02A829055CF1A95EF449FCEDBD0` |
| 80 | data/backup/round80_db/russian_tutor.db.bak | 19,263,488 B | `A29291AABD8BBFED2DAAA5EFC8D4670F8315C02A829055CF1A95EF449FCEDBD0` |
| 81 | data/backup/round81_db/russian_tutor.db.bak | 19,263,488 B | `A29291AABD8BBFED2DAAA5EFC8D4670F8315C02A829055CF1A95EF449FCEDBD0` |

均通过 `PRAGMA integrity_check=ok`；`data/` 不进 Git，备份仅在本地保留。

## 8. 已知限制

1. **TTS 502**：`smoke_web` 的 tts audio 用例依赖 edge-tts 外部网络，离线时失败；不阻塞其他断言。
2. **豁免表 live 不可用**：9 张表仅 `raw_json` + 可重建说明；未来引入编辑态需补 `live_json` 与 `COALESCE(NULLIF(live_json,''),raw_json)` 回退。
3. **触发器依赖 SQLite JSON1**：book_reader/finance/project_manager 的 raw/live 由触发器维护；加列后必须跑一次 migrate 重建（守则 §4.2）。
4. **端口竞态**：解耦测试使用动态空闲端口，理论上仍可能与其他进程竞争；round 80 连续 20 次未出现。
5. **`raw_json` 语义**：为插入/迁移时的当前状态快照，不是历史原文；历史审计以 `file_navigation` 与备份为准。
6. **无鉴权/限流**：项目定位单机本地，仅监听 `127.0.0.1`，不应暴露公网。

## 9. 未来方向

- **插件市场**：设计草案见 [plugin-market-schema-draft.md](plugin-market-schema-draft.md)（未建表）；后续可落 `plugins/market/`。
- **脚手架可视化入口**：已由市场「开发插件」实现（round 86；原 `tools/scaffold_plugin.py` 退役）。
- **按需新增功能插件**：遵循守则 7 节动线与 G1–G6 口径；新插件必须自包含、零 Traceback、有 README。
- **触发器等基础设施**：若新增 raw/live 表，优先显式列名（写入点少）或按 §4.2 触发器方案。

## 10. 验收清单

- [x] **schema 合规**：67/67 表合规（矩阵）。
- [x] **测试稳定**：全量 13 中 12 项全 PASS，`smoke_web` 74/75（TTS 502 已知）；解耦测试连续 20 次 452/452。
- [x] **pending 清零**：file_navigation `pending[]` 为 0。
- [x] **文档齐全**：白皮书 + 附录 A–E + 守则 + 合规矩阵 + 接口契约 + 市场草案 + 验收文档。
- [x] **备份齐全**：round 75–81 共 7 份本地备份，SHA256 记录。
- [x] **Git clean**：round 80 提交后工作区 clean；`HEAD == origin/main`。

> 验收数据均来自已有文档与 round 80 实测记录；本轮未读插件实现、未读 `data/` 敏感正文。
