"""插件依赖检测（只读）：读取各插件 `manifest.dependencies`，判断本机是否满足。

字段契约（manifest v2 扩展）：

    "dependencies": {
      "python": ["pikepdf", {"name": "edge-tts", "version": ">=6.1.0"}],
      "shared": ["webchat"],      // 宿主公共前端脚本，与 manifest.shared_features 同义
      "plugins": ["pixel_art"]    // 其他插件 plugins/<id>/manifest.json
    }

约定：
- 三类子键均可省略；每项为字符串，`python` 另可用 `{name, version}` 对象写版本约束。
- `shared` 的规则来源：宿主 `ui/web/static/app.js::loadToolFeature()`
  （`new URL('features/' + file + '.js', APP_ASSET_BASE)`，APP_ASSET_BASE = `/static/`），
  即脚本实际路径为 `ui/web/static/features/<name>.js`；`manifest.shared_features` 用的就是这条规则。
  旧子键 `js` 已废弃（零存量），按未知子键报错。
- 只检测、不安装、不写文件、不写库；缺失只提示，不阻断安装/启用/加载。
- 存在性：PyPI 包用 `importlib.metadata`（拿版本），失败再退回 `importlib.util.find_spec`
  （兼容以单文件/本地方式安装的模块）。
- 版本比较依赖第三方 `packaging`；缺失时降级为“只判存在性”，返回 `degraded: true`。
- 冲突：同一库被多个插件声明且约束区间无交集时标记 `conflict`；多版本隔离不在本轮实现。
"""
from __future__ import annotations

import importlib.util
import json
import re
from datetime import datetime, timezone
from functools import lru_cache
from importlib import metadata as importlib_metadata
from pathlib import Path

import config

try:  # 仅用于版本解析；缺失时降级
    from packaging.specifiers import SpecifierSet
    from packaging.version import InvalidVersion, Version
    HAVE_PACKAGING = True
except Exception:  # noqa: BLE001 - 环境无 packaging 时只判存在性
    SpecifierSet = None  # type: ignore[assignment]
    Version = None  # type: ignore[assignment]
    InvalidVersion = Exception  # type: ignore[assignment,misc]
    HAVE_PACKAGING = False

DEGRADED_HINT = "版本检测不可用（未安装 packaging），仅检测存在性；请安装 packaging 以检测版本"
STATUS_TEXT = {
    "ok": "满足",
    "missing": "缺失",
    "version_mismatch": "版本不满足",
    "conflict": "冲突",
    "unknown": "无法判断",
    "undeclared": "未声明",
}
_STATUS_RANK = {"missing": 5, "conflict": 4, "version_mismatch": 3, "unknown": 2, "ok": 1,
                "undeclared": 0}
KINDS = ("python", "shared", "plugins")

_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
_PLUGIN_RE = re.compile(r"^[a-z][a-z0-9_-]{1,31}$")
_SPEC_ITEM_RE = re.compile(r"^(==|!=|>=|<=|>|<|~=)\s*v?\d+(?:\.\d+)*(?:\.\*)?$")
_MODULE_ALIASES = {"python-docx": "docx", "pillow": "PIL", "edge-tts": "edge_tts",
                   "pyyaml": "yaml", "beautifulsoup4": "bs4"}


# ---------------- 路径 ----------------

def plugins_dir() -> Path:
    return Path(config.BASE_DIR) / "plugins"


def shared_features_dir() -> Path:
    """宿主公共前端脚本目录：ui/web/static/features/。

    规则来源：`ui/web/static/app.js::loadToolFeature()`（`new URL('features/' + file + '.js',
    APP_ASSET_BASE)`，APP_ASSET_BASE 由 `document.currentScript.src` 推出 `/static/`）；
    宿主 `ui/web/server.py` 只对 `manifest.shared_features` 做名称白名单清洗，不改路径映射。
    因此 `dependencies.shared` 与该字段同规则、同目录，不另设别名表。
    """
    return Path(config.BASE_DIR) / "ui" / "web" / "static" / "features"


