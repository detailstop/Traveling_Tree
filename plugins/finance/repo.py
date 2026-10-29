"""finance 插件 SQL 层：全部 finance_* 表。"""

import json
from datetime import datetime, timezone

from db.connection import get_conn


# finance_*（记账本独立模块；本段只操作 finance_* 表）
# 所有 SQL 集中在本段；插件 backend 与迁移脚本只调本段公共函数。
# ============================================================

_FIN_TABLES = (
    "finance_snapshot_account_subs", "finance_snapshot_accounts", "finance_snapshot_fx",
    "finance_snapshots", "finance_inv_vals", "finance_inv_lots", "finance_inv_holdings",
    "finance_inv_notes", "finance_inv_note_groups", "finance_inv_accounts",
    "finance_accounts", "finance_account_groups", "finance_liabs", "finance_reals",
    "finance_reasons", "finance_fx_history", "finance_settings",
)


def _fin_now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _fin_json(value, fallback):
    try:
        return json.loads(value) if isinstance(value, str) and value else fallback
    except (TypeError, ValueError):
        return fallback


def _fin_dump(value, fallback):
    if value is None:
        value = fallback
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _fin_num(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _fin_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _fin_settings(conn) -> dict:
    row = conn.execute("SELECT * FROM finance_settings WHERE id=1").fetchone()
    if not row:
        return {"base": "CNY", "goals": 0.0, "fx": {"CNY": 1}, "fxDate": None,
                "acctTypes": [], "settingsCollapsed": {}, "migrated_at": None,
                "migration_source": None}
    return {
        "base": row["base"] or "CNY",
        "goals": _fin_num(row["goals"]),
        "fx": _fin_json(row["fx_json"], {"CNY": 1}),
        "fxDate": row["fx_date"],
        "acctTypes": _fin_json(row["acct_types_json"], []),
        "settingsCollapsed": _fin_json(row["ui_json"], {}),
        "migrated_at": row["migrated_at"],
        "migration_source": row["migration_source"],
    }


def finance_get_state() -> dict:
    """返回记账本完整状态（UI 原 rt_fin 形状，不含 localStorage）。"""
    conn = get_conn()
    st = _fin_settings(conn)
    groups = [{"id": r["id"], "name": r["name"]} for r in conn.execute(
        "SELECT id,name FROM finance_account_groups ORDER BY sort_order,id")]
    accounts = [{"id": r["id"], "name": r["name"], "type": r["type"],
                 "group": r["group_id"] or "ungrouped", "cur": r["cur"],
                 "balance": r["balance"], "date": r["date"],
                 "include": bool(r["include"])} for r in conn.execute(
        "SELECT * FROM finance_accounts ORDER BY sort_order,id")]
    liabs = [{"id": r["id"], "name": r["name"], "kind": r["kind"], "cur": r["cur"],
              "principal": r["principal"], "remain": r["remain"], "rate": r["rate"],
              "due": r["due"] or "", "note": r["note"]} for r in conn.execute(
        "SELECT * FROM finance_liabs ORDER BY sort_order,id")]
    reals = [{"id": r["id"], "name": r["name"], "cat": r["cat"], "cur": r["cur"],
              "cost": r["cost"], "value": r["value"], "date": r["date"],
              "note": r["note"]} for r in conn.execute(
        "SELECT * FROM finance_reals ORDER BY sort_order,id")]
    reasons = [r["name"] for r in conn.execute(
        "SELECT name FROM finance_reasons ORDER BY sort_order,id")]
    inv_accounts = [{"id": r["id"], "name": r["name"], "cur": r["cur"],
                     "note": r["note"]} for r in conn.execute(
        "SELECT * FROM finance_inv_accounts ORDER BY sort_order,id")]
    inv_holdings = []
    for r in conn.execute("SELECT * FROM finance_inv_holdings ORDER BY sort_order,id"):
        h = {"id": r["id"], "name": r["name"], "type": r["type"],
             "acctId": r["acct_id"] or "", "cur": r["cur"], "date": r["date"],
             "cashOnly": bool(r["cash_only"]), "price": r["price"],
             "qty": r["qty"], "cost": r["cost"], "value": r["value"],
             "lots": [], "vals": []}
        for lot in conn.execute(
                "SELECT * FROM finance_inv_lots WHERE holding_id=? ORDER BY sort_order,id",
                (r["id"],)):
            h["lots"].append({"id": lot["id"], "date": lot["date"],
                              "qty": lot["qty"], "cost": lot["cost"], "px": lot["px"]})
        for val in conn.execute(
                "SELECT * FROM finance_inv_vals WHERE holding_id=? ORDER BY date,seq",
                (r["id"],)):
            h["vals"].append({"date": val["date"], "price": val["price"],
                              "value": val["value"]})
        inv_holdings.append(h)
    note_groups = [{"id": r["id"], "name": r["name"]} for r in conn.execute(
        "SELECT * FROM finance_inv_note_groups ORDER BY sort_order,id")]
    notes = [{"id": r["id"], "title": r["title"], "body": r["body"],
              "date": r["date"], "gid": r["gid"] or ""} for r in conn.execute(
        "SELECT * FROM finance_inv_notes ORDER BY sort_order,id")]
    snaps = []
    for s in conn.execute("SELECT * FROM finance_snapshots ORDER BY date"):
        snap = {"date": s["date"], "mode": s["mode"], "ta": s["total_assets"],
                "tl": s["total_liab"], "net": s["net"], "fin": s["fin"],
                "real": s["real"], "inv": s["inv"], "liab": s["liab"],
                "note": s["note"], "fx": {}, "accts": []}
        for fx in conn.execute(
                "SELECT currency,rate FROM finance_snapshot_fx WHERE snapshot_id=?", (s["id"],)):
            snap["fx"][fx["currency"]] = fx["rate"]
        for a in conn.execute(
                "SELECT * FROM finance_snapshot_accounts WHERE snapshot_id=? ORDER BY seq,account_id",
                (s["id"],)):
            acct = {"id": a["account_id"], "name": a["name"], "cur": a["cur"],
                    "val": a["val"], "base": a["base"]}
            if a["why"] is not None:
                acct["why"] = a["why"]
            subs = [{"why": sub["why"], "v": sub["val"]} for sub in conn.execute(
                "SELECT why,val FROM finance_snapshot_account_subs "
                "WHERE snapshot_id=? AND account_id=? ORDER BY seq",
                (s["id"], a["account_id"]))]
            if subs:
                acct["subs"] = subs
            snap["accts"].append(acct)
        snaps.append(snap)
    fxHist = {}
    for fx in conn.execute("SELECT currency,date,rate FROM finance_fx_history ORDER BY currency,date"):
        fxHist.setdefault(fx["currency"], []).append({"date": fx["date"], "rate": fx["rate"]})
    return {
        "base": st["base"], "goals": st["goals"], "fx": st["fx"], "fxDate": st["fxDate"],
        "acctTypes": st["acctTypes"], "settingsCollapsed": st["settingsCollapsed"],
        "accounts": accounts, "liabs": liabs, "reals": reals, "reasons": reasons,
        "acctGroups": groups, "inv": {"accounts": inv_accounts, "holdings": inv_holdings,
                                     "notes": notes, "noteGroups": note_groups},
        "snaps": snaps, "fxHist": fxHist, "migrated_at": st["migrated_at"],
        "migration_source": st["migration_source"],
    }


def finance_is_empty() -> bool:
    conn = get_conn()
    for table in _FIN_TABLES:
        if conn.execute(f"SELECT 1 FROM {table} LIMIT 1").fetchone():
            return False
    return True


def finance_clear_all(conn=None) -> None:
    conn = conn or get_conn()
    for table in _FIN_TABLES:
        conn.execute(f"DELETE FROM {table}")


def _fin_insert_snapshot(conn, snap: dict) -> None:
    created = snap.get("created_at") or _fin_now()
    cur = conn.execute(
        "INSERT INTO finance_snapshots(date,mode,total_assets,total_liab,net,fin,real,inv,"
        "liab,note,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        (snap.get("date"), snap.get("mode") or "detail", _fin_num(snap.get("ta")),
         _fin_num(snap.get("tl")), _fin_num(snap.get("net")), _fin_num(snap.get("fin")),
         _fin_num(snap.get("real")), _fin_num(snap.get("inv")), _fin_num(snap.get("liab")),
         str(snap.get("note") or ""), created),
    )
    sid = cur.lastrowid
    for currency, rate in (snap.get("fx") or {}).items():
        conn.execute("INSERT OR REPLACE INTO finance_snapshot_fx(snapshot_id,currency,rate) VALUES(?,?,?)",
                     (sid, str(currency), _fin_num(rate)))
    for seq, acct in enumerate(snap.get("accts") or []):
        aid = str(acct.get("id") or "")
        if not aid:
            continue
        conn.execute(
            "INSERT OR REPLACE INTO finance_snapshot_accounts(snapshot_id,account_id,name,cur,val,base,why,seq) "
            "VALUES(?,?,?,?,?,?,?,?)",
            (sid, aid, str(acct.get("name") or ""), str(acct.get("cur") or "CNY"),
             _fin_num(acct.get("val")), _fin_num(acct.get("base")), acct.get("why"), seq),
        )
        for sseq, sub in enumerate(acct.get("subs") or []):
            conn.execute(
                "INSERT OR REPLACE INTO finance_snapshot_account_subs(snapshot_id,account_id,seq,why,val) "
                "VALUES(?,?,?,?,?)",
                (sid, aid, sseq, str(sub.get("why") or ""), _fin_num(sub.get("v"))),
            )


