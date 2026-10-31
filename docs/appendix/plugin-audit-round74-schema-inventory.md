# 插件 schema 全量盘点（round 75）

## 0. 依据与边界

- 依据：白皮书 §五（G2 口径）、守则 §4、round 71 审查报告、round 74 B1 结论。
- 边界：只读 6 个插件的 `schema.sql` / `migrate.py` / 写入路径（`repo.py` 等）；不读 DB 内容；未改任何 schema。
- 日期：2026-10-31；round：75。本次无背景库数据（背景库不可用，未导入）。
- 口径：`raw_json` = 迁移时当前状态 JSON 快照（非历史原文）；`live_json` = 当前编辑态；派生/缓存/快照表可豁免 `live_json`，但保留 `raw_json` 或注释可重建来源。

## 1. 汇总

- 6 个插件共 **49 张表**。
- 有 `raw_json`：4 张（reader_placeholders、reader_bookmarks、finance_quant_assets、finance_fund_cache）；缺 **45** 张。
- 有 `live_json`：3 张（reader_bookmarks、finance_quant_assets、finance_fund_cache）；缺 **46** 张。
- 豁免 `live_json`：**9** 张（详见 §3）。
- 第一批（bg_library、book_reader、russian）：需补 `raw_json` **20** 张、需补 `live_json` **19** 张。
- 第二批（finance、pixel_art、project_manager）：需补 `raw_json` **25** 张、需补 `live_json` **18** 张（含待确认配置表）。

## 2. 逐表清单

### 2.1 bg_library（4 表，全部内容/日志）

| 表 | raw | live | 用途 | 判定 | 回填/备注 |
|---|---|---|---|---|---|
| bg_nodes | 无 | 无 | 背景节点（内容） | 必须双列 | raw=当前行 JSON；live 回填=raw |
| bg_versions | 无 | 无 | 版本历史（日志） | 必须双列 | 同上 |
| file_notes | 无 | 无 | 文件说明（内容） | 必须双列 | 同上 |
| db_rules | 无 | 无 | 数据库规则（内容） | 必须双列 | 同上 |

### 2.2 book_reader（13 表）

| 表 | raw | live | 用途 | 判定 | 回填/备注 |
|---|---|---|---|---|---|
| reader_books | 无 | 无 | 书籍（内容） | 必须双列 | raw=行 JSON；live=raw |
| reader_sections | 无 | 无 | 章节（内容） | 必须双列 | 同上 |
| reader_sentences | 无 | 无 | 句子（内容） | 必须双列 | 同上 |
| reader_placeholders | 有 | 无 | 导入失败片段（派生快照） | 豁免 live | 可由导入源重建；保留 raw |
| reader_words | 无 | 无 | 生词（内容） | 必须双列 | raw=行 JSON；live=raw |
| reader_phrases | 无 | 无 | 短语（内容） | 必须双列 | 同上 |
| reader_translation_pairs | 无 | 无 | 互译对（内容） | 必须双列 | 同上 |
| reader_marks | 无 | 无 | 标记（内容） | 必须双列 | 同上 |
| reader_import_batches | 无 | 无 | 导入批次（日志） | 必须双列 | 同上 |
| reader_cleaning_tasks | 无 | 无 | 清洗任务（日志） | 必须双列 | 同上 |
| reader_cleaning_records | 无 | 无 | 清洗记录（日志） | 必须双列 | 同上 |
| reader_return_errors | 无 | 无 | 回传错误（日志） | 必须双列 | 同上 |
| reader_bookmarks | 有 | 有 | 阅读书签（内容） | 已合规 | 无需改动 |

### 2.3 finance（19 表）