def shared_feature_path(name: str) -> Path:
    """shared 依赖名 → 实际脚本路径（与 shared_features 加载路径一致）。"""
    return shared_features_dir() / f"{name}.js"


def plugin_manifest_path(pid: str) -> Path:
    return plugins_dir() / pid / "manifest.json"


# ---------------- 名称 / 版本工具 ----------------

def normalize(name: str) -> str:
    """PEP 503 风格归一化：大小写、`-_.` 视为等价。"""
    return re.sub(r"[-_.]+", "-", str(name or "").strip().lower())


def module_guess(name: str) -> str:
    key = normalize(name)
    if key in _MODULE_ALIASES:
        return _MODULE_ALIASES[key]
    return key.replace("-", "_")


def valid_specifier(spec: str) -> bool:
    """校验版本约束：逗号分隔的 PEP 440 比较子句（`==`/`!=`/`>=`/`<=`/`>`/`<`/`~=`）。"""
    text = str(spec or "").strip()
    if not text:
        return False
    for part in text.split(","):
        if not _SPEC_ITEM_RE.match(part.strip()):
            return False
    if HAVE_PACKAGING:
        try:
            SpecifierSet(text)
        except Exception:  # noqa: BLE001 - packaging 判定为非法
            return False
    return True


def _version_tuple(text) -> tuple[int, ...] | None:
    match = re.match(r"^\s*v?(\d+(?:\.\d+)*)", str(text or ""))
    if not match:
        return None
    return tuple(int(x) for x in match.group(1).split("."))


def _cmp_version(left: tuple[int, ...], right: tuple[int, ...]) -> int:
    size = max(len(left), len(right))
    a = left + (0,) * (size - len(left))
    b = right + (0,) * (size - len(right))
    return (a > b) - (a < b)


def _max_lower(current, candidate, inclusive):
    if current is None:
        return (candidate, inclusive)
    order = _cmp_version(candidate, current[0])
    if order > 0:
        return (candidate, inclusive)
    if order == 0:
        return (current[0], current[1] and inclusive)
    return current


def _min_upper(current, candidate, inclusive):
    if current is None:
        return (candidate, inclusive)
    order = _cmp_version(candidate, current[0])
    if order < 0:
        return (candidate, inclusive)
    if order == 0:
        return (current[0], current[1] and inclusive)
    return current


def constraint_bounds(spec: str):
    """把约束解析成 (lower, lower_incl, upper, upper_incl)；无法解析返回 None。"""
    lower = None
    upper = None
    for raw in str(spec or "").split(","):
        part = raw.strip()
        if not part:
            continue
        match = re.match(r"^(==|>=|<=|>|<|~=|!=)\s*(.+)$", part)
        if not match:
            return None
        op, value = match.group(1), match.group(2).strip()
        if op == "!=":
            continue
        parsed = _version_tuple(value)
        if parsed is None:
            return None
        if op == "==":
            lower = _max_lower(lower, parsed, True)
            upper = _min_upper(upper, parsed, True)
        elif op == ">=":
            lower = _max_lower(lower, parsed, True)
        elif op == ">":
            lower = _max_lower(lower, parsed, False)
        elif op == "<=":
            upper = _min_upper(upper, parsed, True)
        elif op == "<":
            upper = _min_upper(upper, parsed, False)
        elif op == "~=":
            if len(parsed) < 2:
                return None
            base = parsed[:-1]
            ceiling = base[:-1] + (base[-1] + 1,) if base else (parsed[0] + 1,)
            lower = _max_lower(lower, parsed, True)
            upper = _min_upper(upper, ceiling, False)
    lower_value, lower_incl = lower if lower else (None, True)
    upper_value, upper_incl = upper if upper else (None, True)
    return lower_value, lower_incl, upper_value, upper_incl


