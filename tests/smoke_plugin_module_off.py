"""
插件模块关闭 · 重启验证（真实子进程服务 + 临时数据库）。

流程：
  1. 写入 data/settings.json：modules.enabled.model_usage=false；
  2. 启动真实服务，断言 model_usage_logs 未创建、插件 API 返回 503、
     插件卡片仍在（modules.enabled 不隐藏卡片）；
  3. 恢复 modules.enabled，重启服务，断言表自动创建、API 200。

运行：python tests/smoke_plugin_module_off.py
"""
from __future__ import annotations

import json
import os
import re
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TMP = Path(tempfile.mkdtemp(prefix="rt_module_off_"))
DB_PATH = TMP / "russian_tutor.db"
SETTINGS = TMP / "settings.json"

SERVER_CODE = r"""
import sys
from pathlib import Path
sys.path.insert(0, r"{root}")
import config
config.DATA_DIR = Path(r"{tmp}")
config.DB_PATH = config.DATA_DIR / "russian_tutor.db"
config.COBUILD_LOG_PATH = config.DATA_DIR / "docs" / "cobuild.md"
from ui.web import server
server.PORT = {port}
server.serve(open_browser=False)
"""

results: list[bool] = []


def check(name: str, cond, extra: str = "") -> None:
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""))


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def http_get(url: str):
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()
    except urllib.error.URLError:
        return 0, b""


def write_settings(enabled: bool) -> None:
    payload = {"modules": {"enabled": {"model_usage": enabled}}}
    SETTINGS.write_text(json.dumps(payload), encoding="utf-8")


def table_names() -> set[str]:
    with sqlite3.connect(DB_PATH) as conn:
        return {row[0] for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'")}


class Server:
    def __init__(self, port: int, log_path: Path):
        self.port = port
        self.log_path = log_path
        self.proc: subprocess.Popen | None = None
        self.log_file = None

    @property
    def base(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    def start(self) -> bool:
        code = SERVER_CODE.format(root=ROOT, tmp=TMP, port=self.port)
        self.log_file = open(self.log_path, "w", encoding="utf-8")
        kwargs = {}
        if sys.platform == "win32":
            kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
        self.proc = subprocess.Popen(
            [sys.executable, "-X", "utf8", "-c", code],
            cwd=str(ROOT),
            stdout=self.log_file,
            stderr=subprocess.STDOUT,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
            **kwargs,
        )
        for _ in range(200):
            if self.proc.poll() is not None:
                break
            try:
                status, _ = http_get(self.base + "/api/health")
                if status == 200:
                    return True
            except (urllib.error.URLError, ConnectionError, TimeoutError):
                pass
            time.sleep(0.1)
        return False

    def stop(self) -> None:
        if self.proc is not None and self.proc.poll() is None:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.wait(timeout=5)
        self.proc = None
        if self.log_file is not None:
            self.log_file.close()
            self.log_file = None

    def log_text(self) -> str:
        try:
            return self.log_path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return ""

    def tail(self) -> str:
        return " / ".join(self.log_text().strip().splitlines()[-6:])


def main() -> int:
    log_dir = TMP / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    server: Server | None = None
    try:
        # ---------- 关闭模块 ----------
        write_settings(False)
        server = Server(free_port(), log_dir / "1_disabled.log")
        ok = server.start()
        check("关闭模块后服务启动", ok, server.tail())
        status, body = http_get(server.base + "/api/plugin/model_usage/records")
        payload = json.loads(body.decode("utf-8")) if body else {}
        check("关闭模块后 API 503",
              status == 503 and payload.get("error") == "module_disabled",
              f"HTTP {status} / {payload.get('error')}")
        status, body = http_get(server.base + "/api/plugins/list")
        listed = json.loads(body.decode("utf-8")) if body else {}
        check("关闭模块不隐藏插件卡",
              status == 200 and any(p.get("id") == "model_usage"
                                    for p in listed.get("plugins", [])))
        server.stop()

        names = table_names()
        check("关闭模块不建 model_usage_logs", "model_usage_logs" not in names,
              f"{len(names)} 张表")
        check("核心表仍创建", "items" in names)

        # ---------- 恢复模块 ----------
        write_settings(True)
        server = Server(free_port(), log_dir / "2_enabled.log")
        ok = server.start()
        check("恢复模块后服务启动", ok, server.tail())
        status, _ = http_get(server.base + "/api/plugin/model_usage/records")
        check("恢复模块后 API 200", status == 200, f"HTTP {status}")
        server.stop()

        names = table_names()
        check("恢复模块后自动建表", "model_usage_logs" in names)
        check("插件 schema 在插件目录",
              (ROOT / "plugins" / "model_usage" / "schema.sql").is_file()
              and not (ROOT / "db" / "schema" / "model_usage.sql").exists())
        bad_logs: list[str] = []
        for path in (log_dir / "1_disabled.log", log_dir / "2_enabled.log"):
            text = path.read_text(encoding="utf-8", errors="replace")
            bad_logs.extend(
                line.strip() for line in text.splitlines()
                if re.search(r"(?i)traceback|\berror\b|\bexception\b", line)
            )
        check("两次启动日志无 Error/Traceback", not bad_logs,
              " / ".join(bad_logs[:3]))
    finally:
        if server is not None:
            server.stop()
        import shutil
        shutil.rmtree(TMP, ignore_errors=True)

    print(f"\nRESULT: {results.count(True)}/{len(results)} PASS")
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
