"""
模型用量与消费 · 第二版接口冒烟测试（临时数据库，不触碰真实数据）。

覆盖：
  - 四 token 字段必填、总 token 自动求和；
  - deepseek-flash 内置价目、峰谷（北京时间）、节假日配置；
  - 计算花销只读/实际花销默认与可改，两者都保存；
  - 模型别名映射、未配置模型阻断、无价目阻断；
  - 价目新增/修改/删除与 settings.json 持久化；
  - 编辑、删除、删除不存在记录；
  - 既有 health/bootstrap/items 不受影响。

运行：python tests/smoke_model_usage.py
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

TMP = Path(tempfile.mkdtemp(prefix="rt_model_usage_test_"))

import config  # noqa: E402
config.DATA_DIR = TMP
config.DB_PATH = TMP / "russian_tutor.db"
config.COBUILD_LOG_PATH = TMP / "docs" / "多AI共建日志.md"

from ui.web.server import Handler, ThreadingHTTPServer, _bootstrap_db  # noqa: E402

PORT = 8899
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

    def add(body):
        return req("POST", "/api/plugin/model_usage/add", body)

    base = {
        "called_at": "2026-10-26 10:00:00",   # 莫斯科 10:00 → 北京 15:00 周一高峰
        "conversation_label": "峰谷测试",
        "turn_index": 1,
        "feature_label": "代码修改",
        "model_name": "deepseek-flash",
        "uncached_input_tokens": 1000000,
        "cache_read_tokens": 1000000,
        "cache_write_tokens": 500000,
        "output_tokens": 1000000,
        "currency": "CNY",
        "interval_text": "01:02:03",
    }

    code, d = req("GET", "/api/plugin/model_usage/records")
    check("list empty", code == 200 and d["ok"] and d["records"] == [])
    models = (d.get("pricing") or {}).get("models") or {}
    check("default pricing has flash and v4-pro",
          "deepseek-flash" in models and "deepseek-v4-pro" in models, str(list(models)))
    check("default holidays empty", d["pricing"].get("holidays") == [])

    # 加入一个节假日，验证设置持久化与峰谷
    pricing = d["pricing"]
    code, d = req("POST", "/api/plugin/model_usage/pricing",
                  {"models": pricing["models"], "holidays": ["2026-10-27"]})
    check("save pricing + holiday", d["ok"] and d["pricing"]["holidays"] == ["2026-10-27"], str(d.get("error")))
    settings_path = TMP / "plugins" / "model_usage" / "settings.json"
    check("settings.json persisted", settings_path.is_file()
          and "model_pricing" in json.loads(settings_path.read_text(encoding="utf-8")))

    code, d = add(base)
    check("add peak record", d["ok"], str(d.get("error", "")))
    peak_id = d["record"]["id"]
    rec = d["record"]
    check("four tokens stored", rec["uncached_input_tokens"] == 1000000
          and rec["cache_read_tokens"] == 1000000 and rec["cache_write_tokens"] == 500000
          and rec["output_tokens"] == 1000000)
    check("total token derived", rec["total_tokens"] == 3500000, str(rec["total_tokens"]))
    check("peak tier", rec["price_tier"] == "peak", rec["price_tier"])
    check("calculated cost 10.04", abs(rec["calculated_cost"] - 10.04) < 1e-9, str(rec["calculated_cost"]))
    check("actual defaults calculated", abs(rec["actual_cost"] - 10.04) < 1e-9, str(rec["actual_cost"]))
    check("interval parsed", rec["interval_seconds"] == 3723 and rec["interval_text"] == "01:02:03")

    off = dict(base)
    off.update({"called_at": "2026-10-26 03:00:00", "conversation_label": "空闲测试",
                "interval_text": ""})
    code, d = add(off)
    check("offpeak tier", d["ok"] and d["record"]["price_tier"] == "offpeak", str(d.get("record", {}).get("price_tier")))
    check("offpeak calculated 5.02", abs(d["record"]["calculated_cost"] - 5.02) < 1e-9,
          str(d.get("record", {}).get("calculated_cost")))

    holiday = dict(base)
    holiday.update({"called_at": "2026-10-27 10:00:00", "conversation_label": "节假日测试"})
    code, d = add(holiday)
    check("configured holiday is offpeak", d["ok"] and d["record"]["price_tier"] == "offpeak",
          str(d.get("record", {}).get("price_tier")))

    alias = dict(base)
    alias.update({"called_at": "2026-10-26 15:00:00", "conversation_label": "别名测试",
                  "model_name": "DeepSeek-V4.1-Flash-1017"})
    code, d = add(alias)
    check("model alias mapped", d["ok"] and d["record"]["model_name"] == "deepseek-flash",
          str(d.get("record", {}).get("model_name")))

    actual = dict(base)
    actual.update({"called_at": "2026-10-26 11:00:00", "conversation_label": "实际花销测试",
                   "actual_cost": 9.99})
    code, d = add(actual)
    check("actual cost editable", d["ok"] and abs(d["record"]["actual_cost"] - 9.99) < 1e-9
          and abs(d["record"]["calculated_cost"] - 10.04) < 1e-9,
          f"calc={d.get('record', {}).get('calculated_cost')} actual={d.get('record', {}).get('actual_cost')}")

    bad_bodies = [
        ("missing uncached", {k: v for k, v in base.items() if k != "uncached_input_tokens"}),
        ("missing cache read", {k: v for k, v in base.items() if k != "cache_read_tokens"}),
        ("missing cache write", {k: v for k, v in base.items() if k != "cache_write_tokens"}),
        ("missing output", {k: v for k, v in base.items() if k != "output_tokens"}),
        ("negative output", {**base, "output_tokens": -1}),
        ("unknown model", {**base, "model_name": "deepseek-chat"}),
        ("turn zero", {**base, "turn_index": 0}),
        ("actual negative", {**base, "actual_cost": -1}),
        ("currency empty", {**base, "currency": "  "}),
        ("bad interval", {**base, "interval_text": "1:2:3:4"}),
    ]
    for name, body in bad_bodies:
        code, d = add(body)
        check(f"reject {name}", code == 400 and d["ok"] is False, str(d.get("error")))

    # 修改：只改 uncached，不传 actual → 实际花销重新默认计算
    update = dict(base)
    update.update({"id": peak_id, "uncached_input_tokens": 2000000})
    update.pop("actual_cost", None)
    code, d = req("POST", "/api/plugin/model_usage/update", update)
    check("update recalculates", d["ok"] and abs(d["record"]["calculated_cost"] - 12.04) < 1e-9
          and abs(d["record"]["actual_cost"] - 12.04) < 1e-9,
          f"calc={d.get('record', {}).get('calculated_cost')} actual={d.get('record', {}).get('actual_cost')}")
    update2 = dict(update)
    update2["actual_cost"] = 11.5
    code, d = req("POST", "/api/plugin/model_usage/update", update2)
    check("update preserves actual", d["ok"] and abs(d["record"]["actual_cost"] - 11.5) < 1e-9,
          str(d.get("record", {}).get("actual_cost")))

    # 自定义模型价目
    custom_models = dict(pricing["models"])
    custom_models["custom-model"] = {
        "label": "自定义模型",
        "cache_read": {"offpeak": 0.01, "peak": 0.02},
        "uncached_input": {"offpeak": 0.5, "peak": 1.0},
        "output": {"offpeak": 2.0, "peak": 4.0},
    }
    code, d = req("POST", "/api/plugin/model_usage/pricing",
                  {"models": custom_models, "holidays": []})
    check("add custom pricing", d["ok"] and "custom-model" in d["pricing"]["models"], str(d.get("error")))
    custom_body = dict(base)
    custom_body.update({"called_at": "2026-10-26 03:00:00", "conversation_label": "自定义模型",
                        "model_name": "custom-model", "actual_cost": ""})
    code, d = add(custom_body)
    check("custom model record", d["ok"] and d["record"]["model_name"] == "custom-model"
          and d["record"]["price_tier"] == "offpeak", str(d.get("error")))
    check("custom calc 2.51", abs(d["record"]["calculated_cost"] - 2.51) < 1e-9,
          str(d.get("record", {}).get("calculated_cost")))

    code, d = req("POST", "/api/plugin/model_usage/pricing", {"models": {}, "holidays": []})
    check("empty models rejected", code == 400 and d["ok"] is False, str(d.get("error")))
    bad_models = dict(custom_models)
    bad_models["custom-model"] = {**bad_models["custom-model"], "output": {"offpeak": -1, "peak": 4}}
    code, d = req("POST", "/api/plugin/model_usage/pricing", {"models": bad_models, "holidays": []})
    check("negative price rejected", code == 400 and d["ok"] is False, str(d.get("error")))

    # 删除
    code, d = req("POST", "/api/plugin/model_usage/delete", {"id": peak_id})
    check("delete", d["ok"] and d["deleted"])
    code, d = req("POST", "/api/plugin/model_usage/delete", {"id": peak_id})
    check("delete again -> 404", code == 404 and d["ok"] is False)
    code, d = req("POST", "/api/plugin/model_usage/update", {**update, "id": 999999})
    check("update missing -> 404", code == 404 and d["ok"] is False)

    import sqlite3
    con = sqlite3.connect(config.DB_PATH)
    cols = {r[1] for r in con.execute("PRAGMA table_info(model_usage_logs)")}
    check("new table columns", {"uncached_input_tokens", "cache_read_tokens", "cache_write_tokens",
                               "output_tokens", "calculated_cost", "actual_cost", "price_tier"} <= cols)
    check("old handfill columns removed", not ({"input_tokens", "total_tokens", "cost_amount"} & cols),
          str({"input_tokens", "total_tokens", "cost_amount"} & cols))
    con.close()

    for path in ("/plugins/model_usage/feature.js", "/app.js", "/app.css"):
        r = urllib.request.urlopen(BASE + path, timeout=10)
        body = r.read()
        check("static " + path, r.status == 200 and len(body) > 1000, f"{len(body)}B")
        r.close()
    r = urllib.request.urlopen(BASE + "/plugins/model_usage/feature.js", timeout=10)
    js = r.read().decode("utf-8")
    r.close()
    check("pricing renderer registered", "__toolRenderers['model-usage']" in js and "价目与节假日" in js)

    code, d = req("GET", "/api/health")
    check("health intact", code == 200 and d["ok"])
    code, d = req("GET", "/api/plugin/russian/bootstrap")
    check("bootstrap intact", d["ok"] and "themes" in d)
    code, d = req("GET", "/api/plugin/russian/items")
    check("items intact", d["ok"] and isinstance(d["items"], list))
    code, _ = req("GET", "/api/model-usage")
    check("legacy model-usage route removed", code == 404, f"HTTP {code}")
    code, _ = req("GET", "/api/model-usage/pricing")
    check("legacy model-usage pricing route removed", code == 404, f"HTTP {code}")
    code, _ = req("POST", "/api/model-usage/add", base)
    check("legacy model-usage add route removed", code == 404, f"HTTP {code}")

    srv.shutdown()
    print(f"\nRESULT: {ok.count(True)}/{len(ok)} PASS")
    return 0 if all(ok) else 1


if __name__ == "__main__":
    raise SystemExit(main())

