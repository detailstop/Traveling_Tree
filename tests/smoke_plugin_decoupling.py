"""
插件生命周期解耦测试（真实目录改名 + 多次重启服务）。

覆盖全部 19 个 v2 插件。对每个插件：
  1. 启动服务，断言卡片存在、feature/style 200、日志无 Error；
  2. 停服，把 plugins/<id> 改名为 plugins/<id>_test，重启；
     断言服务健康、清单少 1、目标卡片消失、其余插件仍在、
     静态资源/API 404、日志无 Error/Traceback；
  3. 停服，改回 plugins/<id>，重启；
     断言卡片与 feature/style 恢复；
  4. 无论成败都恢复目录、停止进程、清理临时库。
  有后端的插件额外断言 API 正常时返回预期状态（200 或 405）、改名后 404。

运行：python tests/smoke_plugin_decoupling.py
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
TARGETS = [
    {"id": "ai", "api": "/api/plugin/ai/state", "api_ok": 200},
    {"id": "aidebug", "api": "/api/plugin/aidebug/state", "api_ok": 200},
    {"id": "bg_library", "api": "/api/plugin/bg_library/bg/tree", "api_ok": 200},
    {"id": "book_reader", "api": "/api/plugin/book_reader/state", "api_ok": 200},
    {"id": "expdata", "api": None},
    {"id": "filejudge", "api": "/api/plugin/filejudge/scan", "api_ok": 405},
    {"id": "finance", "api": "/api/plugin/finance/content-state", "api_ok": 200,
     "feature": "feature_finance.js"},
    {"id": "model_usage", "api": "/api/plugin/model_usage/records", "api_ok": 200},
    {"id": "netexp", "api": None},
    {"id": "pdf", "api": "/api/plugin/pdf/batch/scan", "api_ok": 405,
     "feature": "feature_pdf.js"},
    {"id": "pixel_art", "api": "/api/plugin/pixel_art/works", "api_ok": 200},
    {"id": "project_manager", "api": "/api/plugin/project_manager/projects", "api_ok": 200},
    {"id": "promptgen", "api": "/api/plugin/promptgen/state", "api_ok": 200},
    {"id": "rivet", "api": "/api/plugin/rivet/data", "api_ok": 200},
    {"id": "russian", "api": "/api/plugin/russian/items", "api_ok": 200},
    {"id": "schedule", "api": "/api/plugin/schedule/state", "api_ok": 200},
    {"id": "screeps", "api": "/api/plugin/screeps/state", "api_ok": 200},
    {"id": "sim", "api": None},
    {"id": "urlarch", "api": "/api/plugin/urlarch/state", "api_ok": 200},
]
TOTAL = len(TARGETS)
TMP = Path(tempfile.mkdtemp(prefix="rt_decouple_test_"))

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


def http_get(url: str, timeout: float = 10):
    try:
        request = urllib.request.Request(url, headers={"Connection": "close"})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()
    except urllib.error.URLError:
        return 0, b""


def plugin_ids(base: str):
    status, body = http_get(base + "/api/plugins/list")
    try:
        data = json.loads(body.decode("utf-8"))
    except ValueError:
        return status, None
    plugins = data.get("plugins") if isinstance(data, dict) else None
    ids = [p.get("id") for p in plugins] if isinstance(plugins, list) else None
    return status, ids


def log_errors(path: Path) -> list[str]:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ["<日志不可读>"]
    bad = []
    # http.server logs a traceback when the client closes a keep-alive socket
    # during teardown. It is a client-disconnect artifact, not an app error.
    # Ignore only blocks that explicitly contain ConnectionResetError/10054.
    blocks = re.split(r"(?=Exception occurred during processing of request)", text)
    for block in blocks:
        if ("Exception occurred during processing of request" in block
                and ("ConnectionResetError" in block or "WinError 10054" in block)):
            continue
        for line in block.splitlines():
            if re.search(r"(?i)traceback|\berror\b|\bexception\b", line):
                bad.append(line.strip())
    return bad


class Server:
    """用临时数据目录启动真实 ui.web.server（不打开浏览器）。"""

    def __init__(self, port: int, log_path: Path):
        self.port = port
        self.log_path = log_path
        self.proc: subprocess.Popen | None = None
        self.log_file = None

    @property
    def base(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    def start(self) -> bool:
        for attempt in range(3):
            if attempt:
                self.port = free_port()
                time.sleep(0.5)
            code = SERVER_CODE.format(root=ROOT, tmp=TMP, port=self.port)
            self.log_file = open(self.log_path, "w", encoding="utf-8")
            kwargs = {}
            if sys.platform == "win32":
                kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
            try:
                self.proc = subprocess.Popen(
                    [sys.executable, "-X", "utf8", "-c", code],
                    cwd=str(ROOT),
                    stdout=self.log_file,
                    stderr=subprocess.STDOUT,
                    env={**os.environ, "PYTHONIOENCODING": "utf-8"},
                    **kwargs,
                )
            except OSError:
                self.proc = None
                self.stop()
                continue
            # 最多等 20s；启动失败时把日志尾部带进断言信息。
            for _ in range(200):
                if self.proc.poll() is not None:
                    break
                try:
                    status, _ = http_get(self.base + "/api/health", timeout=1)
                    if status == 200:
                        return True
                except (urllib.error.URLError, ConnectionError, TimeoutError):
                    pass
                time.sleep(0.1)
            self.stop()
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

    def tail(self, lines: int = 8) -> str:
        try:
            text = self.log_path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return "<无日志>"
        return " / ".join(text.strip().splitlines()[-lines:])


def main() -> int:
    target_ids = [target["id"] for target in TARGETS]
    for target in TARGETS:
        pid = target["id"]
        plugin = ROOT / "plugins" / pid
        renamed = ROOT / "plugins" / f"{pid}_test"
        if not plugin.is_dir():
            print(f"FAIL 找不到插件目录：{plugin}")
            return 1
        if renamed.exists():
            print(f"FAIL 临时目录已存在，先手工清理：{renamed}")
            return 1

    log_dir = TMP / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    server: Server | None = None

    def start_server(name: str) -> Server:
        instance = Server(free_port(), log_dir / name)
        return instance

    try:
        for target in TARGETS:
            pid = target["id"]
            api_path = target.get("api")
            feature_name = target.get("feature", "feature.js")
            plugin = ROOT / "plugins" / pid
            renamed = ROOT / "plugins" / f"{pid}_test"
            others = [other for other in target_ids if other != pid]

            # ---------- 阶段 1：正常启动 ----------
            server = start_server(f"{pid}_1_start.log")
            ok = server.start()
            check(f"{pid} 阶段1 服务启动", ok, server.tail())
            status, ids = plugin_ids(server.base)
            check(f"{pid} 阶段1 清单 {TOTAL}",
                  status == 200 and ids is not None and len(ids) == TOTAL,
                  f"HTTP {status} / {len(ids or [])} 个插件")
            check(f"{pid} 阶段1 卡片存在", bool(ids) and pid in ids)
            status, _ = http_get(server.base + f"/plugins/{pid}/{feature_name}")
            check(f"{pid} 阶段1 feature 200", status == 200, f"HTTP {status}")
            status, _ = http_get(server.base + f"/plugins/{pid}/plugin.css")
            check(f"{pid} 阶段1 style 200", status == 200, f"HTTP {status}")
            if api_path:
                status, _ = http_get(server.base + api_path)
                check(f"{pid} 阶段1 API {target.get('api_ok', 200)}",
                      status == target.get("api_ok", 200), f"HTTP {status}")
            errors = log_errors(log_dir / f"{pid}_1_start.log")
            check(f"{pid} 阶段1 日志无 Error", not errors, " / ".join(errors[:3]))
            server.stop()

            # ---------- 阶段 2：改名后重启 ----------
            plugin.rename(renamed)
            try:
                server = start_server(f"{pid}_2_renamed.log")
                ok = server.start()
                check(f"{pid} 阶段2 改名后服务仍启动", ok, server.tail())
                status, _ = http_get(server.base + "/api/health")
                check(f"{pid} 阶段2 /api/health 200", status == 200, f"HTTP {status}")
                status, ids = plugin_ids(server.base)
                check(f"{pid} 阶段2 清单 {TOTAL - 1}",
                      status == 200 and ids is not None and len(ids) == TOTAL - 1,
                      f"HTTP {status} / {len(ids or [])} 个插件")
                check(f"{pid} 阶段2 卡片消失", bool(ids) and pid not in ids)
                check(f"{pid} 阶段2 其余插件仍在",
                      bool(ids) and all(other in ids for other in others),
                      ", ".join(ids or [])[:160])
                status, _ = http_get(server.base + f"/plugins/{pid}/{feature_name}")
                check(f"{pid} 阶段2 feature 404", status == 404, f"HTTP {status}")
                status, _ = http_get(server.base + f"/plugins/{pid}/plugin.css")
                check(f"{pid} 阶段2 style 404", status == 404, f"HTTP {status}")
                status, _ = http_get(server.base + (api_path or f"/api/plugin/{pid}/health"))
                check(f"{pid} 阶段2 API 404", status == 404, f"HTTP {status}")
                if pid == "book_reader":
                    status, _ = http_get(server.base + "/api/plugin/pixel_art/works")
                    check("book_reader 改名后 pixel_art API 仍正常", status == 200, f"HTTP {status}")
                errors = log_errors(log_dir / f"{pid}_2_renamed.log")
                check(f"{pid} 阶段2 日志无 Error/Traceback", not errors,
                      " / ".join(errors[:3]))
                server.stop()
            finally:
                if renamed.exists() and not plugin.exists():
                    renamed.rename(plugin)
            check(f"{pid} 目录已恢复", plugin.is_dir() and not renamed.exists())

            # ---------- 阶段 3：恢复后重启 ----------
            server = start_server(f"{pid}_3_restored.log")
            ok = server.start()
            check(f"{pid} 阶段3 恢复后服务启动", ok, server.tail())
            status, ids = plugin_ids(server.base)
            check(f"{pid} 阶段3 清单 {TOTAL}",
                  status == 200 and ids is not None and len(ids) == TOTAL,
                  f"HTTP {status} / {len(ids or [])} 个插件")
            check(f"{pid} 阶段3 卡片恢复", bool(ids) and pid in ids)
            status, _ = http_get(server.base + f"/plugins/{pid}/{feature_name}")
            check(f"{pid} 阶段3 feature 200", status == 200, f"HTTP {status}")
            status, _ = http_get(server.base + f"/plugins/{pid}/plugin.css")
            check(f"{pid} 阶段3 style 200", status == 200, f"HTTP {status}")
            if api_path:
                status, _ = http_get(server.base + api_path)
                check(f"{pid} 阶段3 API {target.get('api_ok', 200)}",
                      status == target.get("api_ok", 200), f"HTTP {status}")
            errors = log_errors(log_dir / f"{pid}_3_restored.log")
            check(f"{pid} 阶段3 日志无 Error/Traceback", not errors,
                  " / ".join(errors[:3]))
            server.stop()
    finally:
        if server is not None:
            server.stop()
        for target in TARGETS:
            pid = target["id"]
            plugin = ROOT / "plugins" / pid
            renamed = ROOT / "plugins" / f"{pid}_test"
            if renamed.exists() and not plugin.exists():
                renamed.rename(plugin)
        shutil.rmtree(TMP, ignore_errors=True)

    restore_errors = [
        pid for pid in target_ids
        if not (ROOT / "plugins" / pid).is_dir()
        or (ROOT / "plugins" / f"{pid}_test").exists()
    ]
    check("十九个插件目录已恢复", not restore_errors, " | ".join(restore_errors))
    print(f"\nRESULT: {results.count(True)}/{len(results)} PASS")
    return 0 if all(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