def finance_replace_state(state: dict, conn=None) -> None:
    """整包替换 finance_*；供迁移与前端整状态保存使用，调用方负责事务。"""
    owns = conn is None
    conn = conn or get_conn()
    state = state if isinstance(state, dict) else {}
    inv = state.get("inv") if isinstance(state.get("inv"), dict) else {}
    finance_clear_all(conn)
    conn.execute(
        "INSERT INTO finance_settings(id,base,goals,fx_json,acct_types_json,ui_json,fx_date,"
        "migrated_at,migration_source,updated_at) VALUES(1,?,?,?,?,?,?,?,?,?)",
        (str(state.get("base") or "CNY"), _fin_num(state.get("goals")),
         _fin_dump(state.get("fx"), {"CNY": 1}), _fin_dump(state.get("acctTypes"), []),
         _fin_dump(state.get("settingsCollapsed"), {}), state.get("fxDate"),
         state.get("migrated_at"), state.get("migration_source"), _fin_now()),
    )
    for i, g in enumerate(state.get("acctGroups") or []):
        conn.execute("INSERT INTO finance_account_groups(id,name,sort_order) VALUES(?,?,?) "
                     "ON CONFLICT(id) DO UPDATE SET name=excluded.name,sort_order=excluded.sort_order",
                     (str(g.get("id")), str(g.get("name") or ""), i))
    for i, a in enumerate(state.get("accounts") or []):
        conn.execute(
            "INSERT INTO finance_accounts(id,name,type,group_id,cur,balance,date,include,sort_order) "
            "VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,type=excluded.type,"
            "group_id=excluded.group_id,cur=excluded.cur,balance=excluded.balance,date=excluded.date,"
            "include=excluded.include,sort_order=excluded.sort_order",
            (str(a.get("id")), str(a.get("name") or ""), str(a.get("type") or ""),
             a.get("group") or a.get("group_id"), str(a.get("cur") or "CNY"),
             _fin_num(a.get("balance")), a.get("date"), 1 if a.get("include", True) else 0, i),
        )
    for i, l in enumerate(state.get("liabs") or []):
        conn.execute(
            "INSERT INTO finance_liabs(id,name,kind,cur,principal,remain,rate,due,note,sort_order) "
            "VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,kind=excluded.kind,"
            "cur=excluded.cur,principal=excluded.principal,remain=excluded.remain,rate=excluded.rate,"
            "due=excluded.due,note=excluded.note,sort_order=excluded.sort_order",
            (str(l.get("id")), str(l.get("name") or ""), str(l.get("kind") or ""),
             str(l.get("cur") or "CNY"), _fin_num(l.get("principal")), _fin_num(l.get("remain")),
             _fin_num(l.get("rate")), l.get("due") or "", str(l.get("note") or ""), i),
        )
    for i, r in enumerate(state.get("reals") or []):
        conn.execute(
            "INSERT INTO finance_reals(id,name,cat,cur,cost,value,date,note,sort_order) "
            "VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,cat=excluded.cat,"
            "cur=excluded.cur,cost=excluded.cost,value=excluded.value,date=excluded.date,note=excluded.note,"
            "sort_order=excluded.sort_order",
            (str(r.get("id")), str(r.get("name") or ""), str(r.get("cat") or ""),
             str(r.get("cur") or "CNY"), _fin_num(r.get("cost")), _fin_num(r.get("value")),
             r.get("date"), str(r.get("note") or ""), i),
        )
    for i, name in enumerate(state.get("reasons") or []):
        name = str(name or "").strip()
        if name:
            conn.execute("INSERT INTO finance_reasons(name,sort_order) VALUES(?,?)", (name, i))
    for i, a in enumerate(inv.get("accounts") or []):
        conn.execute(
            "INSERT INTO finance_inv_accounts(id,name,cur,note,sort_order) VALUES(?,?,?,?,?) "
            "ON CONFLICT(id) DO UPDATE SET name=excluded.name,cur=excluded.cur,note=excluded.note,"
            "sort_order=excluded.sort_order",
            (str(a.get("id")), str(a.get("name") or ""), str(a.get("cur") or "CNY"),
             str(a.get("note") or ""), i),
        )
    for i, h in enumerate(inv.get("holdings") or []):
        conn.execute(
            "INSERT INTO finance_inv_holdings(id,name,type,acct_id,cur,date,cash_only,price,qty,cost,value,sort_order) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,type=excluded.type,"
            "acct_id=excluded.acct_id,cur=excluded.cur,date=excluded.date,cash_only=excluded.cash_only,"
            "price=excluded.price,qty=excluded.qty,cost=excluded.cost,value=excluded.value,sort_order=excluded.sort_order",
            (str(h.get("id")), str(h.get("name") or ""), str(h.get("type") or ""),
             h.get("acctId") or h.get("acct_id"), str(h.get("cur") or "CNY"), h.get("date"),
             1 if h.get("cashOnly") else 0, _fin_num(h.get("price")), _fin_num(h.get("qty")),
             _fin_num(h.get("cost")), _fin_num(h.get("value")), i),
        )
        for lot in h.get("lots") or []:
            conn.execute(
                "INSERT OR REPLACE INTO finance_inv_lots(id,holding_id,date,qty,cost,px,sort_order) "
                "VALUES(?,?,?,?,?,?,?)",
                (str(lot.get("id")), str(h.get("id")), lot.get("date"), _fin_num(lot.get("qty")),
                 _fin_num(lot.get("cost")), _fin_num(lot.get("px")), 0),
            )
        for seq, val in enumerate(h.get("vals") or []):
            conn.execute(
                "INSERT OR REPLACE INTO finance_inv_vals(holding_id,date,seq,price,value) "
                "VALUES(?,?,?,?,?)",
                (str(h.get("id")), str(val.get("date")), seq, val.get("price"),
                 _fin_num(val.get("value"))),
            )
    for i, g in enumerate(inv.get("noteGroups") or []):
        conn.execute(
            "INSERT INTO finance_inv_note_groups(id,name,sort_order) VALUES(?,?,?) "
            "ON CONFLICT(id) DO UPDATE SET name=excluded.name,sort_order=excluded.sort_order",
            (str(g.get("id")), str(g.get("name") or ""), i),
        )
    for i, n in enumerate(inv.get("notes") or []):
        conn.execute(
            "INSERT INTO finance_inv_notes(id,title,body,date,gid,sort_order) VALUES(?,?,?,?,?,?) "
            "ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,date=excluded.date,"
            "gid=excluded.gid,sort_order=excluded.sort_order",
            (str(n.get("id")), str(n.get("title") or ""), str(n.get("body") or ""),
             n.get("date"), n.get("gid") or None, i),
        )
    for snap in state.get("snaps") or []:
        _fin_insert_snapshot(conn, snap)
    for currency, rows in (state.get("fxHist") or {}).items():
        for v in rows or []:
            conn.execute("INSERT OR REPLACE INTO finance_fx_history(currency,date,rate) VALUES(?,?,?)",
                         (str(currency), str(v.get("date")), _fin_num(v.get("rate"))))
    if owns:
        conn.commit()


