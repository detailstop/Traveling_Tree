"""
插件数据目录隔离 · 重启验证（真实子进程服务 + 临时数据目录）。

覆盖：
  - 启动时按 manifest.data_dirs 自动创建 data/plugins/{rivet,filejudge,finance}/；
  - rivet 首次 API 调用生成默认 rivet.json；
  - 删除 data/plugins/rivet/ 后重启，目录自动重建、API 正常、默认 JSON 重新生成；
  - 启动日志无 Error/Traceback。

运行：python tests/smoke_plugin_data_dirs.py
"""
from __future__ import annotations

import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TMP = Path(tempfile.mkdtemp(prefix="rt_data_dirs_"))
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


class Server:
    def __init__(self, port: int, log: Path):
        self.port = port
        self.log = log
        self.proc = None
        self.handle = None

    @property
    def base(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    def start(self) -> bool:
        code = SERVER_CODE.format(root=ROOT, tmp=TMP, port=self.port)
        self.handle = open(self.log, "w", encoding="utf-8")
        kwargs = {}
        if sys.platform == "win32":
            kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
        self.proc = subprocess.Popen(
            [sys.executable, "-X", "utf8", "-c", code], cwd=str(ROOT),
            stdout=self.handle, stderr=subprocess.STDOUT,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"}, **kwargs)
        for _ in range(200):
            if self.proc.poll() is not None:
                break
            status, _ = http_get(self.base + "/api/health")
            if status == 200:
                return True
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
        if self.handle is not None:
            self.handle.close()
            self.handle = None

    def tail(self) -> str:
        try:
            return " / ".join(self.log.read_text(encoding="utf-8",
                                                errors="replace").strip().splitlines()[-6:])
        except OSError:
            return "<无日志>"


def log_has_error(path: Path) -> bool:
    text = path.read_text(encoding="utf-8", errors="replace")
    return any(re.search(r"(?i)traceback|\berror\b|\bexception\b", line)
               for line in text.splitlines())


def main() -> int:
    log_dir = TMP / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    server: Server | None = None
    try:
        server = Server(free_port(), log_dir / "1_start.log")
        ok = server.start()
        check("首次启动", ok, server.tail())
        for name in ("rivet", "filejudge", "finance"):
            check(f"启动创建 data/plugins/{name}",
                  (TMP / "plugins" / name).is_dir())
        status, _ = http_get(server.base + "/api/plugin/rivet/data")
        rivet_json = TMP / "plugins" / "rivet" / "rivet.json"
        check("rivet API 200", status == 200, f"HTTP {status}")
        check("rivet 默认 JSON 生成", rivet_json.is_file()
              and json.loads(rivet_json.read_text(encoding="utf-8")) == {"habits": []})
        check("首次启动日志无 Error", not log_has_error(log_dir / "1_start.log"))
        server.stop()

        shutil.rmtree(TMP / "plugins" / "rivet")
        check("已删除 rivet 数据目录", not (TMP / "plugins" / "rivet").exists())

        server = Server(free_port(), log_dir / "2_restart.log")
        ok = server.start()
        check("删除目录后重启", ok, server.tail())
        check("重启后自动重建 rivet 目录",
              (TMP / "plugins" / "rivet").is_dir())
        status, _ = http_get(server.base + "/api/plugin/rivet/data")
        check("重建后 rivet API 200", status == 200, f"HTTP {status}")
        check("默认 JSON 重新生成", rivet_json.is_file()
              and json.loads(rivet_json.read_text(encoding="utf-8")) == {"habits": []})
        check("重启日志无 Error/Traceback", not log_has_error(log_dir / "2_restart.log"))
        server.stop()
    finally:
        if server is not None:
            server.stop()
        shutil.rmtree(TMP, ignore_errors=True)

    print(f"\nRESULT: {results.count(True)}/{len(results)} PASS")
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
