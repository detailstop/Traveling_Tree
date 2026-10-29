"""finance 迁移 + 插件 API 冒烟（临时库，不触碰真实数据）。"""
from __future__ import annotations

import json
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

TMP = Path(tempfile.mkdtemp(prefix="rt_finance_test_"))
import config  # noqa: E402
config.DATA_DIR = TMP
config.DB_PATH = TMP / "russian_tutor.db"

from plugins.finance import repo  # noqa: E402
from plugins.finance import migrate_localstorage as mig  # noqa: E402
from ui.web.server import Handler, ThreadingHTTPServer, _bootstrap_db  # noqa: E402

PORT = 8897
BASE = f"http://127.0.0.1:{PORT}"
INPUT = ROOT / "data" / "plugins" / "finance" / "fixtures" / "rt_fin.json"
mig.REPORT_DIR = TMP / "finance_migration"
mig.BACKUP_DIR = TMP / "backup"
mig.BACKUP_DIR.mkdir(parents=True, exist_ok=True)
(mig.BACKUP_DIR / "russian_tutor_pre_finance_migration_20261028.db").write_bytes(b"")
(mig.BACKUP_DIR / "finance_rt_fin_20261028.json").write_text("{}", encoding="utf-8")


def request(method: str, path: str, body=None):
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method,
                                 headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read().decode("utf-8"))


