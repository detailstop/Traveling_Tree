"""
启动迁移只执行一次 · 冒烟测试（临时数据库，不触碰真实数据）。

覆盖：
  - init_db() 执行一次 核心 schema + manifest 插件 schema + 兼容补丁 + 模块迁移 + seed 回调；
  - DDL 单一源静态断言（db/schema 核心 + plugins/*/schema.sql，connection.py 不建表）；
  - get_conn() 只连接，不再触发 DDL/迁移；
  - Web 服务连续多个 /api/* 请求不再触发 DDL/迁移；
  - 迁移异常时 serve() 抛 SystemExit 且不监听端口；
  - 全新临时库上宿主 init_db + 插件 seed/repository 读取路径可用；
  - modules.enabled.model_usage=false 时不建表且插件 API 返回 503，恢复后自动建表。

运行：python tests/smoke_startup_once.py
"""
import json
import socket
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

TMP = Path(tempfile.mkdtemp(prefix="rt_startup_once_"))

import config  # noqa: E402
config.DATA_DIR = TMP
config.DB_PATH = TMP / "russian_tutor.db"
config.COBUILD_LOG_PATH = TMP / "docs" / "多AI共建日志.md"

import db.connection as dbconn  # noqa: E402
from plugins.russian import repo as ru_repo  # noqa: E402
from plugins.project_manager import pm_service  # noqa: E402
import ui.web.server as srv  # noqa: E402

PORT = 8896
FAIL_PORT = 8895
BASE = f"http://127.0.0.1:{PORT}"


def req(path):
    with urllib.request.urlopen(BASE + path, timeout=15) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))


