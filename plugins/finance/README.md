# 记账本与理财量化（finance）

## 职责
记账本与理财量化：账户、流水、快照、基金与量化。

## 入口与路由
- 分类：functional（有卡片，2 entries）
- 入口：entry `finance` → `feature_finance.js`；entry `finquant` → `feature_finquant.js`
- 后端：`backend.py`；路由前缀 `/api/plugin/finance/*`，子路径见 `backend.py::handle`

## 数据表
- `finance_account_groups`
- `finance_accounts`
- `finance_fx_history`
- `finance_inv_accounts`
- `finance_inv_holdings`
- `finance_inv_lots`
- `finance_inv_note_groups`
- `finance_inv_notes`
- `finance_inv_vals`
- `finance_liabs`
- `finance_reals`
- `finance_reasons`
- `finance_settings`
- `finance_snapshot_account_subs`
- `finance_snapshot_accounts`
- `finance_snapshot_fx`
- `finance_snapshots`
- `finance_quant_assets`
- `finance_fund_cache`

- raw/live 状态：round 77 已补：12 张内容/日志表 raw+live（触发器同步）；finance_settings 与 4 张 *snapshot* 表仅 raw（豁免 live，可重建来源见 schema 注释）；quant_assets/fund_cache 原已合规
- 触发器说明（round 78 确认）：
  1. 依赖 SQLite JSON1（≥3.38 默认内置；本机 3.45 可用），目标环境需具备。
  2. 未来给 finance_* 加列后需重建触发器；`migrate.py` 按 PRAGMA 列生成，新增列需同步 JSON 字段。
  3. raw/live 由 AFTER INSERT/UPDATE 触发器维护（含 upsert DO UPDATE），业务 SQL 不显式写入；`repo.py` 中看不到 raw/live 属正常。

## 依赖
- `data_dirs: ["finance"]`
- 调用：`/api/plugin/webchat/*`、`/api/plugin/ai/*`
- 跨插件关系：`consumes: ["webchat", "ai"]`（webchat / ai 为宿主内插件，非第三方包；本插件无 Python 第三方依赖，故不声明 `dependencies`）
- 迁移输入：`data/plugins/finance/fixtures/rt_fin.json`（敏感，不读正文）

## 注意事项
- 整状态 PUT 会重写 `finance_*`，依赖事务。
- fixture 含真实财务数据，禁止提交/外传。
- 多入口命名见 G6（`feature_<entry>.js`）。
