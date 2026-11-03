"""市场 smoke：安全校验、双索引、四源合并、安装/下载、三类状态。"""
from __future__ import annotations

import io
import json
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import config
from plugins.market import backend, index_store, packaging, validate as vp
from plugins.market.validate import ERROR_CODES, WARNING_CODES

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
            info.external_attr = 0o120777 << 16
            zf.writestr(info, b"target")
    return buf.getvalue()


def pkg(pid: str, ready: bool = False, **kw) -> dict:
    base = {"id": pid, "name": pid, "version": "1.0", "kind": "functional",
            "desc": "d", "summary": "s", "has_ui": True, "icon": "📦",
            "sha256": "", "size": 0, "file": "", "download_url": "",
            "source": "local", "signature": "", "signed_by": "", "package_ready": ready}
    base.update(kw)
    return base


def expect_error(name: str, fn, code: str) -> None:
    try:
        fn()
    except packaging.MarketError as exc:
        check(name, exc.code == code, exc.message)
    except Exception as exc:  # noqa: BLE001
        check(name, False, f"意外异常 {type(exc).__name__}: {exc}")
    else:
        check(name, False, "未抛错")


def main() -> int:
    tmp = Path(tempfile.mkdtemp(prefix="rt_market_test_"))
    plugins = tmp / "plugins"; plugins.mkdir()
    market = tmp / "market"; (market / "packages").mkdir(parents=True)
    packages = market / "packages"
    localp = tmp / "local_index.json"
    remotep = tmp / "remote_index.json"
    downloads = tmp / "downloads"
    index_store.local_path = lambda: localp
    index_store.remote_path = lambda: remotep
    index_store.downloads_dir = lambda: downloads
    backend.plugins_dir = lambda: plugins
    backend.packages_dir = lambda: packages
    backend.market_dir = lambda: market
    backend._record = lambda *a, **k: None
    backend._records = lambda: {}

    good_manifest = json.dumps({"id": "pub", "name": "公共库", "version": "1.0"}).encode()
    good_zip = make_zip({"manifest.json": good_manifest, "feature.js": b""})
    good_sha = packaging.sha256_bytes(good_zip)
    (packages / "pub.zip").write_bytes(good_zip)

    malicious = {
        "traversal": make_zip({"manifest.json": good_manifest, "../evil.txt": b"x"}),
        "absolute": make_zip({"manifest.json": good_manifest, "/abs.txt": b"x"}),
        "symlink": make_zip({"manifest.json": good_manifest}, symlink="link"),
    }
    expect_error("拒绝路径穿越", lambda: packaging.validate_and_extract(
        malicious["traversal"], tmp / "t1", "pub"), "bad_zip")
    expect_error("拒绝绝对路径", lambda: packaging.validate_and_extract(
        malicious["absolute"], tmp / "t2", "pub"), "bad_zip")
    expect_error("拒绝符号链接", lambda: packaging.validate_and_extract(
        malicious["symlink"], tmp / "t3", "pub"), "bad_zip")
    expect_error("拒绝 manifest id 不一致", lambda: packaging.validate_and_extract(
        make_zip({"manifest.json": json.dumps({"id": "other"}).encode()}),
        tmp / "t4", "pub"), "id_mismatch")
    expect_error("拒绝 SHA256 不符", lambda: packaging.install_package(
        pkg("pub", True, sha256="0" * 64, file="pub.zip"),
        good_zip, plugins, tmp / "tmp"), "sha256_mismatch")

    localp.write_text(json.dumps({"version": 1, "packages": [
        pkg("market"), pkg("ai"), pkg("sim")]}), encoding="utf-8")
    remotep.write_text(json.dumps({"version": 1, "packages": [
        pkg("pub", True, sha256=good_sha, size=len(good_zip), file="pub.zip",
            download_url="")]}), encoding="utf-8")
    listed = backend.handle("GET", "/list", {}, {})
    items = {x["id"]: x for x in listed["plugins"]}
    check("双索引四源合并", listed.get("ok") is True and len(items) == 8)
    check("三类状态正确", items["market"]["plugin_source"] == "preset"
          and items["pub"]["plugin_source"] == "market"
          and items["ai"]["plugin_source"] == "local")
    check("本地开发无包", items["ai"]["package"] is False and items["ai"]["package_ready"] is False)
    check("公共库包字段", items["pub"]["package"] is True and items["pub"]["sha256"] == good_sha)

    remotep.unlink()
    listed2 = backend.handle("GET", "/list", {}, {})
    local_ids = [p["id"] for p in index_store._local_packages(index_store._info_entries())["packages"]]
    probe_local = local_ids[0] if local_ids else ""
    check("远程缺失本地开发不消失", bool(probe_local) and probe_local in {x["id"] for x in listed2["plugins"]})
    remotep.write_text(json.dumps({"version": 1, "packages": [
        pkg("pub", True, sha256=good_sha, size=len(good_zip), file="pub.zip",
            download_url="")]}), encoding="utf-8")

    check("本地开发不可安装", backend.handle("POST", "/install", {},
          {"id": "ai"}).get("error") == "no_package")
    r = backend.handle("POST", "/install", {}, {"id": "pub"})
    check("安装成功（本地包）", r.get("ok") is True and (plugins / "pub" / "manifest.json").is_file())
    shutil.rmtree(plugins / "pub")

    (packages / "pub.zip").unlink()
    r = backend.handle("POST", "/install", {}, {"id": "pub"})
    check("download_url 为空报包地址未配置", r.get("error") == "package_url_missing")

    remote_dl = pkg("pub", True, sha256=good_sha, size=len(good_zip), file="pub.zip",
                    download_url="https://example.com/pub.zip")
    remotep.write_text(json.dumps({"version": 1, "packages": [remote_dl]}), encoding="utf-8")
    orig_fetch = index_store._fetch_url
    index_store._fetch_url = lambda url: good_zip
    try:
        r = backend.handle("POST", "/install", {}, {"id": "pub"})
        check("download_url 下载安装并清理", r.get("ok") is True
              and (plugins / "pub" / "manifest.json").is_file()
              and not (downloads / "pub.zip").exists())
        shutil.rmtree(plugins / "pub")
        bad = dict(remote_dl, sha256="0" * 64)
        remotep.write_text(json.dumps({"version": 1, "packages": [bad]}), encoding="utf-8")
        r = backend.handle("POST", "/install", {}, {"id": "pub"})
        check("下载失败保留 zip", r.get("error") == "sha256_mismatch"
              and (downloads / "pub.zip").is_file())
    finally:
        index_store._fetch_url = orig_fetch

    # 旧文件迁移
    mig = tmp / "mig"; mig.mkdir()
    index_store.local_path = lambda: mig / "local_index.json"
    index_store.remote_path = lambda: mig / "remote_index.json"
    legacy = mig / "index.json"
    legacy.write_text(json.dumps({"version": 3, "packages": [
        pkg("finance", True, sha256="a" * 64, size=1, file="finance.zip"),
        pkg("promptgen", True, sha256="b" * 64, size=1, file="promptgen.zip"),
        pkg("ai")]}), encoding="utf-8")
    index_store.ensure_runtime()
    lm = json.loads((mig / "local_index.json").read_text(encoding="utf-8"))
    rm = json.loads((mig / "remote_index.json").read_text(encoding="utf-8"))
    expected_local = len(index_store._local_packages(index_store._info_entries())["packages"])
    check("旧文件迁移 local/remote 并删除旧文件",
          len(lm["packages"]) == expected_local
          and [p["id"] for p in rm["packages"]] == ["finance", "promptgen"]
          and not legacy.exists())

    before_local = (mig / "local_index.json").read_bytes()
    remote2 = {"version": 4, "packages": [pkg("pub", True, sha256="c" * 64, size=1, file="pub.zip")]}
    index_store._fetch_url = lambda url: json.dumps(remote2).encode()
    try:
        out = index_store.refresh("https://example.com/index.json")
    finally:
        index_store._fetch_url = orig_fetch
    check("刷新写 remote 且 local 不变", out["version"] == 4
          and (mig / "local_index.json").read_bytes() == before_local)
    for data, code in [
        (b"not json", "invalid_structure"),
        (json.dumps({"version": 9, "packages": [{"id": "x"}]}).encode(), "invalid_structure"),
        (json.dumps({"version": 1, "packages": [pkg("pub", True, sha256="0" * 64,
                                                    size=0, file="../a.zip")]}).encode(), "invalid_structure"),
    ]:
        index_store._fetch_url = lambda url, d=data: d
        try:
            index_store.refresh("https://example.com/index.json")
        except index_store.IndexError_ as exc:
            got = exc.code
        else:
            got = "no_error"
        check(f"刷新失败拒绝（{code}）", got == code)
    index_store._fetch_url = orig_fetch
    try:
        index_store.refresh("")
    except index_store.IndexError_ as exc:
        nc = exc.code
    else:
        nc = "no_error"
    check("未配置 not_configured", nc == "not_configured")

    # ---- 校验打包 ----
    ok_res = vp.validate(str(ROOT / "plugins" / "market"))
    check("校验 plugins/market 通过", ok_res["ok"] is True and ok_res["id"] == "market")
    bad = tmp / "badid"; bad.mkdir()
    (bad / "manifest.json").write_text(json.dumps(
        {"schema_version": 2, "id": "other", "name": "x", "version": "1", "entries": []}),
        encoding="utf-8")
    r = vp.validate(str(bad))
    check("缺 INFO/manifest 错误码", "info_missing" in [e["code"] for e in r["errors"]]
          and "manifest_id_mismatch" in [e["code"] for e in r["errors"]])
    pkgdir = tmp / "badpkg"; pkgdir.mkdir()
    (pkgdir / "manifest.json").write_text(json.dumps(
        {"schema_version": 2, "id": "badpkg", "name": "x", "version": "1", "entries": [],
         "backend": None, "db": None}), encoding="utf-8")
    (pkgdir / "INFO.md").write_text("""---
id: badpkg
name: x
version: 1
kind: functional
has_ui: false
has_backend: false
db_module_key: null
routes_prefix: null
summary: x
source: market
market_package: false
---
""", encoding="utf-8")
    codes = [e["code"] for e in vp.validate(str(pkgdir))["errors"]]
    check("source/market_package 配对错误", "source_package_mismatch" in codes)
    tdir = tmp / "badtables"; tdir.mkdir()
    (tdir / "manifest.json").write_text(json.dumps(
        {"schema_version": 2, "id": "badtables", "name": "x", "version": "1", "entries": []}),
        encoding="utf-8")
    (tdir / "schema.sql").write_text("CREATE TABLE real_table (id TEXT);", encoding="utf-8")
    (tdir / "INFO.md").write_text("""---
id: badtables
name: x
version: 1
kind: functional
has_ui: false
has_backend: false
db_module_key: badtables
routes_prefix: null
summary: x
tables: [other_table]
source: local
market_package: false
---
""", encoding="utf-8")
    check("tables 与 schema 不一致", "tables_mismatch" in [e["code"] for e in vp.validate(str(tdir))["errors"]])

    out = tmp / "build"
    packed = vp.pack(str(ROOT / "plugins" / "market"), str(out))
    check("校验通过后打包", packed.get("ok") is True and Path(packed["zip_path"]).is_file())
    with zipfile.ZipFile(packed["zip_path"]) as zf:
        names = zf.namelist()
    check("zip 内容干净", "manifest.json" in names and "README.md" in names
          and "INFO.md" in names and not any("__pycache__" in n or n.startswith("data/") for n in names))
    failed = vp.pack(str(bad), str(out / "bad"))
    check("校验失败拒绝打包", failed.get("ok") is False
          and not (out / "bad" / "badid.zip").exists())
    http_res = backend.handle("POST", "/validate-pack/check", {}, {"path": str(ROOT / "plugins" / "market")})
    http_pack = backend.handle("POST", "/validate-pack/pack", {},
                               {"path": str(ROOT / "plugins" / "market"), "out_dir": str(out / "http")})
    check("HTTP/Python 双出口一致", http_res["ok"] is True and http_pack.get("ok") is True
          and Path(http_pack["zip_path"]).is_file())

    # ---- dependencies 子键：最终只保留 python（round 109） ----
    _local_ids = [p["id"] for p in index_store._local_packages(index_store._info_entries())["packages"]]
    _probe = next((pid for pid in _local_ids if (ROOT / "plugins" / pid / "manifest.json").is_file()), "market")
    dep_src = tmp / _probe
    shutil.copytree(ROOT / "plugins" / _probe, dep_src)
    dep_manifest = dep_src / "manifest.json"
    base_manifest = json.loads(dep_manifest.read_text(encoding="utf-8"))
    for key in ("plugins", "plugin", "shared", "js"):
        bad = dict(base_manifest, dependencies={key: ["x"]})
        dep_manifest.write_text(json.dumps(bad, ensure_ascii=False, indent=2), encoding="utf-8")
        r = vp.validate(str(dep_src))
        check(f"dependencies.{key} 子键被拒",
              r["ok"] is False and "dependencies_subkey_invalid" in [e["code"] for e in r["errors"]],
              str([e["code"] for e in r["errors"]]))
    with_python = dict(base_manifest, dependencies={"python": ["pip", {"name": "edge-tts", "version": ">=6.1"}]})
    dep_manifest.write_text(json.dumps(with_python, ensure_ascii=False, indent=2), encoding="utf-8")
    r = vp.validate(str(dep_src))
    check("dependencies.python 合法通过", r["ok"] is True and not r["errors"],
          str([e["code"] for e in r["errors"]]))
    with_bad_python = dict(base_manifest, dependencies={"python": "pip"})
    dep_manifest.write_text(json.dumps(with_bad_python, ensure_ascii=False, indent=2), encoding="utf-8")
    r = vp.validate(str(dep_src))
    check("dependencies.python 非数组被拒",
          r["ok"] is False and "dependencies_invalid" in [e["code"] for e in r["errors"]],
          str([e["code"] for e in r["errors"]]))

    # ---- 文档错误码与常量一致 ----
    import re as _re
    readme_text = (ROOT / "plugins" / "market" / "README.md").read_text(encoding="utf-8")
    def _doc_codes(label):
        m = _re.search(r"^- " + label + r"：(.+)$", readme_text, _re.M)
        return set(_re.findall(r"`([a-z_]+)`", m.group(1))) if m else set()
    doc_err = _doc_codes("错误码")
    doc_warn = _doc_codes("警告码")
    check("错误码文档与常量一致", doc_err == set(ERROR_CODES),
          "文档多：" + ",".join(sorted(doc_err - set(ERROR_CODES)))
          + " 文档缺：" + ",".join(sorted(set(ERROR_CODES) - doc_err)))
    check("警告码文档与常量一致", doc_warn == set(WARNING_CODES),
          "文档多：" + ",".join(sorted(doc_warn - set(WARNING_CODES)))
          + " 文档缺：" + ",".join(sorted(set(WARNING_CODES) - doc_warn)))

    shutil.rmtree(tmp, ignore_errors=True)
    print(f"\nRESULT: {results.count(True)}/{len(results)} PASS")
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
