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
from plugins.market import backend, index_store, packaging

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
    sim_manifest = json.loads((ROOT / "market" / "sources" / "sim" / "manifest.json").read_text(encoding="utf-8"))
    entry = {
        "id": "sim", "name": sim_manifest.get("name") or "随机模拟器",
        "version": str(sim_manifest.get("version") or "1.0"),
        "kind": "functional", "desc": sim_manifest.get("desc") or "",
        "summary": sim_manifest.get("desc") or "", "has_ui": True,
        "icon": sim_manifest.get("icon") or "🎲",
        "sha256": packaging.sha256_bytes(good_zip), "size": len(good_zip),
        "file": "sim.zip", "download_url": "", "source": "local",
        "signature": "", "signed_by": "", "package_ready": True,
    }
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

    real = backend.list_plugins()
    real_items = {x["id"]: x for x in real["plugins"]}
    check("三源合并 23 卡", len(real_items) == 23, str(len(real_items)))
    check("22 个已安装且 sim 可安装",
          sum(1 for x in real_items.values() if x["installed"]) == 22
          and real_items["sim"]["installed"] is False
          and real_items["sim"]["package"] is True)
    check("INFO 来源正确", real_items["russian"]["info_source"] == "plugins"
          and real_items["sim"]["info_source"] == "source"
          and real_items["market"]["preset"] is True)

    # ---- backend 路由（隔离目录，不碰真实 plugins/） ----
    backend.plugins_dir = lambda: plugins
    backend.market_dir = lambda: market
    backend.packages_dir = lambda: packages
    backend.index_store.runtime_path = lambda: market / "index.json"
    backend.index_store.template_path = lambda: market / "index.json"
    backend._record = lambda *a, **k: None
    backend._records = lambda: {}
    (market / "index.json").write_text(json.dumps({"version": 1, "packages": [entry]}), encoding="utf-8")

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
    src = market / "sources" / "ghost"
    src.mkdir(parents=True)
    (src / "INFO.md").write_text("""---
id: ghost
name: Ghost
version: 1.0
kind: functional
has_ui: true
has_backend: false
db_module_key: null
routes_prefix: null
summary: 无包源信息卡
---
""", encoding="utf-8")
    bad = plugins / "testbad"
    bad.mkdir()
    (bad / "INFO.md").write_text("---\nid: testbad\n---\n", encoding="utf-8")
    merged = backend.list_plugins()
    by_id = {x["id"]: x for x in merged["plugins"]}
    check("缺包信息不隐藏卡片", by_id.get("ghost", {}).get("package_error") == "缺包信息"
          and by_id["ghost"]["installed"] is False)
    check("坏 INFO 条目级错误", merged.get("ok") is True
          and "testbad" in by_id and by_id["testbad"].get("info_error"))

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

    # ---- 开发插件：字段/严格校验/写盘/模板缺失 ----
    sc = backend.scaffold
    fields = backend.handle("GET", "/scaffold/fields", {}, {})
    keys = [f["key"] for f in fields.get("fields", [])]
    check("开发插件字段清单", fields.get("ok") is True and len(keys) == 10
          and all(f["required"] and not f["multiline"] for f in fields["fields"]))
    dl = tmp / "dl"; dl.mkdir()
    sc.output_dir = lambda: dl
    vals = {k: "demo-value" for k in keys}
    vals.update({"PLUGIN_ID": "demo", "PLUGIN_NAME": "演示", "PLUGIN_KIND": "functional",
                 "HAS_UI": "是", "NEEDS_DB": "否", "NEEDS_DATA_DIR": "否",
                 "TARGET_DIR": "plugins/demo/"})
    ok = backend.handle("POST", "/scaffold/generate", {}, {"id": "demo", "values": vals})
    import re as _re
    check("生成写盘文件名格式", ok.get("ok") is True
          and _re.fullmatch(r"scaffold-demo-\d{8}-\d{6}\.md", ok.get("filename", ""))
          and Path(ok["path"]).is_file() and not _re.search(r"\{\{[A-Za-z0-9_]+\}\}", Path(ok["path"]).read_text(encoding="utf-8")))
    bad = dict(vals); bad.pop("PLUGIN_NAME")
    check("缺值拒绝", backend.handle("POST", "/scaffold/generate", {},
          {"id": "demo", "values": bad}).get("error") == "missing_values")
    check("路径穿越 id 拒绝", backend.handle("POST", "/scaffold/generate", {},
          {"id": "../evil", "values": vals}).get("error") == "bad_id")
    sc.output_dir = lambda: None
    check("未设置下载地址拒绝", backend.handle("POST", "/scaffold/generate", {},
          {"id": "demo", "values": vals}).get("error") == "not_configured")
    old_tpl = sc.TEMPLATE
    sc.TEMPLATE = tmp / "missing.md"
    try:
        miss = backend.handle("GET", "/scaffold/fields", {}, {})
        still = backend.handle("GET", "/list", {}, {})
    finally:
        sc.TEMPLATE = old_tpl
    check("模板缺失时市场其余接口正常", miss.get("error") == "template_missing"
          and still.get("ok") is True)

    # ---- B 阶段：初始化复制 / 拉取 / 校验 ----
    def pkg(pid):
        return {"id": pid, "name": pid, "version": "1.0", "kind": "functional",
                "desc": "d", "summary": "s", "has_ui": True, "icon": "📦",
                "sha256": "", "size": 0, "file": "", "download_url": "",
                "source": "local", "signature": "", "signed_by": "", "package_ready": False}

    orig_fetch = index_store._fetch_url
    btmp = tmp / "b"; btmp.mkdir()
    tpl = btmp / "template.json"; run = btmp / "runtime.json"
    tpl.write_text(json.dumps({"version": 1, "packages": [pkg(f"p{i}") for i in range(5)]}), encoding="utf-8")
    old_rt, old_tpl = index_store.runtime_path, index_store.template_path
    index_store.runtime_path = lambda: run
    index_store.template_path = lambda: tpl
    try:
        index_store.ensure_runtime()
        first = json.loads(run.read_text(encoding="utf-8"))
        run.write_text(json.dumps({"version": 9, "packages": [pkg("kept")]}), encoding="utf-8")
        index_store.ensure_runtime()
        kept = json.loads(run.read_text(encoding="utf-8"))
        check("首次初始化复制 5 条且不覆盖", len(first["packages"]) == 5
              and kept["version"] == 9 and kept["packages"][0]["id"] == "kept")
        remote = {"version": 10, "packages": [pkg(f"r{i}") for i in range(23)]}
        index_store._fetch_url = lambda url: json.dumps(remote).encode()
        out = index_store.refresh("https://example.com/index.json")
        now = json.loads(run.read_text(encoding="utf-8"))
        check("拉取成功覆盖并升版", out["version"] == 10 and len(now["packages"]) == 23)
        before = run.read_bytes()
        def bad_remote(data):
            run.write_bytes(before)
            index_store._fetch_url = lambda url: data
            try:
                index_store.refresh("https://example.com/index.json")
            except index_store.IndexError_ as exc:
                return exc.code
            return "no_error"
        checks = {
            "非法 JSON": (b"not json", "invalid_structure"),
            "缺字段": (json.dumps({"version": 3, "packages": [{"id": "x"}]}).encode(), "invalid_structure"),
            "路径穿越 file": (json.dumps({"version": 3, "packages": [dict(pkg("x"), file="../a.zip", package_ready=True,
                sha256="0"*64)]}).encode(), "invalid_structure"),
            "sha256 非法": (json.dumps({"version": 3, "packages": [dict(pkg("x"), package_ready=True,
                file="a.zip", sha256="zz")]}).encode(), "invalid_structure"),
            "版本回滚": (json.dumps({"version": 1, "packages": [pkg("x")]}).encode(), "version_regression"),
        }
        failed = []
        for name, (data, expect) in checks.items():
            got = bad_remote(data)
            if got != expect or run.read_bytes() != before:
                failed.append(f"{name}:{got}")
        check("拉取失败不动本地且错误码正确", not failed, " | ".join(failed))
        try:
            index_store.refresh("")
        except index_store.IndexError_ as exc:
            nc = exc.code
        else:
            nc = "no_error"
        check("未配置返回 not_configured", nc == "not_configured")
        index_store._fetch_url = orig_fetch
        try:
            index_store._fetch_url("http://127.0.0.1/x")
        except index_store.IndexError_ as exc:
            sec = exc.code
        else:
            sec = "no_error"
        check("生产路径拒绝 http", sec == "insecure_url")
        bad_tpl = btmp / "bad.json"; bad_tpl.write_text(json.dumps({"packages": []}), encoding="utf-8")
        bad_run = btmp / "bad_runtime.json"
        index_store.template_path = lambda: bad_tpl
        index_store.runtime_path = lambda: bad_run
        try:
            index_store.ensure_runtime()
        except index_store.IndexError_ as exc:
            bad_code = exc.code
        else:
            bad_code = "no_error"
        check("非法模板拒绝初始化", bad_code == "invalid_structure" and not bad_run.exists())
    finally:
        index_store.runtime_path, index_store.template_path = old_rt, old_tpl
        index_store._fetch_url = orig_fetch

    shutil.rmtree(tmp, ignore_errors=True)
    print(f"\nRESULT: {results.count(True)}/{len(results)} PASS")
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