def finance_save_settings(base=None, goals=None, fx=None, fx_date=None, acct_types=None,
                          settings_collapsed=None, migrated_at=None, migration_source=None) -> dict:
    conn = get_conn()
    st = _fin_settings(conn)
    conn.execute(
        "INSERT INTO finance_settings(id,base,goals,fx_json,acct_types_json,ui_json,fx_date,"
        "migrated_at,migration_source,updated_at) VALUES(1,?,?,?,?,?,?,?,?,?) "
        "ON CONFLICT(id) DO UPDATE SET base=excluded.base,goals=excluded.goals,fx_json=excluded.fx_json,"
        "acct_types_json=excluded.acct_types_json,ui_json=excluded.ui_json,fx_date=excluded.fx_date,"
        "migrated_at=COALESCE(excluded.migrated_at,finance_settings.migrated_at),"
        "migration_source=COALESCE(excluded.migration_source,finance_settings.migration_source),"
        "updated_at=excluded.updated_at",
        (base if base is not None else st["base"], _fin_num(goals, st["goals"]),
         _fin_dump(fx if fx is not None else st["fx"], {"CNY": 1}),
         _fin_dump(acct_types if acct_types is not None else st["acctTypes"], []),
         _fin_dump(settings_collapsed if settings_collapsed is not None else st["settingsCollapsed"], {}),
         fx_date if fx_date is not None else st["fxDate"],
         migrated_at if migrated_at is not None else st["migrated_at"],
         migration_source if migration_source is not None else st["migration_source"], _fin_now()),
    )
    conn.commit()
    return _fin_settings(conn)


