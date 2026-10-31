"""finance 旧库迁移：补 raw_json/live_json（迁移时快照）并安装同步触发器。

- 12 张内容/日志表：raw_json + live_json；INSERT 填 raw/live，UPDATE 刷 live 保留 raw。
- 5 张豁免表（settings + 4 快照）：只补 raw_json；live_json 豁免（可重建来源见 schema 注释）。
幂等：PRAGMA 检查 → ALTER → 空值回填 → 触发器先删后建。
"""
from __future__ import annotations

import json

_LIVE_TABLES = (
    "finance_account_groups", "finance_accounts", "finance_fx_history",
    "finance_inv_accounts", "finance_inv_holdings", "finance_inv_lots",
    "finance_inv_note_groups", "finance_inv_notes", "finance_inv_vals",
    "finance_liabs", "finance_reals", "finance_reasons",
)
_RAW_ONLY_TABLES = (
    "finance_settings", "finance_snapshot_account_subs", "finance_snapshot_accounts",
    "finance_snapshot_fx", "finance_snapshots",
)


def _drop_triggers(conn) -> None:
    for row in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'trg_finance%'"
    ).fetchall():
        conn.execute(f"DROP TRIGGER IF EXISTS {row['name']}")


def _business_cols(conn, table: str) -> list[str]:
    return [c["name"] for c in conn.execute(f"PRAGMA table_info({table})")
            if c["name"] not in ("raw_json", "live_json")]


def _add_and_backfill(conn, table: str, with_live: bool) -> None:
    cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
    if not cols:
        return
    for column in (("raw_json", "live_json") if with_live else ("raw_json",)):
        if column not in cols:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} TEXT NOT NULL DEFAULT ''")
    business = _business_cols(conn, table)
    where = "raw_json='' OR live_json=''" if with_live else "raw_json=''"
    rows = conn.execute(
        f"SELECT rowid AS _rid, {', '.join(business)} FROM {table} WHERE {where}"
    ).fetchall()
    for row in rows:
        payload = json.dumps({c: row[c] for c in business}, ensure_ascii=False, default=str)
        if with_live:
            conn.execute(f"UPDATE {table} SET raw_json=?, live_json=? WHERE rowid=?",
                         (payload, payload, row["_rid"]))
        else:
            conn.execute(f"UPDATE {table} SET raw_json=? WHERE rowid=?", (payload, row["_rid"]))


def _install_triggers(conn) -> None:
    for table in _LIVE_TABLES:
        cols = _business_cols(conn, table)
        if not cols:
            continue
        j = "json_object(" + ", ".join(f"'{c}', NEW.{c}" for c in cols) + ")"
        conn.execute(
            f"CREATE TRIGGER IF NOT EXISTS trg_{table}_json_ins AFTER INSERT ON {table} BEGIN "
            f"UPDATE {table} SET raw_json={j}, live_json={j} WHERE rowid=NEW.rowid; END"
        )
        conn.execute(
            f"CREATE TRIGGER IF NOT EXISTS trg_{table}_json_upd AFTER UPDATE ON {table} BEGIN "
            f"UPDATE {table} SET live_json={j} WHERE rowid=NEW.rowid; END"
        )
    for table in _RAW_ONLY_TABLES:
        cols = _business_cols(conn, table)
        if not cols:
            continue
        j = "json_object(" + ", ".join(f"'{c}', NEW.{c}" for c in cols) + ")"
        conn.execute(
            f"CREATE TRIGGER IF NOT EXISTS trg_{table}_json_ins AFTER INSERT ON {table} BEGIN "
            f"UPDATE {table} SET raw_json={j} WHERE rowid=NEW.rowid; END"
        )


def migrate(conn) -> None:
    _drop_triggers(conn)
    for table in _LIVE_TABLES:
        _add_and_backfill(conn, table, with_live=True)
    for table in _RAW_ONLY_TABLES:
        _add_and_backfill(conn, table, with_live=False)
    _install_triggers(conn)
    conn.commit()
