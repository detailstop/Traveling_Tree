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

- raw/live 状态：`finance_quant_assets`/`finance_fund_cache` 双列；其余 17 表缺双列（round 71 blocker，按 G2 待 round 73 处理）

## 依赖
- `data_dirs: ["finance"]`
- 调用：`/api/plugin/webchat/*`、`/api/plugin/ai/*`
- 迁移输入：`data/plugins/finance/fixtures/rt_fin.json`（敏感，不读正文）

## 注意事项
- 整状态 PUT 会重写 `finance_*`，依赖事务。
- fixture 含真实财务数据，禁止提交/外传。
- 多入口命名见 G6（`feature_<entry>.js`）。