def bounds_conflict(bounds_a, bounds_b) -> bool:
    """两组区间的交集是否为空（只有明确无交集才判冲突，避免误报）。"""
    if bounds_a is None or bounds_b is None:
        return False
    lower_a, lower_incl_a, upper_a, upper_incl_a = bounds_a
    lower_b, lower_incl_b, upper_b, upper_incl_b = bounds_b
    lower = None
    upper = None
    for candidate, incl in ((lower_a, lower_incl_a), (lower_b, lower_incl_b)):
        if candidate is not None:
            lower = _max_lower(lower, candidate, incl)
    for candidate, incl in ((upper_a, upper_incl_a), (upper_b, upper_incl_b)):
        if candidate is not None:
            upper = _min_upper(upper, candidate, incl)
    if lower is None or upper is None:
        return False
    order = _cmp_version(lower[0], upper[0])
    if order > 0:
        return True
    if order == 0:
        return not (lower[1] and upper[1])
    return False


# ---------------- 存在性 / 版本 ----------------

@lru_cache(maxsize=256)
def _distribution(name: str):
    try:
        return importlib_metadata.distribution(str(name))
    except Exception:  # noqa: BLE001 - 未安装或元数据不可用
        pass
    wanted = normalize(name)
    try:
        for dist in importlib_metadata.distributions():
            try:
                dist_name = dist.metadata["Name"] or ""
            except Exception:  # noqa: BLE001
                continue
            if normalize(dist_name) == wanted:
                return dist
    except Exception:  # noqa: BLE001
        return None
    return None


def installed_version(name: str) -> str:
    dist = _distribution(name)
    if dist is None:
        return ""
    try:
        return str(dist.version or "")
    except Exception:  # noqa: BLE001
        return ""


def python_present(name: str) -> tuple[bool, str]:
    if _distribution(name) is not None:
        return True, installed_version(name)
    try:
        found = importlib.util.find_spec(module_guess(name))
    except (ImportError, ValueError):
        found = None
    return (found is not None), ""


def shared_present(name: str) -> bool:
    """按 shared_features 的加载路径规则判存在性（features/<name>.js）。"""
    return shared_feature_path(name).is_file()


def plugin_present(pid: str) -> bool:
    return plugin_manifest_path(pid).is_file()


def satisfies(version: str, spec: str) -> bool | None:
    """True/False；无 packaging 或缺版本时返回 None（无法判断）。"""
    if not HAVE_PACKAGING or not version or not spec:
        return None
    try:
        return bool(SpecifierSet(str(spec)).contains(str(version), prereleases=True))
    except Exception:  # noqa: BLE001 - 版本串非 PEP 440
        return None


# ---------------- 声明解析 / 校验 ----------------

def declaration_errors(manifest: dict) -> list[tuple[str, str, str]]:
    """校验 manifest.dependencies，返回 [(field, code, message)]；空列表=合法。"""
    errors: list[tuple[str, str, str]] = []
    data = manifest.get("dependencies")
    if data is None:
        return errors
    if not isinstance(data, dict):
        return [("dependencies", "dependencies_invalid", "dependencies 必须是对象")]

    def fail(field, code, message):
        errors.append((field, code, message))

    for key in data:
        if key not in KINDS:
            if key == "js":
                fail(f"dependencies.{key}", "dependencies_subkey_invalid",
                     "子键 js 已废弃：宿主公共前端脚本请改用 shared（与 manifest.shared_features 同义）")
            else:
                fail(f"dependencies.{key}", "dependencies_subkey_invalid",
                     f"dependencies 只支持 {' / '.join(KINDS)} 三类子键")
    for key in KINDS:
        if key not in data:
            continue
        items = data.get(key)
        if not isinstance(items, list):
            fail(f"dependencies.{key}", "dependencies_invalid", f"dependencies.{key} 必须是数组")
            continue
        if len(items) > 50:
            fail(f"dependencies.{key}", "dependencies_invalid", f"dependencies.{key} 最多 50 项")
            continue
        for index, item in enumerate(items):
            field = f"dependencies.{key}[{index}]"
            if isinstance(item, dict):
                if key != "python":
                    fail(field, "dependencies_invalid", f"dependencies.{key} 只接受字符串")
                    continue
                name = item.get("name")
                extra = [k for k in item if k not in ("name", "version")]
                if extra:
                    fail(field, "dependencies_invalid",
                         f"python 依赖只接受 name/version，出现多余字段：{', '.join(map(str, extra))}")
                if not isinstance(name, str) or not _NAME_RE.match(name.strip()):
                    fail(field, "dependency_name_invalid",
                         f"依赖名非法：{name!r}（字母/数字开头，可含 . _ -）")
                    continue
                version = item.get("version")
                if version is not None:
                    if not isinstance(version, str) or not valid_specifier(version):
                        fail(field, "dependency_version_invalid",
                             f"版本约束非法：{version!r}（示例：>=1.2、==2.0、>=1,<2）")
                continue
            if not isinstance(item, str):
                fail(field, "dependencies_invalid", f"{key} 依赖必须是字符串或（python 的）对象")
                continue
            text = item.strip()
            if key in ("python", "shared") and not _NAME_RE.match(text):
                fail(field, "dependency_name_invalid",
                     f"依赖名非法：{item!r}（字母/数字开头，可含 . _ -）")
            elif key == "plugins" and not _PLUGIN_RE.match(text):
                fail(field, "dependency_name_invalid", f"插件 id 非法：{item!r}")
    return errors


