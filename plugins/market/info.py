"""INFO.md front matter 最小解析（标准库，无 YAML 依赖）。

限制：顶层扁平 key: value；布尔 true/false、null、整数、[a, b] 列表、纯字符串。
"""
from __future__ import annotations

REQUIRED = (
    "id", "name", "version", "kind", "has_ui", "has_backend",
    "db_module_key", "routes_prefix", "summary",
)
OPTIONAL = (
    "entries", "tables", "data_dirs", "shared_features", "provides",
    "consumes", "market_package", "source", "known_limits", "sensitive_data", "icon",
)


class InfoError(ValueError):
    pass


def _scalar(text: str):
    s = text.strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in ("'", '"'):
        return s[1:-1]
    low = s.lower()
    if low == "true":
        return True
    if low == "false":
        return False
    if low in ("null", "none", "~"):
        return None
    if s.startswith("[") and s.endswith("]"):
        body = s[1:-1].strip()
        if not body:
            return []
        return [_scalar(part) for part in body.split(",") if part.strip()]
    try:
        return int(s)
    except ValueError:
        return s


def parse_front_matter(text: str) -> dict:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        raise InfoError("缺少 front matter 起始 ---")
    try:
        end = next(i for i in range(1, len(lines)) if lines[i].strip() == "---")
    except StopIteration as exc:
        raise InfoError("front matter 缺少结束 ---") from exc
    data: dict = {}
    for raw in lines[1:end]:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            raise InfoError(f"无法解析行：{raw}")
        key, value = line.split(":", 1)
        key = key.strip()
        if not key or key in data:
            raise InfoError(f"重复或空键：{key}")
        data[key] = _scalar(value)
    missing = [k for k in REQUIRED if k not in data]
    if missing:
        raise InfoError("缺少必需字段：" + ", ".join(missing))
    return data


def read_info(path) -> dict:
    from pathlib import Path
    return parse_front_matter(Path(path).read_text(encoding="utf-8"))
