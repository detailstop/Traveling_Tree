"""finance 插件后端：只做 HTTP 适配，全部 SQL 经 plugins.finance.repo。"""
from __future__ import annotations

from urllib.parse import unquote

from plugins.finance import crawler, fund_nav, repo


def _ok(**payload):
    return {"ok": True, **payload}


def _not_found():
    return {"ok": False, "error": "not_found", "__status__": 404}


def _bad(message: str):
    return {"ok": False, "error": str(message), "__status__": 400}


def _parts(subpath: str) -> list[str]:
    return [unquote(p) for p in subpath.strip("/").split("/") if p]


def _resource(parts: list[str]) -> tuple[str, str | None]:
    if not parts:
        return "", None
    if parts[0] == "inv" and len(parts) >= 2:
        return f"inv/{parts[1]}", parts[2] if len(parts) > 2 else None
    return parts[0], parts[1] if len(parts) > 1 else None


def handle(method: str, subpath: str, query: dict, body: dict):
    """分发 /api/plugin/finance/*；finquant 只保留前端占位，不暴露数据接口。"""
    parts = _parts(subpath)
    resource, item_id = _resource(parts)
    body = body if isinstance(body, dict) else {}

    if parts and parts[0] == "crawl":
        if method != "POST":
            return {"ok": False, "error": "method_not_allowed", "__status__": 405}
        return crawler.crawl(str(body.get("url") or ""))

    if parts and parts[0] == "fund":
        if method != "POST":
            return {"ok": False, "error": "method_not_allowed", "__status__": 405}
        if len(parts) >= 2 and parts[1] == "list":
            return fund_nav.fund_list(bool(body.get("force")))
        if len(parts) >= 2 and parts[1] == "nav":
            return fund_nav.fund_nav(str(body.get("code") or ""))
        return _not_found()

    if parts and parts[0] == "content-state":
        if method == "GET":
            return _ok(assets=repo.load_content_assets())
        if method == "PUT":
            assets = body.get("assets")
            if not isinstance(assets, dict):
                return _bad("assets 必须是对象")
            try:
                return _ok(counts=repo.save_content_assets(assets))
            except (ValueError, TypeError) as exc:
                return _bad(str(exc))
        return {"ok": False, "error": "method_not_allowed", "__status__": 405}

    if resource == "state":
        if method == "GET":
            return _ok(state=repo.finance_get_state())
        if method == "PUT":
            state = body.get("state") if isinstance(body.get("state"), dict) else body
            if not isinstance(state, dict) or not isinstance(state.get("accounts"), list):
                return _bad("state 需要 accounts 数组")
            current = repo.finance_get_state()
            if not state.get("migrated_at"):
                state["migrated_at"] = current.get("migrated_at")
            if not state.get("migration_source"):
                state["migration_source"] = current.get("migration_source")
            repo.finance_replace_state(state)
            return _ok(state=repo.finance_get_state())
        return _not_found()

    if resource == "settings":
        if method == "GET":
            return _ok(settings=repo.finance_get_state())
        if method in ("PUT", "PATCH", "POST"):
            try:
                return _ok(settings=repo.finance_save_settings(
                    base=body.get("base"), goals=body.get("goals"), fx=body.get("fx"),
                    fx_date=body.get("fxDate", body.get("fx_date")),
                    acct_types=body.get("acctTypes"),
                    settings_collapsed=body.get("settingsCollapsed")))
            except (TypeError, ValueError) as exc:
                return _bad(exc)
        return _not_found()

    if resource == "fx-history":
        if method == "GET":
            return _ok(history=repo.finance_get_state()["fxHist"])
        if method in ("POST", "PUT"):
            try:
                return _ok(item=repo.finance_save_fx_history(
                    body.get("currency") or query.get("currency"),
                    body.get("date") or query.get("date"),
                    body.get("rate") if body.get("rate") is not None else query.get("rate")))
            except (TypeError, ValueError) as exc:
                return _bad(exc)
        return _not_found()

    if resource == "accounts":
        if method == "GET":
            return _ok(items=repo.finance_list_accounts())
        if method in ("POST", "PUT"):
            return _ok(item=repo.finance_save_account(body))
        if method == "DELETE" and item_id:
            return _ok(deleted=repo.finance_delete_account(item_id))
        return _not_found()
    if resource == "account-groups":
        if method == "GET":
            return _ok(items=repo.finance_list_account_groups())
        if method in ("POST", "PUT"):
            return _ok(item=repo.finance_save_account_group(body))
        if method == "DELETE" and item_id:
            return _ok(deleted=repo.finance_delete_account_group(item_id))
        return _not_found()
    if resource == "liabs":
        if method == "GET":
            return _ok(items=repo.finance_list_liabs())
        if method in ("POST", "PUT"):
            return _ok(item=repo.finance_save_liab(body))
        if method == "DELETE" and item_id:
            return _ok(deleted=repo.finance_delete_liab(item_id))
        return _not_found()
    if resource == "reals":
        if method == "GET":
            return _ok(items=repo.finance_list_reals())
        if method in ("POST", "PUT"):
            return _ok(item=repo.finance_save_real(body))
        if method == "DELETE" and item_id:
            return _ok(deleted=repo.finance_delete_real(item_id))
        return _not_found()
    if resource == "reasons":
        if method == "GET":
            return _ok(items=repo.finance_list_reasons())
        if method in ("POST", "PUT"):
            return _ok(item=repo.finance_save_reason(body.get("name", body)))
        if method == "DELETE" and item_id:
            return _ok(deleted=repo.finance_delete_reason(item_id))
        return _not_found()
    if resource == "snapshots":
        if method == "GET":
            return _ok(items=repo.finance_list_snapshots())
        if method in ("POST", "PUT"):
            try:
                return _ok(item=repo.finance_save_snapshot(body))
            except (TypeError, ValueError) as exc:
                return _bad(exc)
        if method == "DELETE" and item_id:
            return _ok(deleted=repo.finance_delete_snapshot(item_id))
        return _not_found()

    if resource == "inv/accounts":
        if method == "GET":
            return _ok(items=repo.finance_get_state()["inv"]["accounts"])
        if method in ("POST", "PUT"):
            return _ok(item=repo.finance_save_inv_account(body))
        if method == "DELETE" and item_id:
            return _ok(deleted=repo.finance_delete_inv_account(item_id))
        return _not_found()
    if resource == "inv/holdings":
        if method == "GET":
            return _ok(items=repo.finance_list_inv_holdings())
        if method in ("POST", "PUT"):
            return _ok(item=repo.finance_save_inv_holding(body))
        if method == "DELETE" and item_id:
            return _ok(deleted=repo.finance_delete_inv_holding(item_id))
        return _not_found()
    if resource == "inv/lots":
        if method == "GET":
            return _ok(items=repo.finance_list_inv_lots(query.get("holding_id")))
        if method in ("POST", "PUT"):
            return _ok(item=repo.finance_save_inv_lot(body))
        if method == "DELETE" and item_id:
            return _ok(deleted=repo.finance_delete_inv_lot(item_id))
        return _not_found()
    if resource == "inv/vals":
        if method == "GET":
            return _ok(items=repo.finance_list_inv_vals(query.get("holding_id")))
        if method in ("POST", "PUT"):
            return _ok(item=repo.finance_save_inv_val(body))
        if method == "DELETE" and item_id:
            return _ok(deleted=repo.finance_delete_inv_val(
                query.get("holding_id") or item_id, query.get("date"), query.get("seq", 0)))
        return _not_found()
    if resource == "inv/notes":
        if method == "GET":
            return _ok(items=repo.finance_list_inv_notes())
        if method in ("POST", "PUT"):
            return _ok(item=repo.finance_save_inv_note(body))
        if method == "DELETE" and item_id:
            return _ok(deleted=repo.finance_delete_inv_note(item_id))
        return _not_found()
    if resource == "inv/note-groups":
        if method == "GET":
            return _ok(items=repo.finance_list_inv_note_groups())
        if method in ("POST", "PUT"):
            return _ok(item=repo.finance_save_inv_note_group(body))
        if method == "DELETE" and item_id:
            return _ok(deleted=repo.finance_delete_inv_note_group(item_id))
        return _not_found()

    return _not_found()