def _declared(manifest: dict) -> dict[str, list[dict]]:
    """把 manifest.dependencies 摊平成 {kind: [{name, version}]}；忽略非法项（校验器另行报错）。"""
    data = manifest.get("dependencies")
    out: dict[str, list[dict]] = {key: [] for key in KINDS}
    if not isinstance(data, dict):
        return out
    for key in KINDS:
        items = data.get(key)
        if not isinstance(items, list):
            continue
        for item in items:
            if isinstance(item, dict) and key == "python":
                name = str(item.get("name") or "").strip()
                version = str(item.get("version") or "").strip()
            elif isinstance(item, str):
                name = item.strip()
                version = ""
            else:
                continue
            if name:
                out[key].append({"name": name, "version": version})
    return out


# ---------------- 检测 ----------------

def _read_manifest(pid: str) -> dict | None:
    path = plugin_manifest_path(pid)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def _installed_plugins() -> list[str]:
    root = plugins_dir()
    if not root.is_dir():
        return []
    return sorted(d.name for d in root.iterdir()
                  if d.is_dir() and not d.name.startswith(".") and
                  (d / "manifest.json").is_file())


def _conflicts(manifests: dict[str, dict]) -> dict[str, dict]:
    """同一 python 库被多个插件声明且约束无交集 → {norm_name: {...}}。"""
    groups: dict[str, list[dict]] = {}
    for pid, manifest in manifests.items():
        for dep in _declared(manifest)["python"]:
            if not dep["version"]:
                continue
            groups.setdefault(normalize(dep["name"]), []).append(
                {"plugin": pid, "name": dep["name"], "version": dep["version"],
                 "bounds": constraint_bounds(dep["version"])})
    conflicts: dict[str, dict] = {}
    for key, items in groups.items():
        if len(items) < 2:
            continue
        for i in range(len(items)):
            for j in range(i + 1, len(items)):
                a, b = items[i], items[j]
                if a["plugin"] == b["plugin"]:
                    continue
                if bounds_conflict(a["bounds"], b["bounds"]):
                    conflicts[key] = {
                        "name": a["name"],
                        "plugins": sorted({a["plugin"], b["plugin"]}),
                        "constraints": [a["version"], b["version"]],
                        "note": "多版本隔离需后续方案（当前只提示，不阻断）",
                    }
                    break
            if key in conflicts:
                break
    return conflicts


