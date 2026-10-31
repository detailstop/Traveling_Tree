# 插件 schema 合规矩阵（round 79）

## 0. 依据与范围

- 依据：白皮书 §五（G2）、9 张豁免清单（round 75–78）、各插件 `schema.sql` 与 `migrate.py`。
- 扫描：13 个有 `schema.sql` 的插件、共 67 张表；9 个插件无业务表（cobuild/expdata/filejudge/netexp/pdf/rivet/sim/tts/webchat）。
- 触发器统计取自真实库 `sqlite_master`（book_reader 22、finance 29、project_manager 10，共 61 个；按表计 33 张）。
- 本轮只读；未改任何 schema/插件。

## 1. 汇总

- 有 schema 插件：**13**；总表数：**67**。
- 合规表：**67**；待修表：**0**。
- 豁免 live 表：**9**；有触发器表：**33**（实际触发器 61 个）。
- 判定：全部合规，无需修项。

## 2. 逐插件矩阵

### ai

表数 2；合规 2；待修 0；豁免 0；有触发器表 0。

| 表 | raw | live | 豁免注释 | 触发器 | 判定 |
|---|---|---|---|---|---|
| `ai_sessions` | 有 | 有 | - | 无 | 合规 |
| `ai_tx_logs` | 有 | 有 | - | 无 | 合规 |

### aidebug

表数 1；合规 1；待修 0；豁免 0；有触发器表 0。

| 表 | raw | live | 豁免注释 | 触发器 | 判定 |
|---|---|---|---|---|---|
| `aidebug_history` | 有 | 有 | - | 无 | 合规 |

### bg_library

表数 4；合规 4；待修 0；豁免 0；有触发器表 0。

| 表 | raw | live | 豁免注释 | 触发器 | 判定 |
|---|---|---|---|---|---|
| `bg_nodes` | 有 | 有 | - | 无 | 合规 |
| `bg_versions` | 有 | 有 | - | 无 | 合规 |
| `file_notes` | 有 | 有 | - | 无 | 合规 |
| `db_rules` | 有 | 有 | - | 无 | 合规 |

### book_reader

表数 13；合规 13；待修 0；豁免 1；有触发器表 11。

| 表 | raw | live | 豁免注释 | 触发器 | 判定 |
|---|---|---|---|---|---|
| `reader_books` | 有 | 有 | - | 有 | 合规 |
| `reader_sections` | 有 | 有 | - | 有 | 合规 |
| `reader_sentences` | 有 | 有 | - | 有 | 合规 |
| `reader_placeholders` | 有 | 豁免 | 有 | 无 | 合规（豁免 live） |
| `reader_words` | 有 | 有 | - | 有 | 合规 |
| `reader_phrases` | 有 | 有 | - | 有 | 合规 |
| `reader_translation_pairs` | 有 | 有 | - | 有 | 合规 |
| `reader_marks` | 有 | 有 | - | 有 | 合规 |
| `reader_import_batches` | 有 | 有 | - | 有 | 合规 |
| `reader_cleaning_tasks` | 有 | 有 | - | 有 | 合规 |
| `reader_cleaning_records` | 有 | 有 | - | 有 | 合规 |
| `reader_return_errors` | 有 | 有 | - | 有 | 合规 |
| `reader_bookmarks` | 有 | 有 | - | 无 | 合规 |

### finance

表数 19；合规 19；待修 0；豁免 5；有触发器表 17。

| 表 | raw | live | 豁免注释 | 触发器 | 判定 |
|---|---|---|---|---|---|
| `finance_account_groups` | 有 | 有 | - | 有 | 合规 |
| `finance_accounts` | 有 | 有 | - | 有 | 合规 |
| `finance_fx_history` | 有 | 有 | - | 有 | 合规 |
| `finance_inv_accounts` | 有 | 有 | - | 有 | 合规 |
| `finance_inv_holdings` | 有 | 有 | - | 有 | 合规 |
| `finance_inv_lots` | 有 | 有 | - | 有 | 合规 |
| `finance_inv_note_groups` | 有 | 有 | - | 有 | 合规 |
| `finance_inv_notes` | 有 | 有 | - | 有 | 合规 |
| `finance_inv_vals` | 有 | 有 | - | 有 | 合规 |
| `finance_liabs` | 有 | 有 | - | 有 | 合规 |
| `finance_reals` | 有 | 有 | - | 有 | 合规 |
| `finance_reasons` | 有 | 有 | - | 有 | 合规 |
| `finance_settings` | 有 | 豁免 | 有 | 有 | 合规（豁免 live） |
| `finance_snapshot_account_subs` | 有 | 豁免 | 有 | 有 | 合规（豁免 live） |
| `finance_snapshot_accounts` | 有 | 豁免 | 有 | 有 | 合规（豁免 live） |
| `finance_snapshot_fx` | 有 | 豁免 | 有 | 有 | 合规（豁免 live） |
| `finance_snapshots` | 有 | 豁免 | 有 | 有 | 合规（豁免 live） |
| `finance_quant_assets` | 有 | 有 | - | 无 | 合规 |
| `finance_fund_cache` | 有 | 有 | - | 无 | 合规 |

### model_usage

表数 1；合规 1；待修 0；豁免 0；有触发器表 0。

