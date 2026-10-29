"""
Web 服务层冒烟测试（使用临时数据库，不触碰真实数据）。

运行：python tests/smoke_web.py
"""
import json
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

TMP = Path(tempfile.mkdtemp(prefix="rt_web_test_"))

import config  # noqa: E402
config.DATA_DIR = TMP
config.DB_PATH = TMP / "russian_tutor.db"
config.COBUILD_LOG_PATH = TMP / "docs" / "多AI共建日志.md"   # 打卡镜像写到临时目录，不碰真实日志

from ui.web.server import Handler, ThreadingHTTPServer, _bootstrap_db  # noqa: E402

PORT = 8898
BASE = f"http://127.0.0.1:{PORT}"


def req(method: str, path: str, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(
        BASE + path, data=data, method=method,
        headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=90) as resp:
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

    code, d = req("GET", "/api/health"); check("health", code == 200 and d["ok"])
    code, d = req("GET", "/api/settings")
    check("host settings", d["ok"] and "download_groups" in d)
    for old in ("/api/bootstrap", "/api/themes", "/api/items", "/api/plan",
                "/api/study/queue", "/api/review/queue", "/api/stats", "/api/tree",
                "/api/books", "/api/reader/sections/x",
                "/api/bg/tree", "/api/files/state"):
        code, _ = req("GET", old)
        check("old route 404 " + old, code == 404, str(code))
    code, d = req("GET", "/api/plugin/russian/bootstrap"); check("bootstrap", d["ok"] and "themes" in d and d["total"] >= 0)
    code, d = req("GET", "/api/plugin/russian/themes"); check("themes", d["ok"] and isinstance(d["themes"], list))

    code, d = req("POST", "/api/plugin/russian/items", {
        "russian": "Тест предложение", "chinese": "测试句子", "theme": "测试主题",
        "tag": "测试-标签", "notes": "Это пример.", "item_type": "daily"})
    check("add item", d["ok"], f"id={d.get('id')}")
    item_id = d["id"]

    md = ("| 句式 | 例句 | 翻译 | 主题 | 标签 |\n"
          "|---|---|---|---|---|\n"
          "| Привет! | 你好！ | 问候 | 问候主题 | 问候-首句 |\n"
          "| Пока! | 再见！ | 告别 | 问候主题 | 告别-尾句 |")
    code, d = req("POST", "/api/plugin/russian/import/preview", {"text": md})
    check("import preview", d["ok"] and d["count"] == 2, f"count={d.get('count')}")
    code, d = req("POST", "/api/plugin/russian/import", {"text": md})
    check("import", d["ok"] and d["added"] == 2, f"added={d.get('added')}")

    code, d = req("POST", "/api/plugin/russian/themes", {"name": "新增主题"}); check("theme add", d["ok"])
    code, d = req("POST", "/api/plugin/russian/themes/type", {"name": "新增主题", "item_type": "term"})
    check("theme type", d["ok"] and d["changed"] >= 0)
    code, d = req("POST", "/api/plugin/russian/themes/rename", {"old": "新增主题", "new": "改名主题"})
    check("theme rename", d["ok"])
    code, d = req("POST", "/api/plugin/russian/themes/delete", {"name": "改名主题"}); check("theme delete", d["ok"])

    code, d = req("GET", "/api/plugin/russian/plan?theme=" + urllib.parse.quote("问候主题"))
    check("plan", d["ok"] and "new" in d and "due" in d)
    code, d = req("GET", "/api/plugin/russian/study/queue?theme=" + urllib.parse.quote("问候主题"))
    check("study queue", d["ok"] and len(d["queue"]) >= 2, f"n={len(d.get('queue', []))}")
    code, d = req("GET", "/api/plugin/russian/review/queue"); check("review queue", d["ok"] and isinstance(d["queue"], list))

    code, d = req("POST", "/api/plugin/russian/study/rate", {"id": item_id, "result": "know"})
    check("rate know", d["ok"] and d.get("new") == "B", str(d))
    code, d = req("POST", "/api/plugin/russian/review/rate", {"id": item_id, "result": "unknown"})
    check("rate unknown", d["ok"] and d.get("new") == "C", str(d))
    code, d = req("POST", "/api/plugin/russian/study/rate", {"id": item_id, "result": "skip"})
    check("rate skip", d["ok"] and d.get("skipped"))

    code, d = req("GET", "/api/plugin/russian/items?type=daily")
    check("items filter", d["ok"] and any(i["id"] == item_id for i in d["items"]))
    code, d = req("PUT", "/api/plugin/russian/items/%d" % item_id, {
        "russian": "Тест предложение 2", "chinese": "测试句子2", "theme": "问候主题",
        "tag": "测试-标签2", "notes": "", "item_type": "daily"})
    check("item update", d["ok"])
    code, d = req("GET", "/api/plugin/russian/items"); check("items all", d["ok"] and len(d["items"]) >= 3)
    ids = [i["id"] for i in d["items"]]
    code, d = req("POST", "/api/plugin/russian/items/move", {"ids": ids[:1], "theme": "移动目标", "item_type": "term"})
    check("items move", d["ok"] and d["moved"] == 1, str(d))
    code, d = req("POST", "/api/plugin/russian/items/delete", {"ids": ids[1:]})
    check("items delete", d["ok"] and d["deleted"] == len(ids[1:]))

    code, d = req("GET", "/api/plugin/russian/tree"); check("tree", d["ok"] and isinstance(d["tree"], list))

    code, d = req("GET", "/api/plugin/russian/stats"); check("stats", d["ok"] and "activity" in d)
    code, d = req("GET", "/api/plugin/russian/stats/months"); check("stats months", d["ok"] and d["months"])
    code, d = req("GET", "/api/plugin/russian/stats/month?month=" + d["months"][-1])
    check("stats month", d["ok"] and isinstance(d["days"], list))

    code, d = req("GET", "/api/plugin/russian/settings"); check("settings get", d["ok"])
    code, d = req("POST", "/api/plugin/russian/settings", {"new_quota": 9, "review_quota": 12})
    check("settings save", d["ok"] and d["new_quota"] == 9 and d["review_quota"] == 12)
    code, d = req("GET", "/api/plugin/russian/plan?theme=" + urllib.parse.quote("问候主题"))
    check("plan new quota", d["ok"] and d["new_quota"] == 9)

    # ---- 多 AI 共建：声明 + 打卡留痕 ----
    code, d = req("GET", "/api/plugin/cobuild/data")
    check("cobuild data", d["ok"] and len(d["rules"]) >= 5 and isinstance(d["checkins"], list))
    code, d = req("POST", "/api/plugin/cobuild/checkin", {
        "agent": "冒烟测试", "action": "验证打卡接口", "files": "tests/smoke_web.py", "kind": "other"})
    check("cobuild checkin", d["ok"] and d["count"] == 1, str(d.get("count")))
    entry_id = d["checkins"][0]["id"]
    check("cobuild log file", (TMP / "docs" / "多AI共建日志.md").is_file())
    code, d = req("POST", "/api/plugin/cobuild/checkin", {"agent": "", "action": "缺协作者"})
    check("cobuild checkin rejects empty agent", d["ok"] is False)
    code, d = req("POST", "/api/plugin/cobuild/void", {"id": entry_id, "reason": "冒烟测试用完"})
    check("cobuild void", d["ok"] and d["checkins"][0]["void"] is True)
    code, d = req("GET", "/api/plugin/cobuild/data")
    check("cobuild keeps voided record", d["ok"] and d["count"] == 1)

    # ---- 俄汉双语阅读屏：纯追加导入（不查重 / 不覆盖 / 非法整批拒绝） ----
    code, d = req("POST", "/api/plugin/book_reader/books", {"name": "阅读屏测试"})
    check("reader screen book", d["ok"] and d["book"]["name"] == "阅读屏测试")
    root = d["book"]["root_section_id"]
    code, d = req("POST", f"/api/plugin/book_reader/reader/sections/{root}/append", {"records": [
        {"sentence_ru": "Я читаю книгу.", "translation_zh": "我在读书。",
         "key_words": ["книгу"], "key_phrases": ["читаю книгу"]},
        {"sentence_ru": "Она пьёт чай.", "translation_zh": "她在喝茶。"}]})
    check("reader screen append", d["ok"] and d["imported"] == 2, str(d.get("imported")))
    code, d = req("POST", f"/api/plugin/book_reader/reader/sections/{root}/append", {"records": [{"sentence_ru": "x"}]})
    check("reader screen append rejects invalid", d["ok"] is False)
    code, d = req("GET", f"/api/plugin/book_reader/reader/sections/{root}")
    check("reader screen append persisted", d["ok"] and len(d["sentences"]) == 2)
    check("reader screen append marks", len(d["sentences"][0]["marks"]) == 2,
          str(len(d["sentences"][0]["marks"])))

    # ---- 项目优化与当前综述（功能背景信息库） ----
    bg_pkg = {"schema_version": "1.0", "mode": "new", "nodes": [
        {"id": "b1", "parent_id": None, "node_type": "project", "name": "冒烟项目",
         "status": "active", "summary": "项目简述",
         "relations": [{"target_id": "b2", "target_path": "1.1", "relation_type": "call"}]},
        {"id": "b2", "parent_id": "b1", "node_type": "module", "name": "冒烟模块",
         "status": "active", "summary": "模块简述", "tags": ["测试"]}]}
    code, d = req("POST", "/api/plugin/bg_library/bg/import/preview", {"package": bg_pkg})
    check("bg preview new", d.get("valid") is True, str(d.get("error", "")))
    code, d = req("POST", "/api/plugin/bg_library/bg/import/commit", {"package": bg_pkg})
    check("bg import new", d.get("imported") == 2, str(d.get("imported")))
    code, d = req("GET", "/api/plugin/bg_library/bg/tree")
    check("bg tree", d["ok"] and len(d["nodes"]) == 2 and len(d["incoming"]) == 1, str(len(d.get("nodes", []))))
    paths = {n["id"]: n["path"] for n in d["nodes"]}
    check("bg path 生成", paths == {"b1": "1", "b2": "1.1"}, str(paths))

    code, d = req("POST", "/api/plugin/bg_library/bg/export", {"selected_ids": ["b1", "b2"]})
    check("bg export", d["ok"] and d["package"]["mode"] == "export" and len(d["package"]["nodes"]) == 2)
    base_nodes = d["package"]["nodes"]
    code, d = req("POST", "/api/plugin/bg_library/bg/export", {"selected_ids": ["b1"]})
    check("bg referenced_nodes", any(x["id"] == "b2" for x in d["package"]["referenced_nodes"]),
          str([x["id"] for x in d["package"]["referenced_nodes"]]))

    current = [dict(n) for n in base_nodes if n["id"] == "b2"]
    current[0]["summary"] = "模块简述（优化后）"
    upd_pkg = {"schema_version": "1.0", "mode": "update",
               "base": {"scope": "subtree", "nodes": base_nodes},
               "current": {"scope": "subtree", "nodes": current},
               "changed_paths": [{"id": "b2", "path": "1.1"}]}
    code, d = req("POST", "/api/plugin/bg_library/bg/import/preview", {"package": upd_pkg})
    check("bg update preview", d.get("valid") is True and d["preview"]["counts"]["update"] == 1,
          str(d.get("preview", {}).get("counts")))
    code, d = req("POST", "/api/plugin/bg_library/bg/import/commit", {"package": upd_pkg, "decisions": {}})
    check("bg update commit", d.get("applied", {}).get("updated") == 1, str(d.get("applied")))
    code, d = req("GET", "/api/plugin/bg_library/bg/nodes/b2")
    check("bg update persisted", "优化后" in d["node"]["summary"], d["node"]["summary"])

    code, d = req("POST", "/api/plugin/bg_library/bg/nodes/b2/manual", {"reason": "", "fields": {"summary": "x"}})
    check("bg manual needs reason", d["ok"] is False)
    code, d = req("POST", "/api/plugin/bg_library/bg/nodes/b2/manual", {"reason": "补充说明", "fields": {"summary": "手动说明"}})
    check("bg manual save", d.get("ok") and d["node"]["summary"] == "手动说明" and len(d["diffs"]) == 1)
    code, d = req("GET", "/api/plugin/bg_library/bg/history")
    check("bg history", d["ok"] and d["total"] >= 3, str(d.get("total")))
    code, d = req("POST", "/api/plugin/bg_library/bg/history/clear", {})
    check("bg clear history", d["ok"] and req("GET", "/api/plugin/bg_library/bg/history")[1]["total"] == 0)

    # 采集包常见写法：target_id 留空、只用 target_path 定位关系目标
    path_pkg = {"schema_version": "1.0", "mode": "new", "nodes": [
        {"id": "p1", "parent_id": "", "path": "路径关系项目", "node_type": "project",
         "name": "路径关系项目", "status": "active", "summary": "只用 path 定位关系目标",
         "relations": [{"target_id": "", "target_path": "路径关系项目/路径关系模块",
                        "relation_type": "call"}]},
        {"id": "p2", "parent_id": "p1", "path": "路径关系项目/路径关系模块",
         "node_type": "module", "name": "路径关系模块", "status": "active",
         "summary": "被调用方"}]}
    code, d = req("POST", "/api/plugin/bg_library/bg/import/preview", {"package": path_pkg})
    check("bg path-only relation preview", d.get("valid") is True, str(d.get("error", "")))
    code, d = req("POST", "/api/plugin/bg_library/bg/import/commit", {"package": path_pkg})
    check("bg path-only relation import", d.get("imported") == 2, str(d.get("imported")))
    code, d = req("GET", "/api/plugin/bg_library/bg/nodes/p1")
    rel_target = ((d.get("node") or {}).get("relations") or [{}])[0].get("target_id")
    check("bg path-only relation resolved", rel_target == "p2", str(rel_target))

    for p in ("/", "/index.html", "/app.css", "/app.js"):
        r = urllib.request.urlopen(BASE + p, timeout=10)
        body = r.read()
        check("static " + p, r.status == 200 and len(body) > 100, f"{len(body)}B")
        r.close()

    with urllib.request.urlopen(BASE + "/", timeout=10) as r:
        index_html = r.read().decode("utf-8")
    check("首页标题已更名", "<title>旅行之木</title>" in index_html
          and "俄语学习小屋" not in index_html)

    code, d = req("POST", "/api/plugin/tts/clear-cache", {"x": 1})
    check("voice cache clear", d["ok"] and d["count"] == 0, str(d))

    try:
        with urllib.request.urlopen(
                BASE + "/api/plugin/tts/speak?text=" + urllib.parse.quote("Привет, как дела?"),
                timeout=120) as r:
            audio = r.read()
            check("tts audio", r.status == 200 and r.headers.get("Content-Type") == "audio/mpeg"
                  and len(audio) > 500, f"{len(audio)}B")
    except urllib.error.HTTPError as exc:
        check("tts audio", False, f"HTTP {exc.code}（环境网络/edge-tts，不阻断后续断言）")
    except Exception as exc:  # noqa: BLE001
        check("tts audio", False, f"{exc}（环境异常，不阻断后续断言）")

    srv.shutdown()
    print(f"\nRESULT: {ok.count(True)}/{len(ok)} PASS")
    return 0 if all(ok) else 1


if __name__ == "__main__":
    raise SystemExit(main())
