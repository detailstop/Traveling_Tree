"""插件市场 smoke：安全校验、安装/卸载/重装、预置保护、列表结构。

运行：python tests/smoke_market.py
"""
from __future__ import annotations

import io
import json
import shutil
import sqlite3
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import config
from plugins.market import backend, packaging

results: list[bool] = []


def check(name: str, cond, extra: str = "") -> None:
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""))


def make_zip(files: dict[str, bytes], symlink: str | None = None) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in files.items():
            info = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
            info.external_attr = 0o644 << 16
            zf.writestr(info, data)
        if symlink:
            info = zipfile.ZipInfo(symlink, (2026, 1, 1, 0, 0, 0))
            info.external_attr = (0o120777 << 16)
            zf.writestr(info, b"target")
    return buf.getvalue()


def expect_error(name: str, fn, code: str) -> None:
    try:
        fn()
    except packaging.MarketError as exc:
        check(name, exc.code == code, f"{exc.code}: {exc.message}")
    except Exception as exc:  # noqa: BLE001
        check(name, False, f"意外异常 {type(exc).__name__}: {exc}")
    else:
        check(name, False, "未抛错")


def main() -> int:
    real_zip = ROOT / "market" / "packages" / "sim.zip"
    if not real_zip.is_file():
        print("FAIL 缺少 market/packages/sim.zip，请先运行 tools/build_market_packages.py")
        return 1
    good_zip = real_zip.read_bytes()
    index = json.loads((ROOT / "market" / "index.json").read_text(encoding="utf-8"))
    entry = next(p for p in index["packages"] if p["id"] == "sim")
    check("index SHA256 与包一致", entry["sha256"] == packaging.sha256_bytes(good_zip))

    tmp = Path(tempfile.mkdtemp(prefix="rt_market_test_"))
    plugins = tmp / "plugins"
    market = tmp / "market"
    packages = market / "packages"
    plugins.mkdir(parents=True)
    packages.mkdir(parents=True)
    (packages / "sim.zip").write_bytes(good_zip)

    good_manifest = (ROOT / "market" / "sources" / "sim" / "manifest.json").read_bytes()
    malicious = {
        "traversal": make_zip({"manifest.json": good_manifest, "../evil.txt": b"x"}),
        "absolute": make_zip({"manifest.json": good_manifest, "/abs.txt": b"x"}),
        "symlink": make_zip({"manifest.json": good_manifest}, symlink="link"),
    }
    mismatch = make_zip({"manifest.json": json.dumps({"id": "other"}).encode()})

    expect_error("拒绝路径穿越", lambda: packaging.validate_and_extract(
        malicious["traversal"], tmp / "t1", "sim"), "bad_zip")
    expect_error("拒绝绝对路径", lambda: packaging.validate_and_extract(
        malicious["absolute"], tmp / "t2", "sim"), "bad_zip")
    expect_error("拒绝符号链接", lambda: packaging.validate_and_extract(
        malicious["symlink"], tmp / "t3", "sim"), "bad_zip")
    expect_error("拒绝 manifest id 不一致", lambda: packaging.validate_and_extract(
        mismatch, tmp / "t4", "sim"), "id_mismatch")
    bad_entry = dict(entry, sha256="0" * 64)
    expect_error("拒绝 SHA256 不符", lambda: packaging.install_package(
        bad_entry, good_zip, plugins, tmp / "tmp"), "sha256_mismatch")

    manifest = packaging.install_package(entry, good_zip, plugins, tmp / "tmp")
    check("安装成功且 manifest id 正确", (plugins / "sim" / "manifest.json").is_file()
          and manifest.get("id") == "sim")
    expect_error("重复安装被拒", lambda: packaging.install_package(
        entry, good_zip, plugins, tmp / "tmp"), "already_installed")
    removed = packaging.remove_plugin("sim", plugins, market / ".trash")
    check("卸载移出 plugins 且保留备份", not (plugins / "sim").exists() and removed.is_dir())
    packaging.install_package(entry, good_zip, plugins, tmp / "tmp")
    check("重装成功", (plugins / "sim" / "manifest.json").is_file())

    backup = packaging.backup_private_data(
        "sim", tmp / "data" / "plugins", tmp / "data" / "backup")
    check("无数据目录时不备份", backup is None)

    # ---- backend 路由（隔离目录，不碰真实 plugins/） ----
    backend.plugins_dir = lambda: plugins
    backend.market_dir = lambda: market
    backend.packages_dir = lambda: packages
    backend.index_path = lambda: market / "index.json"
    backend._record = lambda *a, **k: None
    backend._records = lambda: {}
    (market / "index.json").write_text(json.dumps({"packages": [entry]}), encoding="utf-8")

    demo = plugins / "testdemo"
    demo.mkdir()
    (demo / "schema.sql").write_text(
        "CREATE TABLE IF NOT EXISTS test_demo_items (id TEXT PRIMARY KEY);\n", encoding="utf-8")
    check("通用 test* 规则识别 test_ 表", backend._test_tables("testdemo") == ["test_demo_items"]
          and backend._test_tables("sim") == [])

    listed = backend.handle("GET", "/list", {}, {})
    item = next(p for p in listed["plugins"] if p["id"] == "sim")
    check("/list 结构完整", {"id", "name", "kind", "desc", "version", "installed",
                             "preset", "package", "size", "sha256"} <= set(item))
    check("/list 预置标记", next(p for p in listed["plugins"] if p["id"] == "market")["preset"] is True)
    check("预置不可卸载", backend.handle("POST", "/uninstall", {}, {"id": "market"})["error"]
          == "preset_protected")

    shutil.rmtree(plugins / "sim")
    r = backend.handle("POST", "/install", {}, {"id": "sim"})
    check("路由安装成功", r.get("ok") is True and (plugins / "sim").is_dir())

    (tmp / "data" / "plugins" / "sim").mkdir(parents=True)
    (tmp / "data" / "plugins" / "sim" / "private.txt").write_text("x", encoding="utf-8")
    old_data = config.DATA_DIR
    config.DATA_DIR = tmp / "data"
    try:
        r = backend.handle("POST", "/uninstall", {}, {"id": "sim", "delete_data": True})
    finally:
        config.DATA_DIR = old_data
    check("卸载保留数据备份", r.get("ok") is True and r.get("data_backup")
          and Path(r["data_backup"]).is_dir())
    check("勾选后私有目录已删除", not (tmp / "data" / "plugins" / "sim").exists())
    r = backend.handle("POST", "/install", {}, {"id": "sim"})
    check("卸载后可重装", r.get("ok") is True and (plugins / "sim").is_dir())

    # ---- 测试表卸载：仅 testprobe + 整库备份 + 只 DROP test_ 表 ----
    check("非测试插件禁删表", backend.handle(
        "POST", "/uninstall", {}, {"id": "sim", "delete_tables": True}).get("error")
        == "delete_tables_forbidden")
    dbp = tmp / "probe.db"
    dbc = sqlite3.connect(dbp)
    dbc.execute("CREATE TABLE test_probe_items (id TEXT PRIMARY KEY)")
    dbc.execute("CREATE TABLE keep_me (id TEXT PRIMARY KEY)")
    dbc.execute("INSERT INTO keep_me VALUES('k')")
    dbc.commit(); dbc.close()
    bak = packaging.backup_database(dbp, tmp / "dbbak")
    packaging.drop_test_tables(dbp, ["test_probe_items"])
    names = {r[0] for r in sqlite3.connect(dbp).execute(
        "SELECT name FROM sqlite_master WHERE type='table'")}
    bak_names = {r[0] for r in sqlite3.connect(bak).execute(
        "SELECT name FROM sqlite_master WHERE type='table'")}
    check("备份存在且含删除前表", bak.is_file() and {"test_probe_items", "keep_me"} <= bak_names)
    check("仅删除 test_ 表", "test_probe_items" not in names and "keep_me" in names)
    expect_error("禁删非 test_ 表", lambda: packaging.drop_test_tables(
        dbp, ["keep_me"]), "forbidden")

    shutil.rmtree(tmp, ignore_errors=True)
    print(f"\nRESULT: {results.count(True)}/{len(results)} PASS")
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