def finance_save_fx_history(currency: str, day: str, rate: float) -> dict:
    conn = get_conn()
    conn.execute("INSERT OR REPLACE INTO finance_fx_history(currency,date,rate) VALUES(?,?,?)",
                 (str(currency), str(day), _fin_num(rate)))
    conn.commit()
    return {"currency": str(currency), "date": str(day), "rate": _fin_num(rate)}


def finance_list_accounts() -> list[dict]:
    conn = get_conn()
    return [dict(r) for r in conn.execute("SELECT * FROM finance_accounts ORDER BY sort_order,id")]


def finance_save_account(account: dict) -> dict:
    conn = get_conn()
    aid = str(account.get("id"))
    conn.execute(
        "INSERT INTO finance_accounts(id,name,type,group_id,cur,balance,date,include,sort_order) "
        "VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,type=excluded.type,"
        "group_id=excluded.group_id,cur=excluded.cur,balance=excluded.balance,date=excluded.date,"
        "include=excluded.include",
        (aid, str(account.get("name") or ""), str(account.get("type") or ""),
         account.get("group") or account.get("group_id"), str(account.get("cur") or "CNY"),
         _fin_num(account.get("balance")), account.get("date"),
         1 if account.get("include", True) else 0, _fin_int(account.get("sort_order"))),
    )
    conn.commit()
    return dict(conn.execute("SELECT * FROM finance_accounts WHERE id=?", (aid,)).fetchone())


