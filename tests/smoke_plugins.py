"""
插件层冒烟测试（manifest v2 驱动 + 零硬编码；临时数据库，不触碰真实数据）。

覆盖：
  1. 清单静态校验：plugins/<id>/manifest.json 结构、id/feature/backend/db/style/data_dirs/
     shared_features、v2 entries、db.module_key/schema/migrate 与插件目录自包含；
  2. 主程序零硬编码：无 ui/web/plugin_routes.py / PLUGIN_ROUTES、无 v2 插件专属分支；
  3. 内置工具边界：app.js 的 TOOLS 0 个、TOOL_FEATURE_FILES 覆盖、features/ 无孤儿；
  4. 模块语法：node 可用时用 `node --check` 校验 app.js 与 1 个内置 feature；
  5. HTTP 契约：/api/plugins/list 字段、/plugins/* 内容与磁盘一致、404/穿越拒绝、
     v2 样式按 manifest.style 提供、6 类后端 API 可达、data_dirs 自动创建、
     ai/aidebug shared_features 暴露；
  6. 扫描容错：坏 JSON、enabled:false、id 不符、feature 越界/缺失、v2 缺 entries、
     backend/style 路径不合法均不进入清单；
  7. 插件后端：backend.py 可 import、/api/plugin/rivet/data 与 filejudge/scan 可用、
      旧路由 404、源码不暴露、backend 异常不冒泡；
  8. CSS 自包含：v2 专属样式在 plugins/<id>/plugin.css、共享样式留在 app.css，
     迁移后的选择器不得在 app.css 残留（规则见 docs/plugin-standard-v1.md）。

运行：python tests/smoke_plugins.py
"""
import importlib.util
import json
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

TMP = Path(tempfile.mkdtemp(prefix="rt_plugins_test_"))

import config  # noqa: E402

config.DATA_DIR = TMP
config.DB_PATH = TMP / "russian_tutor.db"
config.COBUILD_LOG_PATH = TMP / "docs" / "多AI共建日志.md"

import ui.web.server as srv  # noqa: E402
from ui.web.server import Handler, ThreadingHTTPServer, _bootstrap_db  # noqa: E402

PLUGINS = ROOT / "plugins"
FEATURES = ROOT / "ui" / "web" / "static" / "features"
APP_JS = ROOT / "ui" / "web" / "static" / "app.js"
APP_CSS = ROOT / "ui" / "web" / "static" / "app.css"
INDEX_HTML = ROOT / "ui" / "web" / "static" / "index.html"

EXPECTED_TOOL_IDS = set()
EXPECTED_FEATURE_FILES = {"webchat.js"}

REQUIRED_MANIFEST_KEYS = {
    "id", "name", "icon", "enabled", "version", "provides", "consumes",
}
ID_RE = re.compile(r"^[a-z][a-z0-9_-]{1,31}$")
SHELF_RE = re.compile(r"^[a-z][a-z0-9_]{0,23}$")

# app.js 的下载分组标签 `pdf` / `finance` 是网盘/下载功能分组，不是插件注册分支。
APP_JS_NON_PLUGIN_IDS = {"pdf", "finance", "promptgen", "cobuild"}

