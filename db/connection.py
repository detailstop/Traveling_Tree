"""
数据库连接与初始化。

职责：
  1. 提供线程本地连接 get_conn()（每个线程一个连接，线程安全；只连接/PRAGMA）
  2. init_db() 由启动入口显式调用一次：执行 plugins/*/schema.sql（manifest.db 声明）+
     插件迁移 + seed 回调。db/schema/ 已无任何宿主 DDL。
  3. 统一 row_factory，使查询返回可按下标/键访问的 Row

扩展点：
  - 若迁移到 Postgres/MySQL，只需重写本模块，上层无感知。
  - 核心/内置模块 schema 已清零；插件 schema 在 plugins/<id>/schema.sql，
    由对应 manifest 的 db 字段声明，本模块不硬编码插件表名或模块键。
  - 插件旧库迁移可通过 manifest.db.migrate 声明；加载后调用 migrate(conn)。
  - 模块自有迁移通过 register_module_ddl(name, ddl=None, migrate_fn=...) 登记；
    seed 通过 register_seed_callback(name, fn) 登记，db 不反向依赖 modules。
"""

import importlib.util
import json
import re
import sqlite3
import threading
from pathlib import Path

import config

_local = threading.local()
_initialized = False
_SCHEMA_DIR = Path(__file__).parent / "schema"
_CORE_SCHEMA_FILES: tuple[tuple[str, str], ...] = ()
_MODULE_KEY_RE = re.compile(r"^[a-z][a-z0-9_-]{0,31}$")
_CREATE_TABLE_RE = re.compile(
    r"(?im)^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[\"']?([A-Za-z_][A-Za-z0-9_]*)")
# 由 schema SQL 的 CREATE TABLE 解析出的 表名 -> 模块键 映射；不硬编码插件表。
_TABLE_MODULES: dict[str, str] = {}

# 模块级 DDL/迁移登记表。ddl 本轮仅作元数据；migrate_fn 在 schema 后执行，
# 供 finance 等模块使用。
_MODULE_DDL: dict[str, dict] = {}
# seed 回调登记表。回调签名 (conn) -> None；由入口 import 模块时注册。
_SEED_CALLBACKS: dict[str, dict] = {}


def _plugin_asset(base: Path, rel, suffix: str) -> Path | None:
    """解析插件目录内的相对资源；拒绝绝对路径/..，后缀不符或不存在返回 None。"""
    if not isinstance(rel, str):
        return None
    text = rel.strip().replace("\\", "/")
    if not text or text.startswith("/") or ".." in Path(text).parts:
        return None
    path = (base / text).resolve()
    try:
        path.relative_to(base.resolve())
    except ValueError:
        return None
    if path.suffix.lower() != suffix or not path.is_file():
        return None
    return path


def _plugin_schema_specs() -> list[dict]:
    """扫描 plugins/*/manifest.json 的 db 字段；返回可执行的插件 schema 列表。"""
    root = (Path(config.BASE_DIR) / "plugins").resolve()
    if not root.is_dir():
        return []
    specs: list[dict] = []
    for directory in sorted(root.iterdir(), key=lambda p: p.name.lower()):
        if not directory.is_dir():
            continue
        try:
            data = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if not isinstance(data, dict) or data.get("enabled") is False:
            continue
        pid = str(data.get("id") or "").strip()
        if not pid or pid != directory.name:
            continue
        raw = data.get("db")
        if raw is None:
            continue
        if isinstance(raw, str):
            module_key, schema_rel, migrate_rel = pid, raw, None
        elif isinstance(raw, dict):
            module_key = str(raw.get("module_key") or pid).strip()
            schema_rel = raw.get("schema")
            migrate_rel = raw.get("migrate")
        else:
            continue
        if not _MODULE_KEY_RE.fullmatch(module_key):
            continue
        schema_path = _plugin_asset(directory, schema_rel, ".sql")
        if schema_path is None:
            continue
        migrate_path = None
        if migrate_rel is not None:
            migrate_path = _plugin_asset(directory, migrate_rel, ".py")
            if migrate_path is None:
                continue
        seed_path = None
        seed_rel = raw.get("seed")
        if seed_rel is not None:
            seed_path = _plugin_asset(directory, seed_rel, ".py")
            if seed_path is None:
                continue
        specs.append({
            "plugin": pid,
            "module_key": module_key,
            "schema_path": schema_path,
            "migrate_path": migrate_path,
            "seed_path": seed_path,
        })
    return specs


def _schema_tables(text: str) -> list[str]:
    """从 schema SQL 中提取 CREATE TABLE 表名。"""
    return _CREATE_TABLE_RE.findall(text)