def finance_delete_account(account_id: str) -> bool:
    conn = get_conn()
    cur = conn.execute("DELETE FROM finance_accounts WHERE id=?", (str(account_id),))
    conn.commit()
    return cur.rowcount > 0


def finance_list_account_groups() -> list[dict]:
    conn = get_conn()
    return [dict(r) for r in conn.execute(
        "SELECT * FROM finance_account_groups ORDER BY sort_order,id")]


def finance_save_account_group(group: dict) -> dict:
    conn = get_conn()
    gid = str(group.get("id"))
    conn.execute(
        "INSERT INTO finance_account_groups(id,name,sort_order) VALUES(?,?,?) "
        "ON CONFLICT(id) DO UPDATE SET name=excluded.name,sort_order=excluded.sort_order",
        (gid, str(group.get("name") or ""), _fin_int(group.get("sort_order"))))
    conn.commit()
    return dict(conn.execute("SELECT * FROM finance_account_groups WHERE id=?", (gid,)).fetchone())


def finance_delete_account_group(group_id: str) -> bool:
    conn = get_conn()
    conn.execute("UPDATE finance_accounts SET group_id=NULL WHERE group_id=?", (str(group_id),))
    cur = conn.execute("DELETE FROM finance_account_groups WHERE id=?", (str(group_id),))
    conn.commit()
    return cur.rowcount > 0


def finance_list_liabs() -> list[dict]:
    conn = get_conn()
    return [dict(r) for r in conn.execute("SELECT * FROM finance_liabs ORDER BY sort_order,id")]


def finance_save_liab(liab: dict) -> dict:
    conn = get_conn()
    lid = str(liab.get("id"))
    conn.execute(
        "INSERT INTO finance_liabs(id,name,kind,cur,principal,remain,rate,due,note,sort_order) "
        "VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,kind=excluded.kind,"
        "cur=excluded.cur,principal=excluded.principal,remain=excluded.remain,rate=excluded.rate,"
        "due=excluded.due,note=excluded.note,sort_order=excluded.sort_order",
        (lid, str(liab.get("name") or ""), str(liab.get("kind") or ""),
         str(liab.get("cur") or "CNY"), _fin_num(liab.get("principal")),
         _fin_num(liab.get("remain")), _fin_num(liab.get("rate")),
         liab.get("due") or "", str(liab.get("note") or ""), _fin_int(liab.get("sort_order"))))
    conn.commit()
    return dict(conn.execute("SELECT * FROM finance_liabs WHERE id=?", (lid,)).fetchone())


def finance_delete_liab(liab_id: str) -> bool:
    conn = get_conn()
    cur = conn.execute("DELETE FROM finance_liabs WHERE id=?", (str(liab_id),))
    conn.commit()
    return cur.rowcount > 0


def finance_list_reals() -> list[dict]:
    conn = get_conn()
    return [dict(r) for r in conn.execute("SELECT * FROM finance_reals ORDER BY sort_order,id")]


def finance_save_real(real: dict) -> dict:
    conn = get_conn()
    rid = str(real.get("id"))
    conn.execute(
        "INSERT INTO finance_reals(id,name,cat,cur,cost,value,date,note,sort_order) "
        "VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,cat=excluded.cat,"
        "cur=excluded.cur,cost=excluded.cost,value=excluded.value,date=excluded.date,note=excluded.note,"
        "sort_order=excluded.sort_order",
        (rid, str(real.get("name") or ""), str(real.get("cat") or ""),
         str(real.get("cur") or "CNY"), _fin_num(real.get("cost")),
         _fin_num(real.get("value")), real.get("date"), str(real.get("note") or ""),
         _fin_int(real.get("sort_order"))))
    conn.commit()
    return dict(conn.execute("SELECT * FROM finance_reals WHERE id=?", (rid,)).fetchone())


