"""
文件预览与说明卡片 · 后端冒烟测试（临时数据库）。

覆盖：扫描排除、数据库文件识别、说明读写/覆盖、数据库规则增改删、
接口 GET/POST、路径越界拒绝。运行：python tests/smoke_file_preview.py
"""
import json
import sqlite3
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
TMP = Path(tempfile.mkdtemp(prefix="rt_file_preview_"))
import config  # noqa: E402
config.DATA_DIR = TMP
config.DB_PATH = TMP / "russian_tutor.db"
config.COBUILD_LOG_PATH = TMP / "x.md"
from db.connection import init_db  # noqa: E402
init_db()
from plugins.bg_library import file_preview  # noqa: E402


def main() -> int:
    ok = []

    def check(name, cond, extra=""):
        ok.append(bool(cond))
        print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""))

    s = file_preview.api("GET", "/api/files/state", {}, {})
    check("state ok", s.get("ok") is True)
    check("tree has files", s["counts"]["files"] > 0, str(s["counts"]))
    paths = [x["path"] for x in file_preview._flatten_files(s["tree"]["children"])]
    check("db file identified", "data/russian_tutor.db" in paths and "data/russian_tutor.db" in s["db_files"])
    check("db node is_db", any(x.get("is_db") for x in file_preview._flatten_files(s["tree"]["children"])))
    check("exclude git", not any(p.startswith(".git/") for p in paths))
    check("exclude pycache", not any("__pycache__" in p for p in paths))
    check("exclude backup", not any(p.startswith("data/backup/") for p in paths))
    check("exclude webchat", not any(p.startswith("webchat_profile/") for p in paths))
    check("exclude glob cache", not any(p.endswith("fund_list_cache.json") for p in paths))

    r = file_preview.api("POST", "/api/files/note", {},
                         {"path": "config.py", "feature": "入口配置", "details": "测试细节", "rules": "测试规则"})
    check("note save manual", r["note"]["source"] == "manual" and r["note"]["feature"] == "入口配置")
    s2 = file_preview.api("GET", "/api/files/state", {}, {})
    check("note persisted", s2["notes"].get("config.py", {}).get("details") == "测试细节")

    r = file_preview.api("POST", "/api/files/rule", {}, {
        "db_path": "data/russian_tutor.db", "table_name": "file_notes",
        "key_fields": "path 主键", "writers": "repo.upsert_file_note",
        "readers": "file_preview.state", "migration_rule": "db/schema/*.sql",
        "version": "v1",
    })
    rid = r["rule"]["id"]
    check("rule insert", r["rule"]["table_name"] == "file_notes" and r["rule"]["version"] == "v1")
    r2 = file_preview.api("POST", "/api/files/rule", {}, {
        "id": rid, "db_path": "data/russian_tutor.db", "table_name": "file_notes",
        "key_fields": "path 主键", "writers": "repo", "readers": "file_preview",
        "migration_rule": "db/schema/*.sql", "version": "v2",
    })
    check("rule update", r2["rule"]["version"] == "v2")
    rules = file_preview.api("GET", "/api/files/rules", {}, {})["rules"]
    check("rule list", any(x["id"] == rid and x["version"] == "v2" for x in rules))
    file_preview.api("POST", "/api/files/rule/delete", {}, {"id": rid})
    check("rule delete", not any(x["id"] == rid for x in file_preview.api("GET", "/api/files/rules", {}, {})["rules"]))

    try:
        file_preview.api("POST", "/api/files/note", {}, {"path": "../outside.txt", "feature": "x"})
        traversal = False
    except ValueError:
        traversal = True
    check("path traversal rejected", traversal)

    con = sqlite3.connect(config.DB_PATH)
    tables = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    con.close()
    check("new tables created", {"file_notes", "db_rules"} <= tables)

    print(f"\nRESULT: {ok.count(True)}/{len(ok)} PASS")
    return 0 if all(ok) else 1


if __name__ == "__main__":
    raise SystemExit(main())