def _refresh_table_modules(specs: list[dict] | None = None) -> None:
    """重建 表名 -> 模块键 映射：核心 schema + 插件 schema。"""
    mapping: dict[str, str] = {}
    for module, filename in _CORE_SCHEMA_FILES:
        try:
            text = (_SCHEMA_DIR / filename).read_text(encoding="utf-8")
        except OSError:
            continue
        for table in _schema_tables(text):
            mapping.setdefault(table, module)
    for spec in (specs if specs is not None else _plugin_schema_specs()):
        try:
            text = spec["schema_path"].read_text(encoding="utf-8")
        except OSError:
            continue
        for table in _schema_tables(text):
            mapping.setdefault(table, spec["module_key"])
    _TABLE_MODULES.clear()
    _TABLE_MODULES.update(mapping)


class ModuleDisabledError(RuntimeError):
    """模块未启用或对应表不存在；由 Web 层转换为结构化 JSON。"""

    def __init__(self, module: str, table: str, message: str | None = None):
        self.module = module
        self.table = table
        self.message = message or f"模块 {module} 未启用或表不存在（{table}）"
        super().__init__(self.message)


def _module_for_table(table: str) -> str:
    if not _TABLE_MODULES:
        _refresh_table_modules()
    return _TABLE_MODULES.get(table, "core")


def _translate_missing_table(exc: sqlite3.OperationalError) -> Exception:
    text = str(exc)
    marker = "no such table:"
    if marker not in text:
        return exc
    table = text.split(marker, 1)[1].strip().split()[0]
    table = table.rsplit(".", 1)[-1]
    return ModuleDisabledError(_module_for_table(table), table)


class _GuardedConnection(sqlite3.Connection):
    """所有经 get_conn() 的 SQL 统一把 no such table 转为结构化异常。"""

    def execute(self, sql, parameters=()):
        try:
            return super().execute(sql, parameters)
        except sqlite3.OperationalError as exc:
            translated = _translate_missing_table(exc)
            if translated is exc:
                raise
            raise translated from exc

    def executemany(self, sql, seq_of_parameters):
        try:
            return super().executemany(sql, seq_of_parameters)
        except sqlite3.OperationalError as exc:
            translated = _translate_missing_table(exc)
            if translated is exc:
                raise
            raise translated from exc

    def executescript(self, sql_script):
        try:
            return super().executescript(sql_script)
        except sqlite3.OperationalError as exc:
            translated = _translate_missing_table(exc)
            if translated is exc:
                raise
            raise translated from exc


def _settings_modules() -> dict:
    """读取 settings.modules.enabled；缺失模块默认 true，避免阻断旧库启动。"""
    path = Path(config.DATA_DIR) / "settings.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        data = {}
    modules = data.get("modules") if isinstance(data, dict) else None
    enabled = modules.get("enabled") if isinstance(modules, dict) else None
    return enabled if isinstance(enabled, dict) else {}


def _module_enabled(name: str) -> bool:
    settings = _settings_modules()
    return settings.get(name, True) is not False


def register_module_ddl(name: str, ddl: str | None = None,
                        migrate_fn=None) -> None:
    """登记模块级迁移入口；不做建表，ddl 仅作迁移元数据。"""
    key = str(name or "").strip()
    if not key:
        raise ValueError("register_module_ddl 需要非空 name")
    if migrate_fn is not None and not callable(migrate_fn):
        raise TypeError("migrate_fn 必须可调用")
    _MODULE_DDL[key] = {"ddl": ddl, "migrate_fn": migrate_fn}


def register_seed_callback(name: str, fn, module: str | None = None) -> None:
    """登记 seed 回调；module 用于在模块禁用时跳过回调。"""
    key = str(name or "").strip()
    if not key:
        raise ValueError("register_seed_callback 需要非空 name")
    if not callable(fn):
        raise TypeError("seed 回调必须可调用")
    _SEED_CALLBACKS[key] = {"fn": fn, "module": module}


def get_conn() -> sqlite3.Connection:
    """返回当前线程的 SQLite 连接；只连接并设置 PRAGMA，不再跑 schema/迁移。"""
    path = str(config.DB_PATH)
    conn = getattr(_local, "conn", None)
    if conn is not None and getattr(_local, "conn_path", None) != path:
        # 测试/嵌入式场景会切换 DB_PATH；旧连接必须关闭，避免读写错库。
        try:
            conn.close()
        except Exception:  # noqa: BLE001
            pass
        conn = None
    if conn is None:
        conn = sqlite3.connect(config.DB_PATH, factory=_GuardedConnection)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        _local.conn = conn
        _local.conn_path = path
    return conn