def finance_delete_real(real_id: str) -> bool:
    conn = get_conn()
    cur = conn.execute("DELETE FROM finance_reals WHERE id=?", (str(real_id),))
    conn.commit()
    return cur.rowcount > 0


def finance_list_reasons() -> list[str]:
    conn = get_conn()
    return [r["name"] for r in conn.execute(
        "SELECT name FROM finance_reasons ORDER BY sort_order,id")]


def finance_save_reason(reason) -> dict:
    name = str(reason.get("name") if isinstance(reason, dict) else reason or "").strip()
    if not name:
        raise ValueError("原因不能为空")
    conn = get_conn()
    sort_order = _fin_int(reason.get("sort_order")) if isinstance(reason, dict) else 0
    conn.execute("INSERT OR IGNORE INTO finance_reasons(name,sort_order) VALUES(?,?)",
                 (name, sort_order))
    conn.commit()
    return dict(conn.execute("SELECT * FROM finance_reasons WHERE name=?", (name,)).fetchone())


def finance_delete_reason(name: str) -> bool:
    conn = get_conn()
    cur = conn.execute("DELETE FROM finance_reasons WHERE name=?", (str(name),))
    conn.commit()
    return cur.rowcount > 0


def finance_list_snapshots() -> list[dict]:
    return finance_get_state()["snaps"]


def finance_save_snapshot(snapshot: dict) -> dict:
    conn = get_conn()
    day = str(snapshot.get("date") or "")
    if not day:
        raise ValueError("快照日期不能为空")
    conn.execute("DELETE FROM finance_snapshots WHERE date=?", (day,))
    _fin_insert_snapshot(conn, snapshot)
    conn.commit()
    return next(s for s in finance_get_state()["snaps"] if s["date"] == day)


def finance_delete_snapshot(day: str) -> bool:
    conn = get_conn()
    cur = conn.execute("DELETE FROM finance_snapshots WHERE date=?", (str(day),))
    conn.commit()
    return cur.rowcount > 0


def finance_list_inv_holdings() -> list[dict]:
    return finance_get_state()["inv"]["holdings"]


def finance_save_inv_account(account: dict) -> dict:
    conn = get_conn()
    aid = str(account.get("id"))
    conn.execute("INSERT INTO finance_inv_accounts(id,name,cur,note,sort_order) VALUES(?,?,?,?,?) "
                 "ON CONFLICT(id) DO UPDATE SET name=excluded.name,cur=excluded.cur,note=excluded.note,"
                 "sort_order=excluded.sort_order",
                 (aid, str(account.get("name") or ""), str(account.get("cur") or "CNY"),
                  str(account.get("note") or ""), _fin_int(account.get("sort_order"))))
    conn.commit()
    return dict(conn.execute("SELECT * FROM finance_inv_accounts WHERE id=?", (aid,)).fetchone())


def finance_delete_inv_account(account_id: str) -> bool:
    conn = get_conn()
    cur = conn.execute("DELETE FROM finance_inv_accounts WHERE id=?", (str(account_id),))
    conn.commit()
    return cur.rowcount > 0


def finance_save_inv_holding(holding: dict) -> dict:
    conn = get_conn()
    hid = str(holding.get("id"))
    conn.execute(
        "INSERT INTO finance_inv_holdings(id,name,type,acct_id,cur,date,cash_only,price,qty,cost,value,sort_order) "
        "VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,type=excluded.type,"
        "acct_id=excluded.acct_id,cur=excluded.cur,date=excluded.date,cash_only=excluded.cash_only,"
        "price=excluded.price,qty=excluded.qty,cost=excluded.cost,value=excluded.value,sort_order=excluded.sort_order",
        (hid, str(holding.get("name") or ""), str(holding.get("type") or ""),
         holding.get("acctId") or holding.get("acct_id"), str(holding.get("cur") or "CNY"),
         holding.get("date"), 1 if holding.get("cashOnly") else 0,
         _fin_num(holding.get("price")), _fin_num(holding.get("qty")),
         _fin_num(holding.get("cost")), _fin_num(holding.get("value")),
         _fin_int(holding.get("sort_order"))),
    )
    if "lots" in holding:
        conn.execute("DELETE FROM finance_inv_lots WHERE holding_id=?", (hid,))
        for i, lot in enumerate(holding.get("lots") or []):
            conn.execute("INSERT INTO finance_inv_lots(id,holding_id,date,qty,cost,px,sort_order) "
                         "VALUES(?,?,?,?,?,?,?)",
                         (str(lot.get("id")), hid, lot.get("date"), _fin_num(lot.get("qty")),
                          _fin_num(lot.get("cost")), _fin_num(lot.get("px")), i))
    if "vals" in holding:
        conn.execute("DELETE FROM finance_inv_vals WHERE holding_id=?", (hid,))
        for seq, val in enumerate(holding.get("vals") or []):
            conn.execute("INSERT INTO finance_inv_vals(holding_id,date,seq,price,value) VALUES(?,?,?,?,?)",
                         (hid, str(val.get("date")), seq, val.get("price"), _fin_num(val.get("value"))))
    conn.commit()
    return next(h for h in finance_get_state()["inv"]["holdings"] if h["id"] == hid)