| 表 | raw | live | 豁免注释 | 触发器 | 判定 |
|---|---|---|---|---|---|
| `model_usage_logs` | 有 | 有 | - | 无 | 合规 |

### pixel_art

表数 3；合规 3；待修 0；豁免 2；有触发器表 0。

| 表 | raw | live | 豁免注释 | 触发器 | 判定 |
|---|---|---|---|---|---|
| `pixel_artworks` | 有 | 有 | - | 无 | 合规 |
| `pixel_asset_refs` | 有 | 豁免 | 有 | 无 | 合规（豁免 live） |
| `visual_settings` | 有 | 豁免 | 有 | 无 | 合规（豁免 live） |

### project_manager

表数 5；合规 5；待修 0；豁免 0；有触发器表 5。

| 表 | raw | live | 豁免注释 | 触发器 | 判定 |
|---|---|---|---|---|---|
| `pm_stage_templates` | 有 | 有 | - | 有 | 合规 |
| `pm_projects` | 有 | 有 | - | 有 | 合规 |
| `pm_stages` | 有 | 有 | - | 有 | 合规 |
| `pm_prompt_drafts` | 有 | 有 | - | 有 | 合规 |
| `pm_results` | 有 | 有 | - | 有 | 合规 |

### promptgen

表数 5；合规 5；待修 0；豁免 0；有触发器表 0。

| 表 | raw | live | 豁免注释 | 触发器 | 判定 |
|---|---|---|---|---|---|
| `pg_assets` | 有 | 有 | - | 无 | 合规 |
| `pg_flows` | 有 | 有 | - | 无 | 合规 |
| `pg_modules` | 有 | 有 | - | 无 | 合规 |
| `pg_tasks` | 有 | 有 | - | 无 | 合规 |
| `pg_flow_groups` | 有 | 有 | - | 无 | 合规 |

### russian

表数 5；合规 5；待修 0；豁免 1；有触发器表 0。

| 表 | raw | live | 豁免注释 | 触发器 | 判定 |
|---|---|---|---|---|---|
| `items` | 有 | 有 | - | 无 | 合规 |
| `item_stats` | 有 | 豁免 | 有 | 无 | 合规（豁免 live） |
| `review_logs` | 有 | 有 | - | 无 | 合规 |
| `daily_logs` | 有 | 有 | - | 无 | 合规 |
| `themes` | 有 | 有 | - | 无 | 合规 |

### schedule

表数 3；合规 3；待修 0；豁免 0；有触发器表 0。

| 表 | raw | live | 豁免注释 | 触发器 | 判定 |
|---|---|---|---|---|---|
| `schedule_assets` | 有 | 有 | - | 无 | 合规 |
| `schedule_week_plans` | 有 | 有 | - | 无 | 合规 |
| `schedule_tasks` | 有 | 有 | - | 无 | 合规 |

### screeps

表数 3；合规 3；待修 0；豁免 0；有触发器表 0。

| 表 | raw | live | 豁免注释 | 触发器 | 判定 |
|---|---|---|---|---|---|
| `screeps_assets` | 有 | 有 | - | 无 | 合规 |
| `screeps_units` | 有 | 有 | - | 无 | 合规 |
| `screeps_modules` | 有 | 有 | - | 无 | 合规 |

### urlarch

表数 3；合规 3；待修 0；豁免 0；有触发器表 0。

| 表 | raw | live | 豁免注释 | 触发器 | 判定 |
|---|---|---|---|---|---|
| `urlarch_assets` | 有 | 有 | - | 无 | 合规 |
| `urlarch_groups` | 有 | 有 | - | 无 | 合规 |
| `urlarch_links` | 有 | 有 | - | 无 | 合规 |

## 3. 豁免清单（9 张）

| 插件 | 表 | 理由 | 注释 |
|---|---|---|---|
| book_reader | reader_placeholders | 导入失败片段，可由导入源重建 | 有 |
| finance | finance_settings | 配置类，可按默认重建 | 有 |
| finance | finance_snapshot_account_subs | 快照子项，可由 snapshots/accounts 重建 | 有 |
| finance | finance_snapshot_accounts | 快照账户，可由 accounts/估值重建 | 有 |
| finance | finance_snapshot_fx | 快照汇率，可由 fx_history 重建 | 有 |
| finance | finance_snapshots | 快照头，可由账户/估值/汇率重建 | 有 |
| pixel_art | pixel_asset_refs | 资产引用索引，可由作品/资产重建 | 有 |
| pixel_art | visual_settings | 视觉设置，可按默认重建 | 有 |
| russian | item_stats | SRS 派生，可由 items+review_logs 重建 | 有 |

## 4. 触发器方案分布

- 触发器：book_reader（22）、finance（29）、project_manager（10）。
- 显式写入：bg_library、russian（items/themes 等）、pixel_art、promptgen、schedule、screeps、urlarch、ai、aidebug、model_usage。
- 触发器均不写入 `schema.sql`，由各插件 `migrate.py` 在补列后按 PRAGMA 列生成、先删后建；依赖 SQLite JSON1（≥3.38）。

## 5. 与 round 75–78 记录的差异

- 总数与执行记录一致：67 表、9 豁免、61 触发器。
- round 79 首次扫描曾把 `item_stats` 注释中的 `live_json` 误判为列，已修正为按列定义解析；最终结果全部合规。
- 无新增待修项；`Server.start` 仍为唯一 pending（非 schema 问题）。