def port_open(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex(("127.0.0.1", port)) == 0


def main() -> int:
    ok: list[bool] = []

    def check(name, cond, extra=""):
        ok.append(bool(cond))
        print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""))

    # 0) DDL 单一源静态断言（核心 schema + 插件 schema）
    root = Path(__file__).resolve().parent.parent
    schema_dir = root / "db" / "schema"
    schema_files = sorted(schema_dir.glob("*.sql"))
    plugin_schema_files = sorted((root / "plugins").glob("*/schema.sql"))
    schema_text = "\n".join(
        [p.read_text(encoding="utf-8") for p in schema_files]
        + [p.read_text(encoding="utf-8") for p in plugin_schema_files])
    connection_text = (root / "db" / "connection.py").read_text(encoding="utf-8")
    schema_tables = ("pm_stage_templates", "pm_projects", "pm_stages",
                     "pm_prompt_drafts", "pm_results", "model_usage_logs",
                     "finance_settings", "finance_accounts", "finance_inv_vals",
                     "finance_snapshots", "finance_snapshot_account_subs",
                     "pixel_artworks", "items", "item_stats", "review_logs",
                     "daily_logs", "themes", "bg_nodes", "bg_versions",
                     "file_notes", "db_rules", "reader_books", "reader_sentences",
                     "visual_settings", "pg_assets", "pg_flows", "schedule_assets",
                     "schedule_tasks", "urlarch_assets", "urlarch_links",
                     "screeps_assets", "screeps_units", "ai_sessions", "ai_tx_logs",
                     "aidebug_history", "reader_bookmarks", "finance_quant_assets",
                     "finance_fund_cache", "market_installed")
    check("schema 单一源（核心 + 插件）",
          len(schema_files) == 0 and len(plugin_schema_files) == 14
          and all(f"CREATE TABLE IF NOT EXISTS {table}" in schema_text
                  for table in schema_tables),
          f"core={len(schema_files)} plugin={len(plugin_schema_files)}")
    check("model_usage schema 已迁入插件目录",
          (root / "plugins" / "model_usage" / "schema.sql").is_file()
          and not (schema_dir / "model_usage.sql").exists())
    check("pixel/finance schema 已迁入插件目录",
          (root / "plugins" / "pixel_art" / "schema.sql").is_file()
          and (root / "plugins" / "finance" / "schema.sql").is_file()
          and not (schema_dir / "pixel.sql").exists()
          and not (schema_dir / "finance.sql").exists())
    check("russian 学习五表已迁入插件 schema",
          (root / "plugins" / "russian" / "schema.sql").is_file()
          and all(f"CREATE TABLE IF NOT EXISTS {table}" in
                  (root / "plugins" / "russian" / "schema.sql").read_text(encoding="utf-8")
                  for table in ("items", "item_stats", "review_logs", "daily_logs", "themes"))
          and not list(schema_dir.glob("*.sql")))
    check("russian seed 由 manifest 声明",
          "seed" in (root / "plugins" / "russian" / "manifest.json").read_text(encoding="utf-8")
          and (root / "plugins" / "russian" / "seed.py").is_file())
    check("connection.py 无重复建表", "CREATE TABLE IF NOT EXISTS" not in connection_text)
    check("connection.py 不硬编码插件表名",
          not any(name in connection_text for name in
                  ("model_usage_logs", "pixel_artworks", "finance_accounts",
                   "item_stats", "review_logs", "daily_logs",
                   "pm_projects", "reader_books", "bg_nodes", "file_notes")))
    check("db 不反向依赖 modules",
          "from modules" not in connection_text and "import modules" not in connection_text)
    check("register_module_ddl 骨架",
          callable(getattr(dbconn, "register_module_ddl", None))
          and isinstance(getattr(dbconn, "_MODULE_DDL", None), dict)
          and "finance" in getattr(dbconn, "_MODULE_DDL", {}))

    counts = {"schema": 0, "migrate": 0}
    orig_schema = dbconn._init_schema
    orig_migrate = dbconn._migrate

    def counted_schema(conn):
        counts["schema"] += 1
        return orig_schema(conn)

    def counted_migrate(conn):
        counts["migrate"] += 1
        orig_migrate(conn)

    dbconn._init_schema = counted_schema
    dbconn._migrate = counted_migrate

    # 1) 启动初始化一次
    srv._bootstrap_db()
    check("init once schema", counts["schema"] == 1, str(counts))
    check("init once migrate", counts["migrate"] == 1, str(counts))
    check("tables created", len(ru_repo.list_items()) >= 0)
    check("动态表→模块映射",
          dbconn._module_for_table("items") == "russian"
          and dbconn._module_for_table("model_usage_logs") == "model_usage"
          and dbconn._module_for_table("pixel_artworks") == "pixel_art"
          and dbconn._module_for_table("finance_accounts") == "finance")
    seed_count = dbconn.get_conn().execute(
        "SELECT COUNT(*) AS n FROM pm_stage_templates").fetchone()["n"]
    check("seed callback registered", seed_count == 6, f"templates={seed_count}")

    # 2) 线程本地 get_conn 不再初始化
    err = []
    def in_thread():
        try:
            c = dbconn.get_conn()
            c.execute("SELECT COUNT(*) FROM items").fetchone()
        except Exception as exc:  # noqa: BLE001
            err.append(str(exc))
    t = threading.Thread(target=in_thread)
    t.start(); t.join()
    check("get_conn no init", not err and counts["schema"] == 1 and counts["migrate"] == 1,
          f"{counts} err={err}")

    # 3) Web 多个请求不再触发 DDL/迁移
    server = srv.ThreadingHTTPServer(("127.0.0.1", PORT), srv.Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    time.sleep(0.35)
    codes = []
    for path in ("/api/health", "/api/plugin/russian/bootstrap",
                 "/api/plugin/russian/themes", "/api/plugin/russian/items"):
        status, data = req(path)
        codes.append((path, status, bool(data.get("ok"))))
    check("api requests ok", all(c[1] == 200 and c[2] for c in codes), str(codes))
    check("api no repeated init", counts["schema"] == 1 and counts["migrate"] == 1, str(counts))
    server.shutdown()

    # 4) 迁移失败：不监听端口，SystemExit
    dbconn._initialized = False
    def boom(_conn):
        raise RuntimeError("测试注入迁移错误")
    dbconn._init_schema = boom
    srv.PORT = FAIL_PORT
    failed = False
    try:
        srv.serve(open_browser=False)
    except SystemExit as exc:
        failed = int(exc.code or 0) != 0
    check("migration failure exits nonzero", failed)
    check("migration failure does not listen", not port_open(FAIL_PORT))
    dbconn._init_schema = counted_schema
    dbconn._initialized = False

    # 5) 全新库：init_db 后插件 repository 可读，且 manifest seed 已执行
    module_calls = []
    dbconn.register_module_ddl("smoke_module", None,
                               lambda conn: module_calls.append(1))
    config.DB_PATH = TMP / "cli_fresh.db"
    dbconn._initialized = False
    dbconn.init_db()
    check("module migrate_fn 执行", module_calls == [1], str(module_calls))
    fresh_counts = []
    def read_fresh():
        fresh_counts.append(ru_repo.stats_summary()["total"])
    t2 = threading.Thread(target=read_fresh)
    t2.start(); t2.join()
    check("fresh init for host", config.DB_PATH.exists() and fresh_counts and fresh_counts[0] > 0,
          str(fresh_counts))

    # 6) modules.enabled=false：跳过建表，接口返回结构化 503；恢复 true 后自动建表
    def close_thread_conn():
        try:
            dbconn.get_conn().close()
        except Exception:
            pass
        dbconn._local.conn = None

    module_db = TMP / "module_off.db"
    (TMP / "settings.json").write_text(json.dumps(
        {"modules": {"enabled": {"pm": False, "model_usage": False, "finance": False}}}), encoding="utf-8")
    close_thread_conn()
    config.DB_PATH = module_db
    dbconn._initialized = False
    dbconn.init_db(force=True)
    conn = dbconn.get_conn()
    names = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    check("关闭 pm 不建 pm_*", "pm_projects" not in names and "pm_stages" not in names)
    check("market 安装记录表已建", "market_installed" in names)
    check("关闭 model_usage 不建表", "model_usage_logs" not in names)
    check("关闭 finance 不建表", "finance_accounts" not in names)
    check("其他模块仍建表", "items" in names and "reader_books" in names)
    disabled = False
    try:
        pm_service.list_projects()
    except dbconn.ModuleDisabledError:
        disabled = True
    check("repository 缺表结构化异常", disabled)

    module_server = srv.ThreadingHTTPServer(("127.0.0.1", 8894), srv.Handler)
    threading.Thread(target=module_server.serve_forever, daemon=True).start()
    time.sleep(0.25)
    try:
        with urllib.request.urlopen("http://127.0.0.1:8894/api/plugin/project_manager/projects", timeout=10) as resp:
            status, payload = resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        status, payload = exc.code, json.loads(exc.read().decode("utf-8"))
    check("关闭 pm 的 API 503", status == 503 and payload.get("error") == "module_disabled",
          f"{status} {payload.get('error')}")
    try:
        with urllib.request.urlopen("http://127.0.0.1:8894/api/plugin/finance/state", timeout=10) as resp:
            status, payload = resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        status, payload = exc.code, json.loads(exc.read().decode("utf-8"))
    check("关闭 finance 的插件 API 503",
          status == 503 and payload.get("error") == "module_disabled",
          f"{status} {payload.get('error')}")
    try:
        with urllib.request.urlopen("http://127.0.0.1:8894/api/plugin/model_usage/records",
                                    timeout=10) as resp:
            status, payload = resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        status, payload = exc.code, json.loads(exc.read().decode("utf-8"))
    check("关闭 model_usage 的插件 API 503",
          status == 503 and payload.get("error") == "module_disabled",
          f"{status} {payload.get('error')}")
    with urllib.request.urlopen("http://127.0.0.1:8894/api/plugins/list", timeout=10) as resp:
        plugins_payload = json.loads(resp.read().decode("utf-8"))
    check("modules.enabled 不隐藏插件卡",
          any(p.get("id") == "finance" for p in plugins_payload.get("plugins", [])))
    module_server.shutdown()

    close_thread_conn()
    (TMP / "settings.json").write_text(json.dumps({"modules": {"enabled": {}}}), encoding="utf-8")
    dbconn._initialized = False
    dbconn.init_db(force=True)
    conn = dbconn.get_conn()
    names = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    check("恢复 pm 后自动建表", "pm_projects" in names and "pm_stages" in names)
    check("恢复 finance 后自动建表", "finance_accounts" in names)
    check("恢复 model_usage 后自动建表", "model_usage_logs" in names)

    print(f"\nRESULT: {ok.count(True)}/{len(ok)} PASS")
    return 0 if all(ok) else 1


if __name__ == "__main__":
    raise SystemExit(main())