| 表 | raw | live | 用途 | 判定 | 回填/备注 |
|---|---|---|---|---|---|
| finance_account_groups | 无 | 无 | 账户分组（内容） | 必须双列 | raw=行 JSON；live=raw |
| finance_accounts | 无 | 无 | 账户（内容） | 必须双列 | 同上 |
| finance_fx_history | 无 | 无 | 汇率历史（内容/日志） | 必须双列 | 同上 |
| finance_inv_accounts | 无 | 无 | 投资账户（内容） | 必须双列 | 同上 |
| finance_inv_holdings | 无 | 无 | 持仓（内容） | 必须双列 | 同上 |
| finance_inv_lots | 无 | 无 | 批次（内容） | 必须双列 | 同上 |
| finance_inv_note_groups | 无 | 无 | 笔记分组（内容） | 必须双列 | 同上 |
| finance_inv_notes | 无 | 无 | 笔记（内容） | 必须双列 | 同上 |
| finance_inv_vals | 无 | 无 | 估值（内容） | 必须双列 | 同上 |
| finance_liabs | 无 | 无 | 负债（内容） | 必须双列 | 同上 |
| finance_reals | 无 | 无 | 实值（内容） | 必须双列 | 同上 |
| finance_reasons | 无 | 无 | 归因（内容） | 必须双列 | 同上 |
| finance_settings | 无 | 无 | 插件配置 | **待确认** | 建议 raw 必需、豁免 live（可重建默认） |
| finance_snapshot_account_subs | 无 | 无 | 快照子项（派生） | 豁免 live | raw=行 JSON；可由 accounts 重建 |
| finance_snapshot_accounts | 无 | 无 | 快照账户（派生） | 豁免 live | 同上 |
| finance_snapshot_fx | 无 | 无 | 快照汇率（派生） | 豁免 live | 可由 fx_history 重建 |
| finance_snapshots | 无 | 无 | 快照头（派生） | 豁免 live | 可由账户/估值重建 |
| finance_quant_assets | 有 | 有 | 量化资产（内容） | 已合规 | 无需改动 |
| finance_fund_cache | 有 | 有 | 基金缓存（缓存） | 已合规 | 无需改动 |

### 2.4 pixel_art（3 表）

| 表 | raw | live | 用途 | 判定 | 回填/备注 |
|---|---|---|---|---|---|
| pixel_artworks | 无 | 无 | 作品（内容） | 必须双列 | raw=行 JSON；live=raw |
| pixel_asset_refs | 无 | 无 | 资产引用（派生索引） | 豁免 live | raw=行 JSON；可由作品/资产重建 |
| visual_settings | 无 | 无 | 视觉设置（配置/UI 偏好） | **待确认** | 建议 raw 必需、豁免 live（可重建默认） |

### 2.5 project_manager（5 表）

| 表 | raw | live | 用途 | 判定 | 回填/备注 |
|---|---|---|---|---|---|
| pm_stage_templates | 无 | 无 | 阶段模板（内容） | 必须双列 | raw=行 JSON；live=raw |
| pm_projects | 无 | 无 | 项目（内容） | 必须双列 | 同上 |
| pm_stages | 无 | 无 | 阶段（内容） | 必须双列 | 同上 |
| pm_prompt_drafts | 无 | 无 | 提示词草稿（内容） | 必须双列 | 同上 |
| pm_results | 无 | 无 | 结果（内容） | 必须双列 | 同上 |

### 2.6 russian（5 表）

| 表 | raw | live | 用途 | 判定 | 回填/备注 |
|---|---|---|---|---|---|
| items | 无 | 无 | 知识条目（内容） | 必须双列 | raw=行 JSON；live=raw |
| item_stats | 无 | 无 | SRS 状态（派生） | 豁免 live | raw=行 JSON；可由 items+review_logs 重建 |
| review_logs | 无 | 无 | 复习流水（日志） | 必须双列 | raw=行 JSON；live=raw |
| daily_logs | 无 | 无 | 每日记录（日志） | 必须双列 | 同上 |
| themes | 无 | 无 | 主题（内容） | 必须双列 | 同上 |

## 3. 豁免 `live_json` 清单（9 张）

| 表 | 理由 |
|---|---|
| reader_placeholders | 导入失败片段的派生快照，可由导入源重建；已有 raw_json |
| item_stats | SRS 派生状态，可由 items + review_logs 重建 |
| finance_snapshot_account_subs | 快照派生，可由 accounts 重建 |
| finance_snapshot_accounts | 快照派生 |
| finance_snapshot_fx | 快照派生，可由 fx_history 重建 |
| finance_snapshots | 快照头，可由账户/估值重建 |
| finance_settings | 配置项，可按默认值重建（**待用户确认**） |
| pixel_asset_refs | 资产引用索引，可由作品/资产重建 |
| visual_settings | 视觉设置，可按默认值重建（**待用户确认**） |

