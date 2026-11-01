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
    check("远程缺失本地开发不消失", "ai" in {x["id"] for x in listed2["plugins"]})
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
    check("旧文件迁移 local21/remote2 并删除旧文件",
          len(lm["packages"]) == 21 and [p["id"] for p in rm["packages"]] == ["finance", "promptgen"]
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

    shutil.rmtree(tmp, ignore_errors=True)
    print(f"\nRESULT: {results.count(True)}/{len(results)} PASS")
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