def _entry_status(kind: str, dep: dict, conflict: dict | None) -> tuple[str, str, str]:
    """返回 (status, installed, message)。"""
    name = dep["name"]
    spec = dep["version"]
    if kind == "python":
        present, version = python_present(name)
        if not present:
            return "missing", "", f"未检测到已安装的 {name}"
        if conflict:
            others = "、".join(p for p in conflict["plugins"])
            return "conflict", version, (
                f"与 {others} 的约束互斥（{ ' / '.join(conflict['constraints']) }）；"
                "多版本隔离需后续方案（当前只提示）")
        if spec:
            result = satisfies(version, spec)
            if result is None:
                if not HAVE_PACKAGING:
                    return "unknown", version, DEGRADED_HINT
                if not version:
                    return "unknown", version, "已安装但无法获取版本号"
                return "unknown", version, f"版本号 {version} 无法与约束 {spec} 比较"
            if not result:
                return "version_mismatch", version, f"已安装 {version}，不满足 {spec}"
        return "ok", version, (f"{version} 满足 {spec}" if spec else f"已安装 {version}")
    if kind == "shared":
        if shared_present(name):
            return "ok", "", f"宿主公共前端脚本 features/{name}.js 存在"
        return "missing", "", f"缺少宿主公共前端脚本 features/{name}.js"
    if plugin_present(name):
        return "ok", "", f"插件 {name} 已安装"
    return "missing", "", f"插件 {name} 未安装"


def detect_plugin(pid: str, manifests: dict[str, dict] | None = None,
                  conflicts: dict[str, dict] | None = None) -> dict | None:
    manifest = (manifests or {}).get(pid) or _read_manifest(pid)
    if manifest is None:
        return None
    if conflicts is None:
        conflicts = _conflicts(manifests or {pid: manifest})
    declared = _declared(manifest)
    counts = {key: 0 for key in STATUS_TEXT}
    details: dict[str, list[dict]] = {}
    worst = "undeclared"
    for kind in KINDS:
        items = []
        for dep in declared[kind]:
            conflict = conflicts.get(normalize(dep["name"])) if kind == "python" else None
            status, installed, message = _entry_status(kind, dep, conflict)
            counts[status] = counts.get(status, 0) + 1
            if _STATUS_RANK[status] > _STATUS_RANK.get(worst, 0):
                worst = status
            items.append({
                "kind": kind, "name": dep["name"], "version": dep["version"],
                "installed": installed, "status": status,
                "status_text": STATUS_TEXT[status], "message": message,
            })
        details[kind] = items
    total = sum(len(details[kind]) for kind in KINDS)
    if total == 0:
        aggregate = "undeclared"
        message = "未声明依赖"
    else:
        aggregate = worst
        message = STATUS_TEXT[aggregate]
    return {
        "id": pid,
        "name": str(manifest.get("name") or pid),
        "status": aggregate,
        "status_text": STATUS_TEXT[aggregate],
        "message": message,
        "declared": details,
        "counts": {key: counts.get(key, 0) for key in STATUS_TEXT if counts.get(key)},
        "total": total,
    }


def detect_all() -> dict:
    manifests = {pid: m for pid in _installed_plugins()
                 for m in [_read_manifest(pid)] if m}
    conflicts = _conflicts(manifests)
    plugins = [entry for pid in sorted(manifests)
               if (entry := detect_plugin(pid, manifests, conflicts)) is not None]
    summary: dict[str, int] = {key: 0 for key in STATUS_TEXT}
    for entry in plugins:
        summary[entry["status"]] = summary.get(entry["status"], 0) + 1
    return {
        "ok": True,
        "degraded": not HAVE_PACKAGING,
        "packaging_available": HAVE_PACKAGING,
        "hint": "" if HAVE_PACKAGING else DEGRADED_HINT,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "summary": summary,
        "conflicts": sorted(conflicts.values(), key=lambda x: x["name"]),
        "plugins": plugins,
    }


def detect_one(pid: str) -> dict | None:
    pid = str(pid or "").strip()
    manifests = {name: m for name in _installed_plugins()
                 for m in [_read_manifest(name)] if m}
    if pid not in manifests:
        return None
    entry = detect_plugin(pid, manifests, _conflicts(manifests))
    if entry is None:
        return None
    return {
        "ok": True,
        "degraded": not HAVE_PACKAGING,
        "packaging_available": HAVE_PACKAGING,
        "hint": "" if HAVE_PACKAGING else DEGRADED_HINT,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "conflicts": sorted(_conflicts(manifests).values(), key=lambda x: x["name"]),
        "plugin": entry,
    }