# v2 插件：入口/后端/db/样式全部 manifest 声明，CSS 自包含。
# 以下清单全部从 plugins/*/manifest.json 与文件系统推导，避免逐个插件同步。
def _load_manifests():
    found = {}
    for path in sorted(PLUGINS.glob("*/manifest.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        pid = str(data.get("id") or "").strip() if isinstance(data, dict) else ""
        if pid and pid == path.parent.name:
            found[pid] = data
    return found


def _plugin_files(pid):
    base = PLUGINS / pid
    return sorted(f.name for f in base.iterdir()
                  if f.is_file() and f.suffix != ".pyc")


_MANIFESTS = _load_manifests()
EXPECTED_V2_PLUGINS = sorted(
    pid for pid, m in _MANIFESTS.items() if m.get("schema_version") == 2)
BACKEND_ONLY_PLUGINS = {
    pid for pid, m in _MANIFESTS.items()
    if m.get("backend") and not m.get("entries")
}
V2_ENTRY_IDS = {
    pid: [e.get("id") for e in (m.get("entries") or [])]
    for pid, m in _MANIFESTS.items()
}
EXPECTED_PLUGIN_IDS = [
    pid for pid in _MANIFESTS if (_MANIFESTS[pid].get("entries") or [])
]
EXPECTED_ENTRY_IDS = sorted(
    eid for ids in V2_ENTRY_IDS.values() for eid in ids
)
V2_BACKEND_FILES = {
    pid: m.get("backend") for pid, m in _MANIFESTS.items()
}
V2_DATA_DIRS = {
    pid: (m.get("data_dirs") or []) for pid, m in _MANIFESTS.items()
}
V2_SHARED_FEATURES = {
    pid: (m.get("shared_features") or []) for pid, m in _MANIFESTS.items()
}
V2_EXPECTED_FILES = {
    pid: _plugin_files(pid) for pid in _MANIFESTS
}
V2_DB_SPECS = {
    pid: m.get("db") for pid, m in _MANIFESTS.items()
    if m.get("db") is not None
}
PLUGINS_WITH_BACKEND = {
    pid for pid, m in _MANIFESTS.items() if m.get("backend")
}

# 已迁入 plugins/<id>/plugin.css 的专属选择器；app.css 不允许残留。
# 共享的 .pi-check / .pi-badge / .fin-note / .rv-card 等仍留在 app.css。
MIGRATED_CSS_PREFIXES = {
    "ai": [],
    "aidebug": [".adb-"],
    "sim": [".sim-"],
    "expdata": [".exp-"],
    "schedule": [".hm", ".wp-", ".plan-tip", ".pi-overlay", ".pi-card",
                 ".pi-lb", ".pi-ta", ".pi-add", ".pi-done", ".pi-text", ".pi-note"],
    "urlarch": [".ua-"],
    "model_usage": [".mu-"],
    "pdf": [".pdf-", ".cm-", ".pd-", ".po-", ".pp-", ".pr-",
            ".pi-no", ".pi-ico", ".pi-thumb", ".pi-name", ".pi-size", ".pi-x",
            ".batch-form", ".bff-", ".bf-", ".br-no", ".br-name", ".br-kind",
            ".br-size", ".br-pct"],
    "netexp": [],
    "filejudge": [".fj-"],
    "finance": [".fin-", ".pie-", ".attr-", ".attrib-", ".acct-", ".fn-",
                ".up ", ".down ", ".pi-dot"],
    "pixel_art": [".pa-"],
    "rivet": [".rv-"],
    "project_manager": [".pm-"],
    "book_reader": [".br-", ".rs-"],
    "bg_library": [".bg-"],
    "promptgen": [".pg-"],
    "russian": [".flash", ".region", ".rate-", "#recite-root", ".recite",
                ".plan-grid", ".plan-col", ".quota-", ".type-", ".item-chip",
                ".due-", ".lv-", ".theme-row", ".month-bar"],
}
MIGRATED_CSS_EXACT = (
    ".pi {", ".pi:hover", ".pi.done",
    ".br-mark { text-align: center; font-weight: 800; }", "@keyframes bf-run",
    ".section-title[data-settoggle]", ".gcard.fin-collapsed",
)
SHARED_CSS_SELECTORS = (".pi-check", ".pi-badge", ".fin-note", ".rv-card",
                        ".exp-wrap", ".exp-ctrl")
PLUGIN_CSS_ANCHORS = {
    "ai": [],
    "aidebug": [".adb-pre"],
    "sim": [".sim-wrap", ".sim-canvas-box"],
    "expdata": [".exp-imgbox"],
    "schedule": [".hm-cell", ".wp-strip", ".pi-card", ".plan-tip"],
    "screeps": [],
    "urlarch": [".ua-group"],
    "model_usage": [".mu-card", ".mu-price-wrap"],
    "pdf": [".pdf-drop", ".pdf-item", ".pi-x", ".batch-form", ".bf-row"],
    "netexp": [],
    "filejudge": [".fj-form", ".fj-preview"],
    "finance": [".fin-tabs", ".fn-chart", ".pi-dot"],
    "pixel_art": [".pa-head", ".pa-layout"],
    "rivet": [".rv-overlay", ".rv-habit", ".rv-hm-cell"],
    "project_manager": [".pm-head", ".pm-stage-nav"],
    "book_reader": [".br-reader", ".rs-screen"],
    "bg_library": [".bg-app", ".bg-file-row"],
    "promptgen": [".pg-flow-group", ".pg-var-block"],
    "russian": [".flash-wrap", ".region", ".plan-grid", "#recite-root"],
}


def css_line_matches(line: str, prefix: str) -> bool:
    """判断 CSS 行是否以指定插件命名空间选择器开头。

    带 `-` 的前缀（如 `.sim-`）按类名前缀匹配；不带 `-` 的短前缀（如
    `.pi`）要求后一个字符不是字母/数字，避免把 `.pill` / `.pie` 误算进来。
    """
    text = line.lstrip()
    if not text.startswith(prefix):
        return False
    if prefix.endswith("-"):
        return True
    rest = text[len(prefix):]
    return not rest or not rest[0].isalnum()


def main() -> int:
    ok: list[bool] = []

    def check(name: str, cond, extra: str = "") -> None:
        ok.append(bool(cond))
        print(("PASS " if cond else "FAIL ") + name + (f"  [{extra}]" if extra else ""))

    # ------------------------------------------------------------
    # 1. 清单静态校验
    # ------------------------------------------------------------
    plugin_dirs = sorted(
        [p for p in PLUGINS.iterdir() if p.is_dir()] if PLUGINS.is_dir() else [],
        key=lambda p: p.name,
    )
    manifests: dict[str, dict] = {}
    read_errors: list[str] = []
    for directory in plugin_dirs:
        manifest_path = directory / "manifest.json"
        if not manifest_path.is_file():
            read_errors.append(f"{directory.name}: 缺少 manifest.json")
            continue
        try:
            data = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            read_errors.append(f"{directory.name}: 读取失败（{exc}）")
            continue
        if not isinstance(data, dict):
            read_errors.append(f"{directory.name}: 顶层不是 JSON 对象")
            continue
        manifests[directory.name] = data

    check("manifest 可读", not read_errors, " | ".join(read_errors))
    check("插件目录数", len(plugin_dirs) == len(EXPECTED_PLUGIN_IDS) + len(BACKEND_ONLY_PLUGINS),
          f"{len(plugin_dirs)} 个：{', '.join(p.name for p in plugin_dirs)}")

    schema_errors: list[str] = []
    feature_registration_errors: list[str] = []
    active_ids: list[str] = []
    v2_plugins: list[str] = []
    declared_style_paths: set[Path] = set()
    for name, data in sorted(manifests.items()):
        missing = REQUIRED_MANIFEST_KEYS - set(data)
        if missing:
            schema_errors.append(f"{name}: 缺字段 {','.join(sorted(missing))}")
        if str(data.get("id") or "") != name:
            schema_errors.append(f"{name}: id 与目录名不一致（{data.get('id')!r}）")
        if not isinstance(data.get("id"), str) or not ID_RE.fullmatch(data.get("id") or ""):
            schema_errors.append(f"{name}: id 格式不合法")
        if not isinstance(data.get("name"), str) or not data.get("name").strip():
            schema_errors.append(f"{name}: name 为空")
        elif len(data["name"]) > 40:
            schema_errors.append(f"{name}: name 过长")
        if not isinstance(data.get("icon"), str) or not data.get("icon").strip():
            schema_errors.append(f"{name}: icon 为空")
        if not isinstance(data.get("enabled"), bool):
            schema_errors.append(f"{name}: enabled 不是布尔值")
        if not isinstance(data.get("version"), str) or not data.get("version").strip():
            schema_errors.append(f"{name}: version 为空")
        for key in ("provides", "consumes"):
            value = data.get(key)
            if not isinstance(value, list) or not all(isinstance(x, str) for x in value):
                schema_errors.append(f"{name}: {key} 不是字符串数组")

        schema_version = data.get("schema_version", 1)
        if (not isinstance(schema_version, int) or isinstance(schema_version, bool)
                or schema_version not in (1, 2)):
            schema_errors.append(f"{name}: schema_version 不合法")
        elif schema_version == 2:
            v2_plugins.append(name)
            _entries = data.get("entries")
            if (not isinstance(_entries, list)
                    or (not _entries and (name not in BACKEND_ONLY_PLUGINS
                                          or not data.get("backend")))):
                schema_errors.append(f"{name}: v2 必须有非空 entries（backend-only 需声明 backend）")

        if "css" in data:
            schema_errors.append(f"{name}: 使用 style 字段声明样式，禁止 css")
        style = data.get("style")
        if style is not None:
            if not isinstance(style, str) or not style.strip():
                schema_errors.append(f"{name}: style 不是非空字符串")
            else:
                style_path = Path(style)
                if style_path.is_absolute() or ".." in style_path.parts:
                    schema_errors.append(f"{name}: style 越界（{style}）")
                elif style_path.suffix.lower() != ".css":
                    schema_errors.append(f"{name}: style 不是 .css（{style}）")
                else:
                    resolved = (PLUGINS / name / style).resolve()
                    try:
                        resolved.relative_to((PLUGINS / name).resolve())
                    except ValueError:
                        schema_errors.append(f"{name}: style 解析后越界")
                    else:
                        if not resolved.is_file():
                            schema_errors.append(f"{name}: style 文件不存在（{style}）")
                        else:
                            declared_style_paths.add(resolved)

        backend = data.get("backend")
        backend_file = None
        if isinstance(backend, dict):
            backend_file = backend.get("file")
            backend_entry = backend.get("entry", "handle")
            if not isinstance(backend_entry, str) or not backend_entry.isidentifier():
                schema_errors.append(f"{name}: backend.entry 不合法")
            for flag in ("binary", "status"):
                if flag in backend and not isinstance(backend.get(flag), bool):
                    schema_errors.append(f"{name}: backend.{flag} 不是布尔值")
        elif isinstance(backend, str):
            backend_file = backend
        elif backend is not None:
            schema_errors.append(f"{name}: backend 必须是字符串/对象/null")
        if name in PLUGINS_WITH_BACKEND and not backend_file:
            schema_errors.append(f"{name}: 缺少 backend 字段")
        if backend is not None:
            if not isinstance(backend_file, str) or not backend_file.strip():
                schema_errors.append(f"{name}: backend.file 为空")
            else:
                backend_path = Path(backend_file)
                if backend_path.is_absolute() or ".." in backend_path.parts:
                    schema_errors.append(f"{name}: backend 越界（{backend_file}）")
                elif backend_path.suffix.lower() != ".py":
                    schema_errors.append(f"{name}: backend 不是 .py（{backend_file}）")
                elif not (PLUGINS / name / backend_file).is_file():
                    schema_errors.append(f"{name}: backend 文件不存在（{backend_file}）")

        db = data.get("db")
        if db is not None:
            if isinstance(db, str):
                db_module, db_schema, db_migrate = name, db, None
            elif isinstance(db, dict):
                db_module = str(db.get("module_key") or name).strip()
                db_schema = db.get("schema")
                db_migrate = db.get("migrate")
                if not ID_RE.fullmatch(db_module):
                    schema_errors.append(f"{name}: db.module_key 不合法（{db_module}）")
                if db_migrate is not None:
                    migrate_path = Path(str(db_migrate))
                    if (migrate_path.is_absolute() or ".." in migrate_path.parts
                            or migrate_path.suffix.lower() != ".py"
                            or not (PLUGINS / name / str(db_migrate)).is_file()):
                        schema_errors.append(f"{name}: db.migrate 不合法（{db_migrate}）")
            else:
                schema_errors.append(f"{name}: db 必须是字符串/对象/null")
                db_schema = None
            if db_schema is not None:
                if not isinstance(db_schema, str) or not db_schema.strip():
                    schema_errors.append(f"{name}: db.schema 不是非空字符串")
                else:
                    db_path = Path(db_schema)
                    if db_path.is_absolute() or ".." in db_path.parts:
                        schema_errors.append(f"{name}: db.schema 越界（{db_schema}）")
                    elif db_path.suffix.lower() != ".sql":
                        schema_errors.append(f"{name}: db.schema 不是 .sql（{db_schema}）")
                    elif not (PLUGINS / name / db_schema).is_file():
                        schema_errors.append(f"{name}: db.schema 文件不存在（{db_schema}）")

        data_dirs = data.get("data_dirs")
        if data_dirs is not None:
            if not isinstance(data_dirs, list) or not all(
                    isinstance(item, str) and ID_RE.fullmatch(item)
                    for item in data_dirs):
                schema_errors.append(f"{name}: data_dirs 必须是合法目录名数组")
        shared_features = data.get("shared_features")
        if shared_features is not None:
            if not isinstance(shared_features, list) or not all(
                    isinstance(item, str) and ID_RE.fullmatch(item)
                    for item in shared_features):
                schema_errors.append(f"{name}: shared_features 必须是合法模块名数组")
            else:
                for item in shared_features:
                    if not (FEATURES / f"{item}.js").is_file():
                        schema_errors.append(f"{name}: shared_features 文件不存在（{item}）")

        entries = data.get("entries")
        targets: list[tuple[str, str]] = []
        if entries is None:
            for key in ("desc", "shelf", "feature"):
                if key not in data:
                    schema_errors.append(f"{name}: 单入口缺少 {key}")
            if "desc" in data and not isinstance(data.get("desc"), str):
                schema_errors.append(f"{name}: desc 不是字符串")
            if not isinstance(data.get("shelf"), str) or not SHELF_RE.fullmatch(data.get("shelf") or ""):
                schema_errors.append(f"{name}: shelf 不合法")
            targets = [(name, str(data.get("feature") or "").strip())]
        else:
            if (not isinstance(entries, list)
                    or (not entries and (name not in BACKEND_ONLY_PLUGINS
                                         or not data.get("backend")))):
                schema_errors.append(f"{name}: entries 必须为非空数组（backend-only 需声明 backend）")
            else:
                seen_entries: set[str] = set()
                for idx, entry in enumerate(entries, 1):
                    if not isinstance(entry, dict):
                        schema_errors.append(f"{name}: entries 第 {idx} 项不是对象")
                        continue
                    eid = str(entry.get("id") or "").strip()
                    if not eid or not ID_RE.fullmatch(eid):
                        schema_errors.append(f"{name}: entries 第 {idx} 项 id 不合法")
                    elif eid in seen_entries:
                        schema_errors.append(f"{name}: entry id 重复（{eid}）")
                    else:
                        seen_entries.add(eid)
                    for key in ("name", "icon", "shelf", "feature"):
                        value = entry.get(key)
                        if not isinstance(value, str) or not value.strip():
                            schema_errors.append(f"{name}.{eid or idx}: 缺少 {key}")
                    if not isinstance(entry.get("shelf"), str) or not SHELF_RE.fullmatch(entry.get("shelf") or ""):
                        schema_errors.append(f"{name}.{eid or idx}: shelf 不合法")
                    targets.append((eid or f"entry{idx}", str(entry.get("feature") or "").strip()))

        for eid, feature in targets:
            if not feature:
                schema_errors.append(f"{name}:{eid} feature 为空")
                continue
            feature_path = Path(feature)
            if feature_path.is_absolute() or ".." in feature_path.parts:
                schema_errors.append(f"{name}:{eid} feature 越界（{feature}）")
                continue
            source = PLUGINS / name / feature
            try:
                source.resolve().relative_to((PLUGINS / name).resolve())
            except ValueError:
                schema_errors.append(f"{name}:{eid} feature 解析后越界")
                continue
            if not source.is_file():
                schema_errors.append(f"{name}:{eid} feature 文件不存在（{feature}）")
                continue
            if source.stat().st_size < 300:
                schema_errors.append(f"{name}:{eid} feature 文件过小")
            text = source.read_text(encoding="utf-8", errors="replace")
            if "__toolRenderers" not in text:
                feature_registration_errors.append(f"{name}:{eid} 未注册 __toolRenderers")
            elif not re.search(
                r"__toolRenderers\s*(?:\.\s*" + re.escape(eid) +
                r"\b|\[\s*['\"]" + re.escape(eid) + r"['\"]\s*\])",
                text,
            ):
                feature_registration_errors.append(
                    f"{name}:{eid} 注册名与 id 不一致")
        if data.get("enabled") is True:
            active_ids.append(name)

    active_ids = [name for name in active_ids if name not in BACKEND_ONLY_PLUGINS]
    check("manifest 结构", not schema_errors, " | ".join(schema_errors[:6]))
    check("feature 注册名", not feature_registration_errors,
          " | ".join(feature_registration_errors[:6]))
    check("启用插件清单", active_ids == EXPECTED_PLUGIN_IDS,
          f"{len(active_ids)} 个：{', '.join(active_ids)}")
    check("v2 插件清单", v2_plugins == EXPECTED_V2_PLUGINS, ", ".join(v2_plugins))

    # ---- 零硬编码：manifest 是唯一来源，主程序不得有插件注册表 ----
    registry_errors: list[str] = []
    if (ROOT / "ui" / "web" / "plugin_routes.py").exists():
        registry_errors.append("ui/web/plugin_routes.py 仍存在")
    for source in sorted((ROOT / "ui").rglob("*.py")) + sorted((ROOT / "ui").rglob("*.js")):
        text = source.read_text(encoding="utf-8", errors="replace")
        if "PLUGIN_ROUTES" in text or "plugin_routes" in text:
            registry_errors.append(str(source.relative_to(ROOT)))
    for source in (ROOT / "ui" / "web" / "server.py", APP_JS):
        text = source.read_text(encoding="utf-8")
        for pid in EXPECTED_V2_PLUGINS:
            if source == APP_JS and pid in APP_JS_NON_PLUGIN_IDS:
                continue
            if re.search(r"['\"]" + re.escape(pid) + r"['\"]", text):
                registry_errors.append(f"{source.name}: 含 {pid} 硬编码")
    check("主程序零插件注册表", not registry_errors, " | ".join(registry_errors[:5]))

    # ---- v2 样本自包含：目录文件、backend/db/style/entries 均由 manifest 声明 ----
    v2_file_errors: list[str] = []
    v2_decl_errors: list[str] = []
    for pid in EXPECTED_V2_PLUGINS:
        manifest = manifests.get(pid) or {}
        files = sorted(p.name for p in (PLUGINS / pid).iterdir() if p.is_file())
        expected_files = V2_EXPECTED_FILES[pid]
        if files != expected_files:
            v2_file_errors.append(f"{pid}: {', '.join(files)}")
        if manifest.get("schema_version") != 2:
            v2_decl_errors.append(f"{pid}: schema_version")
        if manifest.get("backend") != V2_BACKEND_FILES.get(pid):
            v2_decl_errors.append(f"{pid}: backend")
        expected_db = V2_DB_SPECS.get(pid)
        db = manifest.get("db")
        if expected_db is None:
            if db is not None:
                v2_decl_errors.append(f"{pid}: db 应为 null")
        elif not isinstance(db, dict) or any(db.get(k) != v for k, v in expected_db.items()):
            v2_decl_errors.append(f"{pid}: db 声明")
        if pid not in BACKEND_ONLY_PLUGINS and manifest.get("style") != "plugin.css":
            v2_decl_errors.append(f"{pid}: style")
        if (manifest.get("data_dirs") or []) != V2_DATA_DIRS.get(pid):
            v2_decl_errors.append(f"{pid}: data_dirs")
        if (manifest.get("shared_features") or []) != V2_SHARED_FEATURES.get(pid):
            v2_decl_errors.append(f"{pid}: shared_features")
        entries = manifest.get("entries")
        expected_entries = V2_ENTRY_IDS.get(pid, [pid])
        if not isinstance(entries, list) or [e.get("id") for e in entries] != expected_entries:
            v2_decl_errors.append(f"{pid}: entries")
    check("v2 插件目录自包含", not v2_file_errors, " | ".join(v2_file_errors[:5]))
    check("v2 插件声明完整", not v2_decl_errors, " | ".join(v2_decl_errors[:5]))

    for pid in sorted(PLUGINS_WITH_BACKEND):
        backend_path = PLUGINS / pid / "backend.py"
        check(f"{pid} backend 文件", backend_path.is_file())
        if backend_path.is_file():
            try:
                spec = importlib.util.spec_from_file_location(
                    f"smoke_{pid}_backend", backend_path)
                backend = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(backend)
                check(f"{pid} backend 可 import",
                      callable(getattr(backend, "handle", None)))
            except Exception as exc:  # noqa: BLE001
                check(f"{pid} backend 可 import", False, str(exc))

    # ------------------------------------------------------------
    # 2. 内置工具与插件边界
    # ------------------------------------------------------------
    app_text = APP_JS.read_text(encoding="utf-8")
    index_text = INDEX_HTML.read_text(encoding="utf-8")

    tools_block = re.search(r"const TOOLS = \[(.*?)\n\];", app_text, re.S)
    builtin_ids: list[str] = []
    if tools_block:
        builtin_ids = re.findall(r"^\s*\{\s*id:\s*'([^']+)'", tools_block.group(1), re.M)
    check("app.js TOOLS 块", bool(tools_block))
    check("内置工具 0 个", len(builtin_ids) == 0 and set(builtin_ids) == EXPECTED_TOOL_IDS,
          f"{len(builtin_ids)} 个")
    check("内置工具无重复", len(builtin_ids) == len(set(builtin_ids)))
    check("内置/插件无重名", not (set(builtin_ids) & set(active_ids)),
          " | ".join(sorted(set(builtin_ids) & set(active_ids))))

    files_block = re.search(r"const TOOL_FEATURE_FILES = \{(.*?)\n\};", app_text, re.S)
    feature_map: dict[str, str] = {}
    if files_block:
        feature_map = {
            key.strip("'"): value
            for key, value in re.findall(r"([\w'-]+)\s*:\s*'([^']+)'", files_block.group(1))
        }
    check("TOOL_FEATURE_FILES 覆盖", set(feature_map) == EXPECTED_TOOL_IDS,
          f"{len(feature_map)} 个键")
    missing_files = [
        f"{value}.js" for value in sorted(set(feature_map.values()))
        if not (FEATURES / f"{value}.js").is_file()
    ]
    check("内置 feature 文件存在", not missing_files, " | ".join(missing_files))

    actual_feature_files = {p.name for p in FEATURES.glob("*.js")}
    check("features/ 文件集合", actual_feature_files == EXPECTED_FEATURE_FILES,
          f"{len(actual_feature_files)} 个")
    check("features/ 无孤儿/无缺失",
          not (actual_feature_files - EXPECTED_FEATURE_FILES)
          and not (EXPECTED_FEATURE_FILES - actual_feature_files))
    check("reader_screen 插件内共享",
          "import('./reader_screen.js')" in
          (PLUGINS / "book_reader" / "feature.js").read_text(encoding="utf-8")
          and (PLUGINS / "book_reader" / "reader_screen.js").is_file())
    check("webchat 共享依赖",
          "TOOL_FEATURE_DEPENDENCIES = {}"
          in app_text)

    check("插件禁用键", "rt_plugins_disabled" in app_text)
    check("allTools 过滤禁用", re.search(
        r"function allTools\(\)\s*\{[\s\S]{0,220}?pluginDisabledIds\(\)", app_text) is not None)
    check("禁用插件拒绝渲染", "插件已禁用" in app_text)
    check("启动时加载插件清单", "await loadPlugins();" in app_text)
    check("插件清单驱动加载",
          re.search(r"function loadPlugins\(\)[\s\S]{0,500}?api\('/api/plugins/list'\)",
                    app_text) is not None)
    check("插件 feature 动态 import", "loadPluginFeature" in app_text and "import(url)" in app_text)
    check("插件样式按 manifest 加载",
          "loadPluginStyle" in app_text and "style_url" in app_text)
    check("样式先于 feature",
          re.search(r"await loadPluginStyle\(plugin\);[\s\S]{0,80}?await loadPluginFeature\(plugin\);",
                    app_text) is not None)
    check("app.js 无 sim 分支", not re.search(r"['\"]sim['\"]", app_text))
    check("app.css 先于 app.js", 0 <= index_text.find("app.css") < index_text.find("app.js"))

    # ------------------------------------------------------------
    # 3. 模块语法（node 可用时）
    # ------------------------------------------------------------
    node = shutil.which("node")
    if node:
        esm_dir = TMP / "esm"
        esm_dir.mkdir(parents=True, exist_ok=True)
        syntax_errors: list[str] = []
        for name, data in sorted(manifests.items()):
            if isinstance(data.get("entries"), list):
                features = [str(e.get("feature") or "") for e in data["entries"] if isinstance(e, dict)]
            else:
                features = [str(data.get("feature") or "feature.js")]
            for idx, feature in enumerate(features, 1):
                source = PLUGINS / name / feature
                target = esm_dir / f"{name}_{idx}.mjs"
                shutil.copyfile(source, target)
                result = subprocess.run(
                    [node, "--check", str(target)],
                    capture_output=True, text=True, timeout=30,
                )
                if result.returncode != 0:
                    detail = (result.stderr or result.stdout).strip().splitlines()
                    syntax_errors.append(f"{name}/{feature}: {detail[-1] if detail else 'syntax error'}")
        check("feature.js ESM 语法", not syntax_errors, " | ".join(syntax_errors))
        result = subprocess.run(
            [node, "--check", str(APP_JS)], capture_output=True, text=True, timeout=30)
        check("app.js 语法", result.returncode == 0,
              (result.stderr or "").strip().splitlines()[-1] if result.returncode else "")
    else:
        print("SKIP node --check（未找到 node）")

    # ------------------------------------------------------------
    # 4. HTTP 契约
    # ------------------------------------------------------------
    _bootstrap_db()
    data_dir_errors = [
        f"{pid}:{name}"
        for pid, names in V2_DATA_DIRS.items()
        for name in names
        if not (TMP / "plugins" / name).is_dir()
    ]
    check("manifest data_dirs 自动创建", not data_dir_errors,
          " | ".join(data_dir_errors))
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    port = httpd.server_address[1]
    base = f"http://127.0.0.1:{port}"
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    time.sleep(0.35)

    def get(path: str):
        request = urllib.request.Request(base + path)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
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

    def put(path: str, payload=None):
        body = json.dumps(payload or {}).encode("utf-8")
        request = urllib.request.Request(
            base + path, data=body, method="PUT",
            headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.status, dict(response.headers), response.read()
        except urllib.error.HTTPError as exc:
            return exc.code, dict(exc.headers), exc.read()

    try:
        status, _, body = get("/api/plugins/list")
        data = json.loads(body.decode("utf-8")) if body else {}
        plugins = data.get("plugins") if isinstance(data, dict) else None
        check("GET /api/plugins/list", status == 200 and data.get("ok") is True,
              f"HTTP {status}")
        check("插件数量", isinstance(plugins, list) and len(plugins) == 19,
              f"{len(plugins) if isinstance(plugins, list) else 'N/A'}")
        check("插件 id 集合", isinstance(plugins, list) and
              [p.get("id") for p in plugins] == EXPECTED_PLUGIN_IDS)

        all_entries = [
            entry for plugin in (plugins or [])
            for entry in (plugin.get("entries") or [])
            if isinstance(entry, dict)
        ]
        check("entry 数量", len(all_entries) == 21, str(len(all_entries)))
        check("entry id 集合",
              sorted(e.get("id") for e in all_entries) == EXPECTED_ENTRY_IDS)
        list_field_errors: list[str] = []
        for pid in EXPECTED_V2_PLUGINS:
            if pid in BACKEND_ONLY_PLUGINS:
                continue
            item = next((p for p in (plugins or []) if p.get("id") == pid), None)
            if not isinstance(item, dict):
                list_field_errors.append(f"{pid}: 不在清单")
                continue
            if item.get("schema_version") != 2:
                list_field_errors.append(f"{pid}: schema_version")
            expected_style = f"/plugins/{pid}/plugin.css"
            if item.get("style_url") != expected_style:
                list_field_errors.append(f"{pid}: style_url")
            expected_shared = V2_SHARED_FEATURES.get(pid) or []
            if (item.get("shared_features") or []) != expected_shared:
                list_field_errors.append(f"{pid}: shared_features")
        check("v2 清单字段", not list_field_errors, " | ".join(list_field_errors[:5]))

        api_404_errors = []
        frontend_v2 = [pid for pid in EXPECTED_V2_PLUGINS if pid not in V2_BACKEND_FILES]
        for pid in frontend_v2:
            status, _, _ = get(f"/api/plugin/{pid}/health")
            if status != 404:
                api_404_errors.append(f"{pid}:{status}")
        check("无 backend 插件 API 404", not api_404_errors,
              " | ".join(api_404_errors[:5]))
        status, _, _ = get("/api/plugin/model_usage/records")
        check("model_usage 插件 API 200", status == 200, f"HTTP {status}")
        status, _, _ = get("/api/plugin/pdf/batch/scan")
        check("pdf 插件 API 非 404", status == 405, f"HTTP {status}")
        status, _, _ = get("/api/plugin/rivet/data")
        check("rivet 插件 API 200", status == 200, f"HTTP {status}")
        status, _, _ = get("/api/plugin/filejudge/scan")
        check("filejudge 插件 API 非 404", status == 405, f"HTTP {status}")
        status, _, _ = get("/api/plugin/finance/state")
        check("finance 插件 API 200", status == 200, f"HTTP {status}")
        status, _, _ = get("/api/plugin/pixel_art/works")
        check("pixel_art 插件 API 200", status == 200, f"HTTP {status}")

        for path in ("/api/model-usage", "/api/pixel/works", "/api/godot/scan"):
            status, _, _ = get(path)
            check("旧路由 404 " + path, status == 404, f"HTTP {status}")
        status, _, body = post("/api/godot/scan", {"path": "C:/missing"})
        check("旧 Godot POST 404", status == 404, f"HTTP {status}")
        status, _, _ = post("/api/godot/export", {"path": "C:/missing"})
        check("旧 Godot export POST 404", status == 404, f"HTTP {status}")
        status, _, _ = post("/api/pixel/works", {
            "name": "legacy", "width": 1, "height": 1, "palette": [], "pixels": [-1]})
        check("旧 pixel POST 404", status == 404, f"HTTP {status}")

        status, _, body = post("/api/plugin/pixel_art/works", {
            "name": "smoke pixel art", "width": 1, "height": 1,
            "palette": [], "pixels": [-1],
        })
        artwork = json.loads(body.decode("utf-8")) if body else {}
        artwork_id = (artwork.get("work") or {}).get("artwork_id")
        check("pixel_art 插件作品保存", status == 200 and bool(artwork_id),
              f"HTTP {status}")
        if artwork_id:
            status, _, _ = put("/api/plugin/pixel_art/refs/bookmark", {"artwork_id": artwork_id})
            check("pixel_art 资产引用绑定", status == 200, f"HTTP {status}")
        status, _, body = get("/api/plugin/book_reader/reader/assets")
        asset_payload = json.loads(body.decode("utf-8")) if body else {}
        check("reader assets 契约保留",
              status == 200 and isinstance(asset_payload.get("refs"), dict)
              and isinstance(asset_payload.get("assets"), dict)
              and isinstance(asset_payload.get("keys"), list)
              and (not artwork_id or asset_payload.get("assets", {}).get("bookmark", {}).get("artwork_id") == artwork_id),
              f"HTTP {status}")
        if artwork_id:
            request = urllib.request.Request(base + "/api/plugin/pixel_art/works/" + artwork_id,
                                             data=b"{}", method="DELETE",
                                             headers={"Content-Type": "application/json"})
            try:
                with urllib.request.urlopen(request, timeout=30) as response:
                    status = response.status
            except urllib.error.HTTPError as exc:
                status = exc.code
            check("pixel_art 插件作品删除", status == 200, f"HTTP {status}")
        singles = [
            (plugin, entry) for plugin in (plugins or [])
            for entry in (plugin.get("entries") or [])
            if len(plugin.get("entries") or []) == 1
        ]
        check("单入口 entry 17 个", len(singles) == 17, str(len(singles)))
        check("单入口 entry.plugin_id == plugin.id",
              all(entry.get("plugin_id") == plugin.get("id") for plugin, entry in singles))
        pdf_plugin = next((p for p in (plugins or []) if p.get("id") == "pdf"), None)
        check("pdf entries 为 pdf/batch",
              isinstance(pdf_plugin, dict)
              and [e.get("id") for e in (pdf_plugin.get("entries") or [])] == ["pdf", "batch"])
        check("卡片总数 21", isinstance(plugins, list) and
              len(builtin_ids) + len(all_entries) == 21,
              f"{len(builtin_ids)}+{len(all_entries)}")

        field_errors: list[str] = []
        if isinstance(plugins, list):
            for plugin in plugins:
                pid = plugin.get("id") or "?"
                for key in ("name", "icon"):
                    if not isinstance(plugin.get(key), str) or not plugin.get(key):
                        field_errors.append(f"{pid}.{key}")
                entries = plugin.get("entries")
                if not isinstance(entries, list) or not entries:
                    field_errors.append(f"{pid}.entries 为空")
                    continue
                for entry in entries:
                    eid = entry.get("id") or "?"
                    for key in ("id", "plugin_id", "name", "icon", "shelf",
                                "feature", "feature_url"):
                        if not isinstance(entry.get(key), str):
                            field_errors.append(f"{pid}.{eid}.{key}")
                    if entry.get("plugin_id") != pid:
                        field_errors.append(f"{pid}.{eid}.plugin_id")
                    if len(entries) > 1 and pid not in ("pdf", "finance"):
                        field_errors.append(f"{pid}: 多入口仅支持 pdf/finance")
                    expected_url = f"/plugins/{pid}/{entry.get('feature') or ''}"
                    if entry.get("feature_url") != expected_url:
                        field_errors.append(f"{pid}.{eid}.feature_url")
                    feature = entry.get("feature") or ""
                    source = (PLUGINS / pid / feature)
                    if not feature or not source.is_file():
                        field_errors.append(f"{pid}.{eid}.feature 文件不存在")
                        continue
                    text = source.read_text(encoding="utf-8", errors="replace")
                    if not re.search(
                        r"__toolRenderers\s*(?:\.\s*" + re.escape(eid) +
                        r"\b|\[\s*['\"]" + re.escape(eid) + r"['\"]\s*\])", text):
                        field_errors.append(f"{pid}.{eid}.renderer 未注册")
                if pid in PLUGINS_WITH_BACKEND and plugin.get("backend") != "backend.py":
                    field_errors.append(f"{pid}.backend")
        check("插件清单字段", not field_errors, " | ".join(field_errors[:6]))

        if isinstance(all_entries, list):
            for entry in all_entries:
                pid = entry.get("plugin_id") or "?"
                eid = entry.get("id") or "?"
                status, headers, body = get(entry["feature_url"])
                lower = {k.lower(): v for k, v in headers.items()}
                source = (PLUGINS / pid / entry["feature"]).read_bytes()
                check(f"插件静态资源 {pid}/{eid}",
                      status == 200
                      and "javascript" in lower.get("content-type", "")
                      and body == source
                      and lower.get("cache-control") == "no-cache",
                      f"HTTP {status} / {len(body)}B")

        styled_plugins = [p for p in (plugins or []) if p.get("style_url")]
        styled_expected = [pid for pid in EXPECTED_V2_PLUGINS if pid not in BACKEND_ONLY_PLUGINS]
        check("带样式插件为 19 个 v2 样本",
              [p.get("id") for p in styled_plugins] == styled_expected,
              ", ".join(str(p.get("id")) for p in styled_plugins))
        for plugin in styled_plugins:
            pid = plugin["id"]
            style_rel = str((manifests.get(pid) or {}).get("style") or "")
            status, headers, body = get(plugin["style_url"])
            lower = {k.lower(): v for k, v in headers.items()}
            source = (PLUGINS / pid / style_rel).read_bytes() if style_rel else b""
            check(f"插件样式资源 {pid}",
                  status == 200
                  and "css" in lower.get("content-type", "")
                  and body == source
                  and lower.get("cache-control") == "no-cache",
                  f"HTTP {status} / {len(body)}B")

        status, _, body = get("/plugins/sim/not-found.js")
        check("缺失插件资源 404", status == 404, f"HTTP {status}")

        traversal_paths = (
            "/plugins/%2e%2e/server.py",
            "/plugins/sim/%2e%2e/%2e%2e/server.py",
            "/plugins/..%5Cserver.py",
        )
        for path in traversal_paths:
            status, _, body = get(path)
            check("插件穿越拒绝 " + path, status in (403, 404) and b"class Handler" not in body,
                  f"HTTP {status}")

        # ---- rivet backend（P3 批 1） ----
        # 前面的清单 API 已触发默认 rivet.json；清掉以模拟首次迁移。
        (TMP / "plugins" / "rivet" / "rivet.json").unlink(missing_ok=True)
        legacy = TMP / "rivet.json"
        legacy.write_text(json.dumps({
            "habits": [{
                "id": "h1", "name": "测试铆钉", "icon": "🔩", "color": "#4e8cff",
                "mode": "daily", "weekly_target": 0, "days": [], "difficulty": "tiny",
                "note": "", "created": "2026-10-28", "shield": 0, "xp": 0, "records": {},
            }]
        }, ensure_ascii=False, indent=1), encoding="utf-8")

        status, _, body = post("/api/plugin/rivet/data", {})
        rivet_data = json.loads(body.decode("utf-8")) if body else {}
        check("rivet /api/plugin/rivet/data", status == 200 and rivet_data.get("ok") is True,
              f"HTTP {status}")
        check("rivet data 返回习惯", len(rivet_data.get("habits") or []) == 1)

        rivet_new = TMP / "plugins" / "rivet" / "rivet.json"
        check("rivet 首次迁移到 data/plugins/rivet",
              rivet_new.is_file()
              and rivet_new.read_text(encoding="utf-8") == legacy.read_text(encoding="utf-8"))
        check("rivet 旧 data/rivet.json 保留", legacy.is_file())

        status, _, _ = post("/api/plugin/rivet/checkin", {"id": "h1"})
        check("rivet checkin", status == 200)
        status, _, body = post("/api/plugin/rivet/checkin", {"id": "h1"})
        undone = json.loads(body.decode("utf-8")) if body else {}
        check("rivet checkin 撤销", status == 200 and undone.get("undone") is True)

        status, _, _ = get("/api/rivet/data")
        check("旧 /api/rivet 路由 404", status == 404, f"HTTP {status}")
        status, _, _ = get("/api/plugin/rivet/checkin")
        check("rivet 不支持的方法返回 405", status == 405, f"HTTP {status}")
        status, _, _ = get("/plugins/rivet/backend.py")
        check("backend.py 不经静态路由暴露", status == 404, f"HTTP {status}")

        # ---- filejudge backend（P3 批 2） ----
        fj_dir = TMP / "fj"
        fj_dir.mkdir(parents=True, exist_ok=True)
        fj_a = fj_dir / "a.txt"
        fj_b = fj_dir / "b.txt"
        fj_a.write_text("hello", encoding="utf-8")
        fj_b.write_text("bye", encoding="utf-8")
        legacy_keep = TMP / "filejudge_keep.json"
        legacy_keep.write_text(json.dumps({"paths": []}), encoding="utf-8")

        status, _, body = post("/api/plugin/filejudge/scan", {
            "path": str(fj_dir), "types": ["txt"], "size_kb": -1, "cmp": "gt"})
        fj_scan = json.loads(body.decode("utf-8")) if body else {}
        check("filejudge /api/plugin/filejudge/scan",
              status == 200 and fj_scan.get("ok") is True and fj_scan.get("count") == 2,
              f"HTTP {status} count={fj_scan.get('count')}")

        status, _, body = post("/api/plugin/filejudge/preview", {"path": str(fj_a)})
        fj_preview = json.loads(body.decode("utf-8")) if body else {}
        check("filejudge preview",
              status == 200 and fj_preview.get("ok") is True
              and fj_preview.get("kind") == "text" and "hello" in (fj_preview.get("text") or ""))

        status, _, body = post("/api/plugin/filejudge/keep", {"path": str(fj_a)})
        fj_keep = json.loads(body.decode("utf-8")) if body else {}
        fj_new_keep = TMP / "plugins" / "filejudge" / "keep.json"
        check("filejudge keep 写入",
              status == 200 and fj_keep.get("ok") is True and fj_new_keep.is_file())
        check("filejudge 首次迁移 keep.json", legacy_keep.is_file())

        status, _, body = post("/api/plugin/filejudge/scan", {
            "path": str(fj_dir), "types": ["txt"], "size_kb": -1, "cmp": "gt"})
        fj_scan2 = json.loads(body.decode("utf-8")) if body else {}
        check("filejudge 保留后扫描跳过",
              status == 200 and fj_scan2.get("count") == 1 and fj_scan2.get("skipped") == 1,
              f"count={fj_scan2.get('count')} skipped={fj_scan2.get('skipped')}")

        status, _, body = post("/api/plugin/filejudge/delete", {"paths": [str(fj_b)]})
        fj_del = json.loads(body.decode("utf-8")) if body else {}
        check("filejudge delete",
              status == 200 and fj_del.get("count") == 1 and not fj_b.exists())

        status, _, body = post("/api/plugin/filejudge/tree", {"path": str(fj_dir)})
        fj_tree = json.loads(body.decode("utf-8")) if body else {}
        check("filejudge tree", status == 200 and fj_tree.get("ok") is True)

        status, _, _ = post("/api/filejudge/scan", {"path": str(fj_dir)})
        check("旧 /api/filejudge 路由 404", status == 404, f"HTTP {status}")
        status, _, _ = get("/api/plugin/filejudge/scan")
        check("filejudge 不支持的方法返回 405", status == 405, f"HTTP {status}")
        status, _, _ = get("/plugins/filejudge/backend.py")
        check("filejudge backend.py 不暴露", status == 404, f"HTTP {status}")

        # ---- pdf/batch 多入口插件（P4 批 1） ----
        pdf_dir = TMP / "pdf"
        pdf_dir.mkdir(parents=True, exist_ok=True)
        (pdf_dir / "dummy.pdf").write_bytes(b"%PDF-1.4\n%%EOF\n")
        status, _, body = post("/api/plugin/pdf/batch/scan", {
            "path": str(pdf_dir), "min_kb": 0})
        pdf_scan = json.loads(body.decode("utf-8")) if body else {}
        check("pdf batch/scan 不依赖可选库",
              status == 200 and pdf_scan.get("ok") is True
              and pdf_scan.get("count") == 1,
              f"HTTP {status} count={pdf_scan.get('count')}")

        status, _, body = post("/api/plugin/pdf/pdf/merge", {"files": []})
        pdf_merge = json.loads(body.decode("utf-8")) if body else {}
        check("pdf merge 错误不冒泡",
              status in (400, 500)
              and (status == 400 or pdf_merge.get("error") == "missing_dependency"),
              f"HTTP {status} error={pdf_merge.get('error')}")
        status, _, _ = post("/api/pdf/merge", {"files": []})
        check("旧 /api/pdf 路由 404", status == 404, f"HTTP {status}")
        status, _, _ = post("/api/batch/scan", {"path": str(pdf_dir)})
        check("旧 /api/batch 路由 404", status == 404, f"HTTP {status}")
        status, _, _ = get("/api/plugin/pdf/batch/scan")
        check("pdf 不支持的方法返回 405", status == 405, f"HTTP {status}")
        status, _, _ = get("/plugins/pdf/backend.py")
        check("pdf backend.py 不暴露", status == 404, f"HTTP {status}")

        # --------------------------------------------------------
        # 5. 扫描容错（临时插件根）
        # --------------------------------------------------------
        fake_root = TMP / "fake_plugins"
        fake_root.mkdir(parents=True, exist_ok=True)

        def write_plugin(dirname: str, payload: dict | None, feature: str | None) -> None:
            target = fake_root / dirname
            target.mkdir(parents=True, exist_ok=True)
            if payload is not None:
                (target / "manifest.json").write_text(
                    json.dumps(payload, ensure_ascii=False), encoding="utf-8")
            if feature is not None:
                (target / "feature.js").write_text(feature, encoding="utf-8")

        def manifest(pid: str, **overrides) -> dict:
            payload = {
                "id": pid, "name": pid, "icon": "P", "desc": "", "shelf": "gen",
                "feature": "feature.js", "enabled": True, "version": "1.0",
                "provides": [], "consumes": [],
            }
            payload.update(overrides)
            return payload

        def manifest_v2(pid: str, **overrides) -> dict:
            payload = {
                "schema_version": 2, "id": pid, "name": pid, "version": "1.0",
                "enabled": True, "icon": "P", "desc": "",
                "entries": [{
                    "id": pid, "name": pid, "icon": "P", "desc": "",
                    "shelf": "gen", "feature": "feature.js",
                }],
                "backend": None, "db": None, "provides": [], "consumes": [],
            }
            payload.update(overrides)
            return payload

        fake_feature = "window.__toolRenderers.good = () => {};"
        write_plugin("good", manifest("good"), fake_feature)
        write_plugin("v2good", manifest_v2("v2good"), fake_feature)
        write_plugin("v2empty", manifest_v2("v2empty", entries=[]), fake_feature)
        v2_no_entries = manifest_v2("v2noentries")
        v2_no_entries.pop("entries")
        v2_no_entries.update({"desc": "", "shelf": "gen", "feature": "feature.js"})
        write_plugin("v2noentries", v2_no_entries, fake_feature)
        write_plugin("off", manifest("off", enabled=False), fake_feature)
        write_plugin("mismatch", manifest("other"), fake_feature)
        write_plugin("nofeature", manifest("nofeature", feature="missing.js"), fake_feature)
        write_plugin("escape", manifest("escape", feature="../outside.js"), fake_feature)
        write_plugin("absolute", manifest("absolute", feature="/server.py"), fake_feature)
        write_plugin("noname", manifest("noname", name=""), fake_feature)
        write_plugin("badbackend", manifest("badbackend", backend="missing.py"), fake_feature)
        write_plugin("badstyle", manifest("badstyle", style="missing.css"), fake_feature)
        write_plugin("escape_style", manifest("escape_style", style="../outside.css"), fake_feature)
        write_plugin("badjson", None, fake_feature)
        (fake_root / "badjson" / "manifest.json").write_text("{not json", encoding="utf-8")
        (fake_root / "outside.js").write_text(fake_feature, encoding="utf-8")
        (fake_root / "outside.css").write_text(".x{}", encoding="utf-8")
        write_plugin("no_manifest", None, fake_feature)
        write_plugin("manifest_list", None, fake_feature)
        (fake_root / "manifest_list" / "manifest.json").write_text("[]", encoding="utf-8")

        old_plugins_dir = srv.PLUGINS_DIR
        try:
            srv.PLUGINS_DIR = fake_root
            listed = srv._plugin_list()
            check("扫描跳过无效清单", [p["id"] for p in listed] == ["good", "v2good"],
                  " | ".join(p["id"] for p in listed))
            v2_listed = next((p for p in listed if p["id"] == "v2good"), {})
            check("扫描接受 v2 manifest",
                  v2_listed.get("schema_version") == 2
                  and v2_listed.get("entries", [{}])[0].get("id") == "v2good")
            status, _, body = get("/api/plugins/list")
            fake_data = json.loads(body.decode("utf-8")) if body else {}
            check("扫描接口只返回有效插件",
                  status == 200
                  and [p["id"] for p in fake_data.get("plugins", [])] == ["good", "v2good"])
            status, _, body = get("/plugins/good/feature.js")
            check("扫描后静态映射仍可用",
                  status == 200 and body.decode("utf-8") == fake_feature, f"HTTP {status}")

            write_plugin("boom", manifest("boom", backend="backend.py"), fake_feature)
            (fake_root / "boom" / "backend.py").write_text(
                "def handle(method, subpath, query, body):\n"
                "    raise RuntimeError('boom')\n",
                encoding="utf-8",
            )
            status, _, body = get("/api/plugin/boom/data")
            boom = json.loads(body.decode("utf-8")) if body else {}
            check("backend 异常不冒泡", status == 500 and boom.get("error") == "plugin_error",
                  f"HTTP {status}")
            status, _, _ = get("/api/plugin/off/data")
            check("enabled=false 的 backend 不加载", status == 404, f"HTTP {status}")
        finally:
            srv.PLUGINS_DIR = old_plugins_dir

        status, _, body = get("/api/plugins/list")
        restored = json.loads(body.decode("utf-8")) if body else {}
        check("恢复真实插件根",
              status == 200 and len(restored.get("plugins", [])) == 19,
              f"{len(restored.get('plugins', []))} 个")
    finally:
        httpd.shutdown()

    # ------------------------------------------------------------
    # 6. CSS 自包含：专属样式在 plugin.css，共享样式留在 app.css
    # ------------------------------------------------------------
    css_lines = APP_CSS.read_text(encoding="utf-8").splitlines()
    css_bytes = APP_CSS.stat().st_size

    migrated_leftovers: list[str] = []
    for pid, prefixes in MIGRATED_CSS_PREFIXES.items():
        for prefix in prefixes:
            hits = [
                line for line in css_lines
                if css_line_matches(line, prefix)
                and not any(css_line_matches(line, shared) for shared in SHARED_CSS_SELECTORS)
            ]
            if hits:
                migrated_leftovers.append(f"{pid}:{prefix}({len(hits)})")
    for exact in MIGRATED_CSS_EXACT:
        if any(line.lstrip().startswith(exact) for line in css_lines):
            migrated_leftovers.append(f"exact:{exact}")
    check("迁移插件样式已离开 app.css", not migrated_leftovers,
          " | ".join(migrated_leftovers[:6]))

    shared_missing = [
        selector for selector in SHARED_CSS_SELECTORS
        if not any(css_line_matches(line, selector) for line in css_lines)
    ]
    check("共享样式保留在 app.css", not shared_missing, " | ".join(shared_missing))

    plugin_css_paths = {p.resolve() for p in PLUGINS.rglob("*.css")}
    style_diff = sorted(
        str(p.relative_to(ROOT)) for p in (plugin_css_paths ^ declared_style_paths))
    check("插件 CSS 与 manifest.style 一致", plugin_css_paths == declared_style_paths,
          " | ".join(style_diff))
    check("manifest 无 css 字段", not any("css" in data for data in manifests.values()))

    anchor_errors: list[str] = []
    for pid, anchors in PLUGIN_CSS_ANCHORS.items():
        css_file = PLUGINS / pid / "plugin.css"
        source_lines = (css_file.read_text(encoding="utf-8").splitlines()
                        if css_file.is_file() else [])
        for anchor in anchors:
            if not any(css_line_matches(line, anchor) for line in source_lines):
                anchor_errors.append(f"{pid}:{anchor}")
    check("插件 CSS 锚点在 plugin.css", not anchor_errors, " | ".join(anchor_errors))

    rv_lines = [line for line in css_lines if line.lstrip().startswith(".rv-card")]
    rv_bytes = sum(len(line.encode("utf-8")) for line in rv_lines)
    plugin_css_bytes = sum(p.stat().st_size for p in plugin_css_paths)
    check("index.html 只引 app.css", index_text.count('rel="stylesheet"') == 1
          and "app.css" in index_text)

    print(
        f"CSS 审计：app.css {len(css_lines)} 行 / {css_bytes}B；"
        f"插件 CSS {len(plugin_css_paths)} 个 / {plugin_css_bytes}B；"
        f"共享 .rv-card {len(rv_lines)} 行 / {rv_bytes}B"
    )
    for pid in EXPECTED_V2_PLUGINS:
        css_file = PLUGINS / pid / "plugin.css"
        if css_file.is_file():
            raw = css_file.read_text(encoding="utf-8").splitlines()
            print(f"  {pid}: {len(raw)} 行 / {css_file.stat().st_size}B")

    print(f"\nRESULT: {ok.count(True)}/{len(ok)} PASS")
    return 0 if all(ok) else 1


if __name__ == "__main__":
    raise SystemExit(main())