def main() -> int:
    ok: list[bool] = []

    def check(name, cond, detail=""):
        ok.append(bool(cond))
        print(("PASS " if cond else "FAIL ") + name + (f" [{detail}]" if detail else ""))

    # 1) 空库 + dry-run
    _bootstrap_db()
    check("finance 初始为空", repo.finance_is_empty())
    dry = mig.main(["--dry-run", "--date", "20261028", "--input", str(INPUT)])
    check("dry-run 退出 0", dry == 0, str(dry))
    report_files = sorted(mig.REPORT_DIR.glob("migration_report_*.json"))
    report = json.loads(report_files[-1].read_text(encoding="utf-8")) if report_files else {}
    check("dry-run 报告行数", report.get("tables", {}).get("finance_accounts") == 15
          and report.get("tables", {}).get("finance_snapshots") == 27,
          str(report.get("tables")))

    # 2) apply / 重复拒绝 / force
    applied = mig.main(["--apply", "--date", "20261028", "--input", str(INPUT)])
    check("apply 成功", applied == 0 and not repo.finance_is_empty())
    state = repo.finance_get_state()
    check("迁移账户/快照", len(state["accounts"]) == 15 and len(state["snaps"]) == 27,
          f"{len(state['accounts'])}/{len(state['snaps'])}")
    check("迁移持仓 vals 保留", sum(len(h["vals"]) for h in state["inv"]["holdings"]) == 32)
    repeated = mig.main(["--apply", "--date", "20261028", "--input", str(INPUT)])
    check("重复 apply 拒绝", repeated == 1, str(repeated))
    forced = mig.main(["--apply", "--force", "--date", "20261028", "--input", str(INPUT)])
    check("--force 可重跑", forced == 0 and len(repo.finance_get_state()["accounts"]) == 15,
          str(forced))

    # 3) HTTP API
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    time.sleep(0.35)
    status, data = request("GET", "/api/plugin/finance/state")
    check("GET state", status == 200 and data.get("ok") and len(data["state"]["accounts"]) == 15)
    status, data = request("GET", "/api/plugin/finance/accounts")
    check("GET accounts", status == 200 and len(data.get("items", [])) == 15)

    test_acct = {"id": "smoke-fin-account", "name": "冒烟账户", "type": "cash",
                 "group": "ungrouped", "cur": "CNY", "balance": 1, "date": "2026-10-28",
                 "include": True}
    status, data = request("POST", "/api/plugin/finance/accounts", test_acct)
    check("POST account", status == 200 and data.get("item", {}).get("id") == test_acct["id"])
    status, data = request("DELETE", "/api/plugin/finance/accounts/" + test_acct["id"])
    check("DELETE account", status == 200 and data.get("deleted") is True)

    status, data = request("POST", "/api/plugin/finance/liabs", {
        "id": "smoke-fin-liab", "name": "冒烟负债", "kind": "loan", "cur": "CNY",
        "principal": 1, "remain": 1, "rate": 0, "due": "", "note": ""})
    check("POST liab", status == 200 and data.get("item", {}).get("id") == "smoke-fin-liab")
    status, data = request("DELETE", "/api/plugin/finance/liabs/smoke-fin-liab")
    check("DELETE liab", status == 200 and data.get("deleted") is True)

    status, data = request("POST", "/api/plugin/finance/reals", {
        "id": "smoke-fin-real", "name": "冒烟实物", "cat": "other", "cur": "CNY",
        "cost": 1, "value": 1, "date": "2026-10-28", "note": ""})
    check("POST real", status == 200 and data.get("item", {}).get("id") == "smoke-fin-real")
    status, data = request("DELETE", "/api/plugin/finance/reals/smoke-fin-real")
    check("DELETE real", status == 200 and data.get("deleted") is True)

    status, data = request("POST", "/api/plugin/finance/inv/holdings", {
        "id": "smoke-fin-holding", "name": "冒烟持仓", "type": "fund", "acctId": "",
        "cur": "CNY", "date": "2026-10-28", "cashOnly": False, "price": 1,
        "qty": 1, "cost": 1, "value": 1})
    check("POST inv holding", status == 200 and data.get("item", {}).get("id") == "smoke-fin-holding")
    status, data = request("POST", "/api/plugin/finance/inv/lots", {
        "id": "smoke-fin-lot", "holding_id": "smoke-fin-holding", "date": "2026-10-28",
        "qty": 1, "cost": 1, "px": 1})
    check("POST inv lot", status == 200 and data.get("item", {}).get("id") == "smoke-fin-lot")
    status, data = request("POST", "/api/plugin/finance/inv/vals", {
        "holding_id": "smoke-fin-holding", "date": "2099-01-02", "seq": 0,
        "price": 1, "value": 1})
    check("POST inv val", status == 200 and data.get("item", {}).get("value") == 1)
    status, data = request("DELETE", "/api/plugin/finance/inv/holdings/smoke-fin-holding")
    check("DELETE inv holding cascade", status == 200 and data.get("deleted") is True)

    status, data = request("POST", "/api/plugin/finance/inv/note-groups", {
        "id": "smoke-fin-group", "name": "冒烟笔记架"})
    check("POST inv note group", status == 200 and data.get("item", {}).get("id") == "smoke-fin-group")
    status, data = request("POST", "/api/plugin/finance/inv/notes", {
        "id": "smoke-fin-note", "title": "冒烟", "body": "x", "date": "2026-10-28",
        "gid": "smoke-fin-group"})
    check("POST inv note", status == 200 and data.get("item", {}).get("id") == "smoke-fin-note")
    status, data = request("DELETE", "/api/plugin/finance/inv/notes/smoke-fin-note")
    check("DELETE inv note", status == 200 and data.get("deleted") is True)
    status, data = request("DELETE", "/api/plugin/finance/inv/note-groups/smoke-fin-group")
    check("DELETE inv note group", status == 200 and data.get("deleted") is True)

    status, data = request("POST", "/api/plugin/finance/reasons", {"name": "冒烟原因"})
    check("POST reason", status == 200 and data.get("item", {}).get("name") == "冒烟原因")
    status, data = request("DELETE", "/api/plugin/finance/reasons/" + quote("冒烟原因"))
    check("DELETE reason", status == 200 and data.get("deleted") is True)

    snap = {"date": "2099-01-01", "mode": "detail", "ta": 1, "tl": 0, "net": 1,
            "fin": 1, "real": 0, "inv": 0, "liab": 0, "fx": {"CNY": 1},
            "note": "冒烟", "accts": []}
    status, data = request("POST", "/api/plugin/finance/snapshots", snap)
    check("POST snapshot", status == 200 and data.get("item", {}).get("date") == "2099-01-01")
    status, data = request("GET", "/api/plugin/finance/snapshots")
    check("GET snapshots", status == 200 and any(s["date"] == "2099-01-01" for s in data["items"]))
    status, data = request("DELETE", "/api/plugin/finance/snapshots/2099-01-01")
    check("DELETE snapshot", status == 200 and data.get("deleted") is True)

    # 4) 整状态保存（前端 saveFin 路径）
    status, data = request("GET", "/api/plugin/finance/state")
    current = data["state"]
    status, data = request("PUT", "/api/plugin/finance/state", {"state": current})
    check("PUT state", status == 200 and len(data.get("state", {}).get("accounts", [])) == 15)

    # 5) finquant 占位 / 旧路由
    fq = (ROOT / "plugins" / "finance" / "feature_finquant.js").read_text(encoding="utf-8")
    check("finquant 占位", "数据已重置" in fq and "/api/plugin/finance" not in fq)
    for path in ("/api/finance", "/api/finance/state", "/api/finance/accounts"):
        status, _ = request("GET", path)
        check(f"旧 {path} 404", status == 404, str(status))

    server.shutdown()
    print(f"\nRESULT: {ok.count(True)}/{len(ok)} PASS")
    return 0 if all(ok) else 1


if __name__ == "__main__":
    raise SystemExit(main())