## 4. 回填规则

1. `raw_json`：`json.dumps({列名: 当前值}, ensure_ascii=False)`；迁移时对每行生成，写入新增列。存量值视为“迁移时快照”。
2. `live_json`：对“必须双列”的表，迁移时回填 `live_json=raw_json`；写入路径 INSERT 同时写 raw/live，UPDATE 写 live 保留 raw。
3. 豁免表：只补 `raw_json`，`live_json` 保持不建；在 schema 注释与 README 写明可重建来源。
4. 读取：已有读取路径继续用业务列；若某处按 JSON 读取，必须有 `COALESCE(NULLIF(live_json,''),raw_json)` 回退。当前 6 插件中仅 `reader_bookmarks`/`finance_quant_assets`/`finance_fund_cache` 有 JSON 读取，且已合规。
5. 迁移幂等：`PRAGMA table_info` 检查列 → `ALTER TABLE ADD COLUMN` → 仅对空值回填；`migrate.py` 末尾 commit。

## 5. 与 round 74 结论的差异

- round 74 只核实了 bg_library/book_reader/russian 的缺 raw 情况；本轮补齐 finance/pixel_art/project_manager 的逐表数据。
- 新增发现：`finance_settings`、`visual_settings` 属配置类，G2 未覆盖；需用户确认豁免方式。
- 新增发现：`book_reader` 有大量**位置式 INSERT**（`INSERT INTO <table> VALUES(?,...)`），加列后必须改为显式列名或同步扩展参数，否则运行时报列数不匹配；这是第一批迁移的主要风险点。

## 6. 第一批迁移清单（待确认后执行）

- **补 raw**（20）：bg_library 4；book_reader 11（不含 reader_placeholders/bookmarks）；russian 5。
- **补 live**（19）：bg_library 4；book_reader 11；russian items/review_logs/daily_logs/themes（item_stats 豁免）。
- **仅豁免 live**：book_reader reader_placeholders；russian item_stats。
- **写入路径同步**：bg_library（4 处 INSERT）、book_reader（20 处 INSERT，含位置式）、russian（items/review_logs/daily_logs）。读取保持原路径（无 JSON 读取）。
- **验证**：临时库两次 migrate；真实库启动迁移；全量 13。

## 7. 待用户确认

1. `finance_settings`、`visual_settings` 是否允许“raw 必需 + 豁免 live + 注释可重建默认”？
2. `book_reader` 位置式 INSERT 改写为显式列名，是否在本批执行（若不改，加列会破坏现有写入）？
3. 第一批是否按 3 插件全做；若风险偏高，可先做 bg_library + russian（9 表），book_reader 留 round 76。

## 8. 执行状态（round 75，用户已确认）

- **配置表豁免**：`finance_settings`、`visual_settings` 允许“raw 必需 + 豁免 live + 注释可重建默认”；列入豁免清单，待第二批处理。
- **第一批范围**：用户选择 **bg_library + russian**（9 表）；`book_reader` 因约 20 处位置式 INSERT 需改写，留 round 76。
- **数据库备份**：`data/backup/round75_db/russian_tutor.db.bak`，9023488 B，SHA256 `8E526BB9C678EFE9AAC367CF71A6EA764195BA8EFA492A0A3FADF393CD6A6F58`（SQLite 在线备份，integrity_check=ok）。
- **已执行**：
  - bg_library 4 表补 `raw_json`+`live_json`（迁移快照），新增 `migrate.py` 并在 manifest 声明；写入 4 路径同步。
  - russian 5 表补 `raw_json`；items/themes/review_logs/daily_logs 同时补 `live_json`；item_stats 豁免 live；migrate 幂等；写入路径同步。
- **验证**：旧库迁移连跑两次 OK；写路径实测 raw 非空且 live==raw；全量 13 见 round 75 报告。
- **剩余**：book_reader、finance、pixel_art、project_manager 留 round 76。
