-- finance 插件 schema（从主库 sqlite_master 恢复）


CREATE TABLE IF NOT EXISTS finance_account_groups (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT NOT NULL DEFAULT '',
  live_json TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS finance_accounts (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT '',
  group_id   TEXT,
  cur        TEXT NOT NULL DEFAULT 'CNY',
  balance    REAL NOT NULL DEFAULT 0,
  date       TEXT,
  include    INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT NOT NULL DEFAULT '',
  live_json TEXT NOT NULL DEFAULT '',
    FOREIGN KEY(group_id) REFERENCES finance_account_groups(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS finance_fx_history (
  currency TEXT NOT NULL,
  date     TEXT NOT NULL,
  rate     REAL NOT NULL,
  raw_json TEXT NOT NULL DEFAULT '',
  live_json TEXT NOT NULL DEFAULT '',
    PRIMARY KEY(currency, date)
);

CREATE TABLE IF NOT EXISTS finance_inv_accounts (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  cur        TEXT NOT NULL DEFAULT 'CNY',
  note       TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT NOT NULL DEFAULT '',
  live_json TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS finance_inv_holdings (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL DEFAULT '',
  acct_id    TEXT,
  cur        TEXT NOT NULL DEFAULT 'CNY',
  date       TEXT,
  cash_only  INTEGER NOT NULL DEFAULT 0,
  price      REAL NOT NULL DEFAULT 0,
  qty        REAL NOT NULL DEFAULT 0,
  cost       REAL NOT NULL DEFAULT 0,
  value      REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT NOT NULL DEFAULT '',
  live_json TEXT NOT NULL DEFAULT '',
    FOREIGN KEY(acct_id) REFERENCES finance_accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS finance_inv_lots (
  id         TEXT PRIMARY KEY,
  holding_id TEXT NOT NULL,
  date       TEXT,
  qty        REAL NOT NULL DEFAULT 0,
  cost       REAL NOT NULL DEFAULT 0,
  px         REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT NOT NULL DEFAULT '',
  live_json TEXT NOT NULL DEFAULT '',
    FOREIGN KEY(holding_id) REFERENCES finance_inv_holdings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS finance_inv_note_groups (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT NOT NULL DEFAULT '',
  live_json TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS finance_inv_notes (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL DEFAULT '',
  body       TEXT NOT NULL DEFAULT '',
  date       TEXT,
  gid        TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT NOT NULL DEFAULT '',
  live_json TEXT NOT NULL DEFAULT '',
    FOREIGN KEY(gid) REFERENCES finance_inv_note_groups(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS finance_inv_vals (
  holding_id TEXT NOT NULL,
  date       TEXT NOT NULL,
  seq        INTEGER NOT NULL DEFAULT 0,
  price      REAL,
  value      REAL NOT NULL DEFAULT 0,
  raw_json TEXT NOT NULL DEFAULT '',
  live_json TEXT NOT NULL DEFAULT '',
    PRIMARY KEY(holding_id, date, seq),
  FOREIGN KEY(holding_id) REFERENCES finance_inv_holdings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS finance_liabs (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL DEFAULT '',
  cur        TEXT NOT NULL DEFAULT 'CNY',
  principal  REAL NOT NULL DEFAULT 0,
  remain     REAL NOT NULL DEFAULT 0,
  rate       REAL NOT NULL DEFAULT 0,
  due        TEXT,
  note       TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT NOT NULL DEFAULT '',
  live_json TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS finance_reals (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  cat        TEXT NOT NULL DEFAULT '',
  cur        TEXT NOT NULL DEFAULT 'CNY',
  cost       REAL NOT NULL DEFAULT 0,
  value      REAL NOT NULL DEFAULT 0,
  date       TEXT,
  note       TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT NOT NULL DEFAULT '',
  live_json TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS finance_reasons (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT NOT NULL DEFAULT '',
  live_json TEXT NOT NULL DEFAULT ''
);

-- raw_json 为迁移时快照；live_json 豁免：配置类，可按默认值重建
CREATE TABLE IF NOT EXISTS finance_settings (
  id               INTEGER PRIMARY KEY CHECK(id = 1),
  base             TEXT    NOT NULL DEFAULT 'CNY',
  goals            REAL    NOT NULL DEFAULT 0,
  fx_json          TEXT    NOT NULL DEFAULT '{}',
  acct_types_json  TEXT    NOT NULL DEFAULT '[]',
  ui_json          TEXT    NOT NULL DEFAULT '{}',
  fx_date          TEXT,
  migrated_at      TEXT,
  migration_source TEXT,
  updated_at       TEXT    NOT NULL,
  raw_json TEXT NOT NULL DEFAULT ''
);

-- raw_json 为迁移时快照；live_json 豁免：可由 finance_snapshot_accounts/accounts 重建
CREATE TABLE IF NOT EXISTS finance_snapshot_account_subs (
  snapshot_id INTEGER NOT NULL,
  account_id  TEXT NOT NULL,
  seq         INTEGER NOT NULL DEFAULT 0,
  why         TEXT NOT NULL DEFAULT '',
  val         REAL NOT NULL DEFAULT 0,
  raw_json TEXT NOT NULL DEFAULT '',
    PRIMARY KEY(snapshot_id, account_id, seq),
  FOREIGN KEY(snapshot_id, account_id)
    REFERENCES finance_snapshot_accounts(snapshot_id, account_id) ON DELETE CASCADE
);

-- raw_json 为迁移时快照；live_json 豁免：可由 accounts/估值重建
CREATE TABLE IF NOT EXISTS finance_snapshot_accounts (
  snapshot_id INTEGER NOT NULL,
  account_id  TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  cur         TEXT NOT NULL DEFAULT 'CNY',
  val         REAL NOT NULL DEFAULT 0,
  base        REAL NOT NULL DEFAULT 0,
  why         TEXT,
  seq         INTEGER NOT NULL DEFAULT 0,
  raw_json TEXT NOT NULL DEFAULT '',
    PRIMARY KEY(snapshot_id, account_id),
  FOREIGN KEY(snapshot_id) REFERENCES finance_snapshots(id) ON DELETE CASCADE
);

-- raw_json 为迁移时快照；live_json 豁免：可由 finance_fx_history 重建
CREATE TABLE IF NOT EXISTS finance_snapshot_fx (
  snapshot_id INTEGER NOT NULL,
  currency    TEXT NOT NULL,
  rate        REAL NOT NULL,
  raw_json TEXT NOT NULL DEFAULT '',
    PRIMARY KEY(snapshot_id, currency),
  FOREIGN KEY(snapshot_id) REFERENCES finance_snapshots(id) ON DELETE CASCADE
);

-- raw_json 为迁移时快照；live_json 豁免：可由账户/估值/汇率重建
CREATE TABLE IF NOT EXISTS finance_snapshots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  date         TEXT NOT NULL UNIQUE,
  mode         TEXT NOT NULL DEFAULT 'detail',
  total_assets REAL NOT NULL DEFAULT 0,
  total_liab   REAL NOT NULL DEFAULT 0,
  net          REAL NOT NULL DEFAULT 0,
  fin          REAL NOT NULL DEFAULT 0,
  real         REAL NOT NULL DEFAULT 0,
  inv          REAL NOT NULL DEFAULT 0,
  liab         REAL NOT NULL DEFAULT 0,
  note         TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  raw_json TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_finance_accounts_group ON finance_accounts(group_id);

CREATE INDEX IF NOT EXISTS idx_finance_fx_history_date ON finance_fx_history(date);

CREATE INDEX IF NOT EXISTS idx_finance_inv_holdings_acct ON finance_inv_holdings(acct_id);

CREATE INDEX IF NOT EXISTS idx_finance_inv_lots_holding ON finance_inv_lots(holding_id);

CREATE INDEX IF NOT EXISTS idx_finance_inv_notes_gid ON finance_inv_notes(gid);

CREATE INDEX IF NOT EXISTS idx_finance_inv_vals_holding ON finance_inv_vals(holding_id, date);

CREATE INDEX IF NOT EXISTS idx_finance_snapshots_date ON finance_snapshots(date);


-- 内容资产 / 基金缓存（batch2）
CREATE TABLE IF NOT EXISTS finance_quant_assets (
  asset_key  TEXT PRIMARY KEY,
  kind       TEXT NOT NULL DEFAULT '',
  raw_json   TEXT NOT NULL,
  live_json  TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS finance_fund_cache (
  asset_key  TEXT PRIMARY KEY,
  kind       TEXT NOT NULL DEFAULT '',
  raw_json   TEXT NOT NULL,
  live_json  TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