def finance_delete_inv_holding(holding_id: str) -> bool:
    conn = get_conn()
    cur = conn.execute("DELETE FROM finance_inv_holdings WHERE id=?", (str(holding_id),))
    conn.commit()
    return cur.rowcount > 0


def finance_list_inv_lots(holding_id: str | None = None) -> list[dict]:
    conn = get_conn()
    if holding_id:
        rows = conn.execute("SELECT * FROM finance_inv_lots WHERE holding_id=? ORDER BY sort_order,id",
                            (str(holding_id),))
    else:
        rows = conn.execute("SELECT * FROM finance_inv_lots ORDER BY holding_id,sort_order,id")
    return [dict(r) for r in rows]


def finance_save_inv_lot(lot: dict) -> dict:
    conn = get_conn()
    lid = str(lot.get("id"))
    conn.execute("INSERT OR REPLACE INTO finance_inv_lots(id,holding_id,date,qty,cost,px,sort_order) "
                 "VALUES(?,?,?,?,?,?,?)",
                 (lid, str(lot.get("holding_id") or lot.get("holdingId")), lot.get("date"),
                  _fin_num(lot.get("qty")), _fin_num(lot.get("cost")), _fin_num(lot.get("px")),
                  _fin_int(lot.get("sort_order"))))
    conn.commit()
    return dict(conn.execute("SELECT * FROM finance_inv_lots WHERE id=?", (lid,)).fetchone())


def finance_delete_inv_lot(lot_id: str) -> bool:
    conn = get_conn()
    cur = conn.execute("DELETE FROM finance_inv_lots WHERE id=?", (str(lot_id),))
    conn.commit()
    return cur.rowcount > 0


def finance_list_inv_vals(holding_id: str | None = None) -> list[dict]:
    conn = get_conn()
    if holding_id:
        rows = conn.execute("SELECT * FROM finance_inv_vals WHERE holding_id=? ORDER BY date,seq",
                            (str(holding_id),))
    else:
        rows = conn.execute("SELECT * FROM finance_inv_vals ORDER BY holding_id,date,seq")
    return [dict(r) for r in rows]


def finance_save_inv_val(val: dict) -> dict:
    conn = get_conn()
    conn.execute("INSERT OR REPLACE INTO finance_inv_vals(holding_id,date,seq,price,value) VALUES(?,?,?,?,?)",
                 (str(val.get("holding_id") or val.get("holdingId")), str(val.get("date")),
                  _fin_int(val.get("seq")), val.get("price"), _fin_num(val.get("value"))))
    conn.commit()
    return dict(conn.execute("SELECT * FROM finance_inv_vals WHERE holding_id=? AND date=? AND seq=?",
                             (str(val.get("holding_id") or val.get("holdingId")), str(val.get("date")),
                              _fin_int(val.get("seq")))).fetchone())


def finance_delete_inv_val(holding_id: str, day: str, seq: int) -> bool:
    conn = get_conn()
    cur = conn.execute("DELETE FROM finance_inv_vals WHERE holding_id=? AND date=? AND seq=?",
                       (str(holding_id), str(day), _fin_int(seq)))
    conn.commit()
    return cur.rowcount > 0


def finance_list_inv_notes() -> list[dict]:
    conn = get_conn()
    return [dict(r) for r in conn.execute("SELECT * FROM finance_inv_notes ORDER BY sort_order,id")]


def finance_save_inv_note(note: dict) -> dict:
    conn = get_conn()
    nid = str(note.get("id"))
    conn.execute("INSERT INTO finance_inv_notes(id,title,body,date,gid,sort_order) VALUES(?,?,?,?,?,?) "
                 "ON CONFLICT(id) DO UPDATE SET title=excluded.title,body=excluded.body,date=excluded.date,"
                 "gid=excluded.gid,sort_order=excluded.sort_order",
                 (nid, str(note.get("title") or ""), str(note.get("body") or ""),
                  note.get("date"), note.get("gid") or None, _fin_int(note.get("sort_order"))))
    conn.commit()
    return dict(conn.execute("SELECT * FROM finance_inv_notes WHERE id=?", (nid,)).fetchone())


