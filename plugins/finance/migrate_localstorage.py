"""一次性迁移：浏览器 rt_fin JSON -> 主库 finance_*（只读输入，幂等）。

用法：
  python plugins/finance/migrate_localstorage.py --dry-run
  python plugins/finance/migrate_localstorage.py --apply
  python plugins/finance/migrate_localstorage.py --apply --force
  # 兼容入口仍保留：python tools/migrate_finance_localstorage.py

约束：
  - 输入只读，不删除、不改写 rt_fin.json；
  - 所有 SQL 经 plugins.finance.repo 的 finance_* 函数；
  - --apply 使用 BEGIN IMMEDIATE 单事务，失败整批回滚；
  - finance_* 非空时 --apply 拒绝，--force 先备份数据库再替换；
  - --apply 前必须存在 DB 与 rt_fin 两份备份。
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import config  # noqa: E402
from plugins.finance import repo  # noqa: E402
from db.connection import get_conn, init_db  # noqa: E402

INPUT = config.plugin_data_dir("finance") / "fixtures" / "rt_fin.json"
REPORT_DIR = ROOT / "data" / "finance_migration"
BACKUP_DIR = ROOT / "data" / "backup"


def _stamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _counts(state: dict) -> dict:
    inv = state.get("inv") if isinstance(state.get("inv"), dict) else {}
    snaps = state.get("snaps") or []
    holdings = inv.get("holdings") or []
    return {
        "finance_settings": 1,
        "finance_fx_history": sum(len(v or []) for v in (state.get("fxHist") or {}).values()),
        "finance_account_groups": len(state.get("acctGroups") or []),
        "finance_accounts": len(state.get("accounts") or []),
        "finance_liabs": len(state.get("liabs") or []),
        "finance_reals": len(state.get("reals") or []),
        "finance_reasons": len([r for r in (state.get("reasons") or []) if str(r).strip()]),
        "finance_inv_accounts": len(inv.get("accounts") or []),
        "finance_inv_holdings": len(holdings),
        "finance_inv_lots": sum(len(h.get("lots") or []) for h in holdings),
        "finance_inv_vals": sum(len(h.get("vals") or []) for h in holdings),
        "finance_inv_notes": len(inv.get("notes") or []),
        "finance_inv_note_groups": len(inv.get("noteGroups") or []),
        "finance_snapshots": len(snaps),
        "finance_snapshot_fx": sum(len(s.get("fx") or {}) for s in snaps),
        "finance_snapshot_accounts": sum(len(s.get("accts") or []) for s in snaps),
        "finance_snapshot_account_subs": sum(
            len(a.get("subs") or []) for s in snaps for a in (s.get("accts") or [])),
    }


def _validate(state: dict) -> tuple[list[str], list[str]]:
    skipped: list[str] = []
    warnings: list[str] = []
    if not isinstance(state, dict):
        raise ValueError("rt_fin 顶层必须是对象")
    if not isinstance(state.get("accounts"), list):
        raise ValueError("rt_fin 缺少 accounts 数组")
    if not isinstance(state.get("snaps") or [], list):
        raise ValueError("rt_fin.snaps 必须是数组")
    for key in ("liabs", "reals", "acctGroups", "reasons"):
        if state.get(key) is not None and not isinstance(state.get(key), list):
            raise ValueError(f"rt_fin.{key} 必须是数组")
    inv = state.get("inv")
    if inv is not None and not isinstance(inv, dict):
        raise ValueError("rt_fin.inv 必须是对象")
    if not (inv or {}).get("holdings"):
        warnings.append("inv.holdings 为空，理财持仓 0 条")
    if not (state.get("reals") or []):
        warnings.append("reals 为空，实物资产 0 条")
    if not (state.get("fxHist") or {}):
        warnings.append("fxHist 为空，历史汇率 0 条")
    if not state.get("acctGroups"):
        warnings.append("acctGroups 为空，账户分组 0 条")
    if not (inv or {}).get("noteGroups"):
        skipped.append("inv.noteGroups 为空，笔记架 0 条")
    if state.get("finquant") is not None:
        skipped.append("finquant 已丢弃，不迁移")
    if state.get("rt_finquant") is not None or state.get("finq") is not None:
        skipped.append("finquant 本地数据已丢弃，不迁移")
    return skipped, warnings


def _backups(date_key: str, require: bool) -> dict:
    db = BACKUP_DIR / f"russian_tutor_pre_finance_migration_{date_key}.db"
    raw = BACKUP_DIR / f"finance_rt_fin_{date_key}.json"
    missing = [str(p) for p in (db, raw) if not p.is_file()]
    if require and missing:
        raise FileNotFoundError("缺少迁移前备份，拒绝 --apply：" + " | ".join(missing))
    return {"db": str(db) if db.is_file() else "", "rt_fin": str(raw) if raw.is_file() else "",
            "missing": missing}


def _write_report(report: dict) -> Path:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    path = REPORT_DIR / f"migration_report_{_stamp()}.json"
    path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="rt_fin -> finance_* 一次性迁移")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--dry-run", action="store_true", help="只校验/出报告，不写库")
    group.add_argument("--apply", action="store_true", help="单事务写入 finance_*")
    parser.add_argument("--force", action="store_true", help="finance_* 非空时先备份再替换")
    parser.add_argument("--date", default=datetime.now().strftime("%Y%m%d"),
                        help="备份日期键，默认今天（YYYYMMDD）")
    parser.add_argument("--input", default=str(INPUT))
    args = parser.parse_args(argv)
    if not args.apply:
        args.dry_run = True

    source = Path(args.input)
    if not source.is_file():
        print(f"[finance migrate] 输入不存在：{source}", file=sys.stderr)
        return 2
    raw = source.read_bytes()
    try:
        state = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        print(f"[finance migrate] 输入不是合法 UTF-8 JSON：{exc}", file=sys.stderr)
        return 2
    try:
        skipped, warnings = _validate(state)
    except ValueError as exc:
        print(f"[finance migrate] 校验失败：{exc}", file=sys.stderr)
        return 2
    counts = _counts(state)
    digest = hashlib.sha256(raw).hexdigest()
    backups = _backups(args.date, require=args.apply)
    report = {
        "mode": "apply" if args.apply else "dry-run",
        "input": str(source),
        "sha256": digest,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "backups": backups,
        "tables": counts,
        "skipped": skipped,
        "warnings": warnings,
        "ok": True,
    }

    if not args.apply:
        path = _write_report(report)
        print("[finance migrate] dry-run 报告：")
        for table, n in counts.items():
            print(f"  {table}: {n}")
        if skipped:
            print("  跳过：" + "；".join(skipped))
        if warnings:
            print("  警告：" + "；".join(warnings))
        print(f"[finance migrate] 报告：{path}")
        return 0

    try:
        if args.force and not repo.finance_is_empty():
            force_db = BACKUP_DIR / f"russian_tutor_pre_finance_force_{_stamp()}.db"
            shutil.copy2(config.DB_PATH, force_db)
            report["force_backup"] = str(force_db)
        init_db()
        if not args.force and not repo.finance_is_empty():
            raise RuntimeError("finance_* 非空；拒绝 --apply（可显式 --force，会先备份再替换）")
        state["migrated_at"] = datetime.now().isoformat(timespec="seconds")
        state["migration_source"] = f"{source} sha256:{digest}"
        conn = get_conn()
        conn.execute("BEGIN IMMEDIATE")
        try:
            if args.force:
                repo.finance_clear_all(conn)
            repo.finance_replace_state(state, conn=conn)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        report["after"] = {
            "accounts": len(repo.finance_list_accounts()),
            "snapshots": len(repo.finance_list_snapshots()),
        }
        report["state_empty"] = repo.finance_is_empty()
        path = _write_report(report)
        print("[finance migrate] 写入成功：16 类资源已入库")
        print(f"[finance migrate] 报告：{path}")
        return 0
    except Exception as exc:  # noqa: BLE001
        report["ok"] = False
        report["error"] = str(exc)
        path = _write_report(report)
        print(f"[finance migrate] 失败，已回滚：{exc}", file=sys.stderr)
        print(f"[finance migrate] 报告：{path}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
