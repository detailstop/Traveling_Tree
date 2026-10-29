"""
PDF 插件 v2 · 冒烟测试（临时数据库/临时目录，不触碰真实数据）。

覆盖：
  - manifest v2：pdf/batch 两个 entry、backend.py、db=null、style=plugin.css；
  - /plugins/pdf/feature_pdf.js、feature_batch.js、plugin.css 可访问；
  - /api/plugin/pdf/batch/scan 不依赖可选库；
  - pdf/merge 缺依赖时结构化报错、不冒泡；
  - 动态 backend 的 __binary__ 响应（monkeypatch merge，绕过可选库）；
  - 旧 /api/pdf/* 404、backend.py 静态不暴露、错误方法 405。

运行：python tests/smoke_pdf.py
"""
from __future__ import annotations

import base64
import json
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

TMP = Path(tempfile.mkdtemp(prefix="rt_pdf_test_"))

import config  # noqa: E402

config.DATA_DIR = TMP
config.DB_PATH = TMP / "russian_tutor.db"
config.COBUILD_LOG_PATH = TMP / "docs" / "多AI共建日志.md"

import ui.web.server as srv  # noqa: E402
from ui.web.server import Handler, ThreadingHTTPServer, _bootstrap_db  # noqa: E402

results: list[bool] = []


def check(name: str, cond, extra: str = "") -> None:
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""))


def main() -> int:
    _bootstrap_db()
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    port = httpd.server_address[1]
    base = f"http://127.0.0.1:{port}"
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    time.sleep(0.35)

    def get(path: str):
        try:
            with urllib.request.urlopen(base + path, timeout=20) as response:
                return response.status, dict(response.headers), response.read()
        except urllib.error.HTTPError as exc:
            return exc.code, dict(exc.headers), exc.read()

    def post(path: str, payload=None):
        body = json.dumps(payload or {}).encode("utf-8")
        request = urllib.request.Request(
            base + path, data=body, method="POST",
            headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.status, dict(response.headers), response.read()
        except urllib.error.HTTPError as exc:
            return exc.code, dict(exc.headers), exc.read()

    try:
        status, _, body = get("/api/plugins/list")
        data = json.loads(body.decode("utf-8")) if body else {}
        pdf = next((p for p in data.get("plugins", []) if p.get("id") == "pdf"), None)
        check("pdf 清单存在", status == 200 and isinstance(pdf, dict), f"HTTP {status}")
        check("pdf manifest v2",
              isinstance(pdf, dict) and pdf.get("schema_version") == 2)
        check("pdf 两个 entry",
              isinstance(pdf, dict)
              and [e.get("id") for e in pdf.get("entries", [])] == ["pdf", "batch"])
        check("pdf backend/style 声明",
              isinstance(pdf, dict) and pdf.get("backend") == "backend.py"
              and pdf.get("style_url") == "/plugins/pdf/plugin.css")

        for path, ctype in (
            ("/plugins/pdf/feature_pdf.js", "javascript"),
            ("/plugins/pdf/feature_batch.js", "javascript"),
            ("/plugins/pdf/plugin.css", "css"),
        ):
            status, headers, _ = get(path)
            lower = {k.lower(): v for k, v in headers.items()}
            check(f"静态资源 {path}",
                  status == 200 and ctype in lower.get("content-type", ""),
                  f"HTTP {status}")
        status, _, _ = get("/plugins/pdf/backend.py")
        check("backend.py 不静态暴露", status == 404, f"HTTP {status}")

        pdf_dir = TMP / "pdfs"
        pdf_dir.mkdir(parents=True, exist_ok=True)
        (pdf_dir / "dummy.pdf").write_bytes(b"%PDF-1.4\n%%EOF\n")
        status, _, body = post("/api/plugin/pdf/batch/scan",
                               {"path": str(pdf_dir), "min_kb": 0})
        scan = json.loads(body.decode("utf-8")) if body else {}
        check("batch/scan 不依赖可选库",
              status == 200 and scan.get("ok") is True and scan.get("count") == 1,
              f"HTTP {status} count={scan.get('count')}")

        status, _, body = post("/api/plugin/pdf/pdf/merge", {"files": []})
        merge_err = json.loads(body.decode("utf-8")) if body else {}
        check("merge 缺依赖结构化报错",
              status in (400, 500)
              and (status == 400 or merge_err.get("error") == "missing_dependency"),
              f"HTTP {status} error={merge_err.get('error')}")
        check("merge 报错不冒泡", b"Traceback" not in body)

        status, _, _ = get("/api/plugin/pdf/batch/scan")
        check("pdf 不支持的方法 405", status == 405, f"HTTP {status}")
        status, _, _ = post("/api/pdf/merge", {"files": []})
        check("旧 /api/pdf 路由 404", status == 404, f"HTTP {status}")

        # __binary__ 路由：替换 merge，避免依赖 pikepdf，直接验证动态 binary 响应。
        module, spec = srv._plugin_backend("pdf")
        original_merge = module.merge
        fake_pdf = b"%PDF-1.4\n% smoke binary\n%%EOF\n"
        module.merge = lambda files: fake_pdf
        try:
            sample = base64.b64encode(b"%PDF-1.4\n%%EOF\n").decode("ascii")
            status, headers, body = post(
                "/api/plugin/pdf/pdf/merge",
                {"files": [{"name": "a.pdf", "data": sample},
                           {"name": "b.pdf", "data": sample}]})
            lower = {k.lower(): v for k, v in headers.items()}
            check("binary 响应 200", status == 200, f"HTTP {status}")
            check("binary Content-Type",
                  "application/pdf" in lower.get("content-type", ""),
                  lower.get("content-type", ""))
            check("binary 附件名",
                  "merged.pdf" in lower.get("content-disposition", ""),
                  lower.get("content-disposition", ""))
            check("binary 内容一致", body == fake_pdf, f"{len(body)}B")
        finally:
            module.merge = original_merge
    finally:
        httpd.shutdown()

    print(f"\nRESULT: {results.count(True)}/{len(results)} PASS")
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