def init_db(force: bool = False) -> bool:
    """进程内显式初始化一次：核心/插件 schema + 兼容补丁 + 模块迁移 + seed。

    返回值：本次是否真正执行。服务启动/CLI 入口在开始处理请求前调用；
    普通 get_conn() 只连接，不再重复 DDL/迁移。失败时抛 RuntimeError，
    由入口打印可读原因并退出，不开始监听。
    """
    global _initialized
    if _initialized and not force:
        return False
    if force:
        _initialized = False
    fresh = not Path(config.DB_PATH).exists()
    conn = sqlite3.connect(config.DB_PATH)
    conn.row_factory = sqlite3.Row
    specs: list[dict] = []
    try:
        conn.execute("PRAGMA foreign_keys = ON")
        specs = _init_schema(conn) or []
        conn.commit()
    except Exception as exc:  # noqa: BLE001
        conn.rollback()
        raise RuntimeError(f"数据库初始化失败：{exc}") from exc
    finally:
        conn.close()
    if fresh:
        try:
            _run_plugin_seeds(specs)
        except Exception as exc:  # noqa: BLE001
            raise RuntimeError(f"插件种子导入失败：{exc}") from exc
    _initialized = True
    return True


def _init_schema(conn: sqlite3.Connection) -> list[dict]:
    """核心 schema + manifest 插件 schema + 兼容补丁/迁移；返回插件 specs。"""
    specs = _plugin_schema_specs()
    _refresh_table_modules(specs)
    for name, filename in _CORE_SCHEMA_FILES:
        if _module_enabled(name):
            conn.executescript((_SCHEMA_DIR / filename).read_text(encoding="utf-8"))
    for spec in specs:
        if _module_enabled(spec["module_key"]):
            conn.executescript(spec["schema_path"].read_text(encoding="utf-8"))
    _migrate(conn)
    _run_plugin_migrations(conn, specs)
    _run_module_migrations(conn)
    _run_seed_callbacks(conn)
    conn.commit()
    return specs


def _run_plugin_migrations(conn: sqlite3.Connection, specs: list[dict]) -> None:
    """执行 manifest.db.migrate 声明的插件迁移（模块关闭时跳过）。"""
    for spec in specs:
        path = spec.get("migrate_path")
        if path is None or not _module_enabled(spec["module_key"]):
            continue
        module_spec = importlib.util.spec_from_file_location(
            f"rt_plugin_migrate_{spec['module_key']}", path)
        if module_spec is None or module_spec.loader is None:
            raise RuntimeError(f"插件迁移加载失败：{path}")
        module = importlib.util.module_from_spec(module_spec)
        module_spec.loader.exec_module(module)
        migrate = getattr(module, "migrate", None)
        if not callable(migrate):
            raise RuntimeError(f"插件迁移缺少 migrate(conn)：{path}")
        migrate(conn)


def _run_plugin_seeds(specs: list[dict]) -> None:
    """全新数据库首次初始化后，执行 manifest.db.seed 声明的插件种子。"""
    for spec in specs:
        path = spec.get("seed_path")
        if path is None or not _module_enabled(spec["module_key"]):
            continue
        module_spec = importlib.util.spec_from_file_location(
            f"rt_plugin_seed_{spec['module_key']}", path)
        if module_spec is None or module_spec.loader is None:
            raise RuntimeError(f"插件 seed 加载失败：{path}")
        module = importlib.util.module_from_spec(module_spec)
        module_spec.loader.exec_module(module)
        seed_fn = getattr(module, "load_seed", None) or getattr(module, "seed", None)
        if not callable(seed_fn):
            raise RuntimeError(f"插件 seed 缺少 load_seed()/seed()：{path}")
        seed_fn()


def _run_module_migrations(conn: sqlite3.Connection) -> None:
    for name, spec in _MODULE_DDL.items():
        if not _module_enabled(name):
            continue
        fn = spec.get("migrate_fn")
        if callable(fn):
            fn(conn)


def _run_seed_callbacks(conn: sqlite3.Connection) -> None:
    for spec in _SEED_CALLBACKS.values():
        module = spec.get("module")
        if module and not _module_enabled(module):
            continue
        fn = spec.get("fn")
        if callable(fn):
            fn(conn)


def _migrate(conn: sqlite3.Connection) -> None:
    """兼容钩子：核心/插件迁移已分别迁出；保留给测试/后续模块注入。"""
    conn.commit()


def finance_migrate(conn: sqlite3.Connection) -> None:
    """finance_* 数据兼容补丁；本轮表结构为全新，无需补列/回填。"""
    return None


# finance_* 的建表仍由 plugins/finance/schema.sql 唯一负责；此处只登记数据迁移入口。
register_module_ddl("finance", migrate_fn=finance_migrate)