def finance_delete_inv_note(note_id: str) -> bool:
    conn = get_conn()
    cur = conn.execute("DELETE FROM finance_inv_notes WHERE id=?", (str(note_id),))
    conn.commit()
    return cur.rowcount > 0


def finance_list_inv_note_groups() -> list[dict]:
    conn = get_conn()
    return [dict(r) for r in conn.execute(
        "SELECT * FROM finance_inv_note_groups ORDER BY sort_order,id")]


def finance_save_inv_note_group(group: dict) -> dict:
    conn = get_conn()
    gid = str(group.get("id"))
    conn.execute("INSERT INTO finance_inv_note_groups(id,name,sort_order) VALUES(?,?,?) "
                 "ON CONFLICT(id) DO UPDATE SET name=excluded.name,sort_order=excluded.sort_order",
                 (gid, str(group.get("name") or ""), _fin_int(group.get("sort_order"))))
    conn.commit()
    return dict(conn.execute("SELECT * FROM finance_inv_note_groups WHERE id=?", (gid,)).fetchone())


def finance_delete_inv_note_group(group_id: str) -> bool:
    conn = get_conn()
    conn.execute("UPDATE finance_inv_notes SET gid=NULL WHERE gid=?", (str(group_id),))
    cur = conn.execute("DELETE FROM finance_inv_note_groups WHERE id=?", (str(group_id),))
    conn.commit()
    return cur.rowcount > 0


# ---------- 量化内容资产 / 基金缓存（batch2） ----------
_QUANT_KINDS = {
    "rt_fq_factor_lib": "factor_lib",
    "rt_fq_datasets": "datasets",
    "rt_fq_excl": "excl",
    "rt_fqlayers": "layers",
}
_FUND_KINDS = {
    "rt_fundnav": "fundnav",
    "rt_funddata": "funddata",
}
_CONTENT_ALIASES = {"rt_fq_layers": "rt_fqlayers"}


def _content_key(key: str) -> str:
    return _CONTENT_ALIASES.get(key, key)


def load_content_assets() -> dict:
    out = {}
    conn = get_conn()
    for table, known in (("finance_quant_assets", _QUANT_KINDS),
                         ("finance_fund_cache", _FUND_KINDS)):
        for row in conn.execute(
            f"SELECT asset_key, COALESCE(NULLIF(live_json,''), raw_json) AS raw_json FROM {table}"
        ):
            key = row["asset_key"]
            if key in known:
                out[key] = json.loads(row["raw_json"])
    return out


def import_content_asset(key: str, raw: str) -> None:
    key = _content_key(key)
    if key in _QUANT_KINDS:
        table, kind = "finance_quant_assets", _QUANT_KINDS[key]
    elif key in _FUND_KINDS:
        table, kind = "finance_fund_cache", _FUND_KINDS[key]
    else:
        raise ValueError("未知财务内容键：" + key)
    json.loads(raw)
    conn = get_conn()
    conn.execute(
        f"INSERT INTO {table}(asset_key,kind,raw_json,live_json,updated_at) VALUES(?,?,?,?,?) "
        "ON CONFLICT(asset_key) DO UPDATE SET kind=excluded.kind, live_json=excluded.live_json, updated_at=excluded.updated_at",
        (key, kind, raw, raw, datetime.now(timezone.utc).isoformat(timespec="seconds")),
    )
    conn.commit()


def save_content_assets(assets: dict) -> dict:
    saved = 0
    for key, value in (assets or {}).items():
        key = _content_key(key)
        if key not in _QUANT_KINDS and key not in _FUND_KINDS:
            continue
        raw = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        if key in _QUANT_KINDS:
            table, kind = "finance_quant_assets", _QUANT_KINDS[key]
        else:
            table, kind = "finance_fund_cache", _FUND_KINDS[key]
        conn = get_conn()
        conn.execute(
            f"INSERT INTO {table}(asset_key,kind,raw_json,live_json,updated_at) VALUES(?,?,?,?,?) "
            "ON CONFLICT(asset_key) DO UPDATE SET kind=excluded.kind, live_json=excluded.live_json, updated_at=excluded.updated_at",
            (key, kind, raw, raw, datetime.now(timezone.utc).isoformat(timespec="seconds")),
        )
        saved += 1
    get_conn().commit()
    return {"saved": saved}
