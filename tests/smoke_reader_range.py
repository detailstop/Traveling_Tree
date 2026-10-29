"""
任务 2/3 · 待清洗起止条数与分组下载配置接口冒烟（临时数据库）。

覆盖：
  - GET /api/plugin/book_reader/reader/pending 的 start/end 默认全量、含两端、越界提示；
  - POST /api/plugin/book_reader/reader/cleaning/export 的范围与任务记录 range_start/range_end/range_total；
  - 默认全量行为不变；空范围不创建任务；
  - /api/settings 的 download_groups 读写、与既有设置共存；
  - 静态文件包含分组下载与提示词/书籍阅读的接入调用。

运行：python tests/smoke_reader_range.py
"""
import json
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

TMP = Path(tempfile.mkdtemp(prefix="rt_reader_range_test_"))

import config  # noqa: E402
config.DATA_DIR = TMP
config.DB_PATH = TMP / "russian_tutor.db"
config.COBUILD_LOG_PATH = TMP / "docs" / "多AI共建日志.md"

from ui.web.server import Handler, ThreadingHTTPServer, _bootstrap_db  # noqa: E402

PORT = 8897
BASE = f"http://127.0.0.1:{PORT}"


def req(method: str, path: str, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(
        BASE + path, data=data, method=method,
        headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8") or "{}")


def main() -> int:
    _bootstrap_db()
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    time.sleep(0.4)
    ok: list[bool] = []

    def check(name, cond, extra=""):
        ok.append(bool(cond))
        print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""))

    code, d = req("POST", "/api/plugin/book_reader/books", {"name": "范围测试书"})
    check("create book", d["ok"], str(d.get("error")))
    root = d["book"]["root_section_id"]
    records = [
        {"sentence_ru": "Я читаю книгу.", "translation_zh": "我在读书。", "key_words": ["читаю"]},
        {"sentence_ru": "Она пьёт чай.", "translation_zh": "她在喝茶。", "key_words": ["пьёт"]},
        {"sentence_ru": "Мы учим русский.", "translation_zh": "我们学俄语。", "key_words": ["учим"]},
    ]
    code, d = req("POST", f"/api/plugin/book_reader/reader/sections/{root}/append", {"records": records})
    check("append records + auto marks", d["ok"] and d["imported"] == 3, str(d.get("imported")))

    code, d = req("GET", "/api/plugin/book_reader/reader/pending")
    check("pending default total 3", d["ok"] and d["total"] == 3 and len(d["items"]) == 3,
          f"total={d.get('total')} items={len(d.get('items', []))}")
    check("pending default range 1-3", d["start"] == 1 and d["end"] == 3, f"{d['start']}-{d['end']}")

    code, d = req("GET", "/api/plugin/book_reader/reader/pending?start=2&end=3")
    check("pending range 2-3", d["ok"] and len(d["items"]) == 2 and d["start"] == 2 and d["end"] == 3,
          f"items={len(d.get('items', []))} range={d.get('start')}-{d.get('end')}")
    check("pending range first is second mark", d["items"][0]["surface"] == "пьёт", d["items"][0]["surface"])

    code, d = req("GET", "/api/plugin/book_reader/reader/pending?start=99")
    check("pending start out of range empty with note", d["ok"] and d["items"] == []
          and d["start"] == 4 and d["end"] == 3 and d["range_notes"], str(d.get("range_notes")))

    code, d = req("POST", "/api/plugin/book_reader/reader/cleaning/export",
                  {"scope": "global", "start": 2, "end": 3})
    check("export range 2-3", d["ok"] and len(d["items"]) == 2
          and d["range"] == {"start": 2, "end": 3, "total": 3}, str(d.get("range")))
    range_task = d.get("task_id")
    check("export task id", bool(range_task))

    code, d = req("POST", "/api/plugin/book_reader/reader/cleaning/export", {"scope": "global"})
    check("export default all", d["ok"] and len(d["items"]) == 3
          and d["range"] == {"start": 1, "end": 3, "total": 3}, str(d.get("range")))
    all_task = d.get("task_id")

    code, d = req("POST", "/api/plugin/book_reader/reader/cleaning/export",
                  {"scope": "global", "start": 99})
    check("export empty range no task", d["ok"] and d["task_id"] is None and d["items"] == []
          and d["range_notes"], str(d.get("range_notes")))

    import sqlite3
    con = sqlite3.connect(config.DB_PATH)
    con.row_factory = sqlite3.Row
    row = con.execute("SELECT * FROM reader_cleaning_tasks WHERE task_id=?", (range_task,)).fetchone()
    check("task range columns", row is not None and row["range_start"] == 2
          and row["range_end"] == 3 and row["range_total"] == 3,
          str(dict(row) if row else None))
    row2 = con.execute("SELECT * FROM reader_cleaning_tasks WHERE task_id=?", (all_task,)).fetchone()
    check("default task range columns", row2 is not None and row2["range_start"] == 1
          and row2["range_end"] == 3 and row2["range_total"] == 3,
          str(dict(row2) if row2 else None))
    con.close()

    # 设置：分组下载配置 + 既有设置共存
    code, d = req("POST", "/api/settings", {
        "new_quota": 7,
        "download_groups": {"promptgen": {"enabled": True, "dir_name": "提示词目录"},
                            "bad key!": {"enabled": True, "dir_name": "x"}},
    })
    check("save download group", d["ok"] and d["new_quota"] == 7
          and d["download_groups"].get("promptgen", {}).get("dir_name") == "提示词目录",
          str(d.get("download_groups")))
    check("invalid group key dropped", "bad key!" not in d["download_groups"])
    code, d = req("GET", "/api/settings")
    check("read download group", d["download_groups"].get("promptgen", {}).get("enabled") is True)
    code, d = req("POST", "/api/settings", {
        "download_groups": {"promptgen": {"enabled": False, "dir_name": ""}},
    })
    check("reset group preserves quota", d["ok"] and d["new_quota"] == 7
          and d["download_groups"]["promptgen"]["enabled"] is False, str(d.get("new_quota")))

    settings_path = TMP / "settings.json"
    saved = json.loads(settings_path.read_text(encoding="utf-8"))
    russian_path = TMP / "plugins" / "russian" / "settings.json"
    russian_saved = json.loads(russian_path.read_text(encoding="utf-8"))
    check("split settings has both keys", russian_saved.get("new_quota") == 7
          and "download_groups" in saved)

    for path, needle in (
        ("/app.js", "RT_DL_GROUP_DEFS"),
        ("/plugins/promptgen/feature.js", "'promptgen'"),
        ("/plugins/book_reader/feature.js", "'reader_vocab'"),
        ("/plugins/book_reader/feature.js", "'reader_cleaned'"),
        ("/plugins/book_reader/feature.js", "'reader_cleaning'"),
    ):
        r = urllib.request.urlopen(BASE + path, timeout=10)
        text = r.read().decode("utf-8")
        r.close()
        check("static wiring " + path + " " + needle, needle in text)

    code, d = req("GET", "/api/health")
    check("health intact", code == 200 and d["ok"])
    code, d = req("GET", "/api/plugin/book_reader/books")
    check("books intact", d["ok"] and len(d["books"]) >= 1)

    srv.shutdown()
    print(f"\nRESULT: {ok.count(True)}/{len(ok)} PASS")
    return 0 if all(ok) else 1


if __name__ == "__main__":
    raise SystemExit(main())
