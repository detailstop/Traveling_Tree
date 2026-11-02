---
id: finance
name: 记账本与理财量化
version: 1.0
kind: functional
has_ui: true
has_backend: true
db_module_key: finance
routes_prefix: /api/plugin/finance
summary: 日频快照 · 多账户/多币种 · 资产负债 · 归因
icon: 💰
entries: [finance, finquant]
tables: [finance_account_groups, finance_accounts, finance_fx_history, finance_inv_accounts, finance_inv_holdings, finance_inv_lots, finance_inv_note_groups, finance_inv_notes, finance_inv_vals, finance_liabs, finance_reals, finance_reasons, finance_settings, finance_snapshot_account_subs, finance_snapshot_accounts, finance_snapshot_fx, finance_snapshots, finance_quant_assets, finance_fund_cache]
data_dirs: [finance]
shared_features: []
provides: []
consumes: [webchat, ai]
market_package: true
source: market
known_limits: Release v1，download_url 见远程 index
sensitive_data: [data/plugins/finance/fixtures/rt_fin.json]
---
# 记账本与理财量化 信息卡

## 职责
日频快照 · 多账户/多币种 · 资产负债 · 归因

## 入口与路由
- entry：finance、finquant
- 后端路由：/api/plugin/finance

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

## 依赖
- provides：无
- consumes：无

## 注意事项
- 详见 README.md；本卡为市场精简信息，关键字段由校验脚本与 manifest/schema 保持一致。
