# -*- coding: utf-8 -*-
"""模型用量与消费（第二版：四 token 字段 + 价目自动计算）。

职责：
  - 校验手动录入的单次模型调用记录（四个 token 字段必填、模型必须在价目表中）；
  - 按北京时间峰谷与可配置节假日选取价目，自动计算花销；
  - 实际花销默认等于计算花销，允许编辑后与计算值不同，两者都保存；
  - 价目与节假日配置存 data/settings.json，入口在本工具自己的设置弹层；
  - 把 HH:MM:SS / MM:SS / SS 间隔解析为总秒数。

边界：
  - 只读写独立的 model_usage_logs 表与 settings.json 的 model_pricing 键；
  - 与「记账本」及 SRS / 词库 / 背景库等既有数据没有外键或写入关联；
  - 所有 SQL 都留在 core/repository.py；
  - 第一版不做 CSV / JSON 导出，也不做跨币种换算。

对外接口：
    api(method, path, query, data)
    parse_interval(text) / format_interval(seconds)
    is_peak(called_at, holidays)
    calculate_cost(model_pricing, tokens, tier)
"""
from __future__ import annotations

import copy
import math
import re
from datetime import date, datetime, timedelta

from . import repo
from modules import settings_store

DEFAULT_CURRENCY = "CNY"
MAX_INTEGER = 9_223_372_036_854_775_807
_INTERVAL_RE = re.compile(r"^\d+(?::\d+){0,2}$")
_CALLED_AT_FORMATS = ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M")
_MODEL_KEY_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,59}$")
_SETTINGS_KEY = "model_pricing"

# 元 / 百万 tokens；高峰/空闲两档。
DEFAULT_MODELS: dict[str, dict] = {
    "deepseek-flash": {
        "label": "deepseek-flash",
        "cache_read": {"offpeak": 0.02, "peak": 0.04},
        "uncached_input": {"offpeak": 1.0, "peak": 2.0},
        "output": {"offpeak": 4.0, "peak": 8.0},
    },
    "deepseek-v4-pro": {
        "label": "deepseek-v4-pro",
        "cache_read": {"offpeak": 0.15, "peak": 0.30},
        "uncached_input": {"offpeak": 4.5, "peak": 9.0},
        "output": {"offpeak": 13.5, "peak": 27.0},
    },
}

MODEL_ALIASES = {
    "deepseek-v4.1-flash-1017": "deepseek-flash",
    "deepseek-v4.1-flash": "deepseek-flash",
    "deepseek-v4-flash": "deepseek-flash",
    "deepseek-v4-pro-0813": "deepseek-v4-pro",
    "deepseek-v4-pro": "deepseek-v4-pro",
}


# ------------------------------------------------------------
# 基础校验
# ------------------------------------------------------------

def _clean_text(value, label: str) -> str:
    text = str(value if value is not None else "").strip()
    if not text:
        raise ValueError(f"{label}不能为空")
    return text


def _parse_int(value, label: str, *, required: bool = False, minimum: int = 0):
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise ValueError(f"{label}不能为空")
        return None
    if isinstance(value, bool):
        raise ValueError(f"{label}必须为整数")
    if isinstance(value, int):
        number = value
    elif isinstance(value, float):
        if not value.is_integer():
            raise ValueError(f"{label}必须为整数")
        number = int(value)
    else:
        text = str(value).strip()
        if not re.fullmatch(r"[+-]?\d+", text):
            raise ValueError(f"{label}必须为整数")
        number = int(text)
    if number < minimum:
        raise ValueError(f"{label}不能小于 {minimum}")
    if number > MAX_INTEGER:
        raise ValueError(f"{label}超出可存储范围")
    return number


def _parse_float(value, label: str, *, required: bool = True):
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise ValueError(f"{label}不能为空")
        return None
    if isinstance(value, bool):
        raise ValueError(f"{label}必须为非负数字")
    try:
        amount = float(str(value).strip())
    except (TypeError, ValueError):
        raise ValueError(f"{label}必须为非负数字") from None
    if not math.isfinite(amount) or amount < 0:
        raise ValueError(f"{label}必须为非负数字")
    return amount


def _parse_called_at(value) -> str:
    text = str(value if value is not None else "").strip()
    if not text:
        raise ValueError("调用时间不能为空")
    text = text.replace("T", " ")
    for fmt in _CALLED_AT_FORMATS:
        try:
            parsed = datetime.strptime(text, fmt)
        except ValueError:
            continue
        return parsed.strftime("%Y-%m-%d %H:%M:%S")
    raise ValueError("调用时间格式不正确（应为 YYYY-MM-DD HH:MM[:SS]）")


def parse_interval(text) -> tuple[int | None, str]:
    """把手动录入的间隔解析为总秒数；分/秒超过 59 只提示，不阻断。"""
    raw = str(text if text is not None else "").strip()
    if not raw:
        return None, ""
    if not _INTERVAL_RE.fullmatch(raw):
        raise ValueError("间隔无法解析，请使用 HH:MM:SS / MM:SS / SS（如 01:02:03、02:03、45）")
    parts = [int(x) for x in raw.split(":")]
    if len(parts) == 1:
        hours, minutes, seconds = 0, 0, parts[0]
    elif len(parts) == 2:
        hours, minutes, seconds = 0, parts[0], parts[1]
    else:
        hours, minutes, seconds = parts
    total = hours * 3600 + minutes * 60 + seconds
    if total > MAX_INTEGER:
        raise ValueError("间隔超出可存储范围")
    issues: list[str] = []
    if minutes > 59:
        issues.append("分钟超过 59")
    if seconds > 59:
        issues.append("秒超过 59")
    warning = ""
    if issues:
        warning = f"间隔{'、'.join(issues)}，仍按输入值保存为 {total} 秒"
    return total, warning


def format_interval(seconds) -> str:
    if seconds is None or seconds == "":
        return ""
    total = int(seconds)
    hours, rem = divmod(total, 3600)
    minutes, secs = divmod(rem, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    if minutes:
        return f"{minutes:02d}:{secs:02d}"
    return f"{secs:02d}"


def _interval_input(data: dict) -> tuple[int | None, str]:
    if "interval_text" in data:
        return parse_interval(data.get("interval_text"))
    if "interval_seconds" in data:
        seconds = _parse_int(data.get("interval_seconds"), "间隔秒数", minimum=0)
        return seconds, ""
    return None, ""


# ------------------------------------------------------------
# 价目 / 节假日配置
# ------------------------------------------------------------

def _default_pricing() -> dict:
    return {"models": copy.deepcopy(DEFAULT_MODELS), "holidays": []}


def _normalize_prices(value, field_label: str) -> dict:
    if not isinstance(value, dict):
        raise ValueError(f"{field_label}必须为对象")
    return {
        "offpeak": _parse_float(value.get("offpeak"), f"{field_label}空闲价"),
        "peak": _parse_float(value.get("peak"), f"{field_label}高峰价"),
    }


def _normalize_holidays(value) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError("节假日必须为日期数组")
    out: list[str] = []
    for item in value:
        text = str(item if item is not None else "").strip()
        try:
            date.fromisoformat(text)
        except ValueError:
            raise ValueError(f"节假日日期格式不正确：{text}（应为 YYYY-MM-DD）") from None
        if text not in out:
            out.append(text)
    return sorted(out)


def normalize_pricing(raw) -> dict:
    """把 settings 中的价目配置规范化；非法/为空时回落内置默认两档。"""
    if not isinstance(raw, dict) or not isinstance(raw.get("models"), dict):
        return _default_pricing()
    models: dict[str, dict] = {}
    for raw_key, raw_model in raw["models"].items():
        key = str(raw_key or "").strip()
        if not _MODEL_KEY_RE.fullmatch(key) or not isinstance(raw_model, dict):
            continue
        try:
            model = {
                "label": str(raw_model.get("label") or key).strip()[:60] or key,
                "cache_read": _normalize_prices(raw_model.get("cache_read"), "缓存命中输入价"),
                "uncached_input": _normalize_prices(raw_model.get("uncached_input"), "缓存未命中输入价"),
                "output": _normalize_prices(raw_model.get("output"), "输出价"),
            }
        except ValueError:
            continue
        models[key] = model
    if not models:
        return _default_pricing()
    try:
        holidays = _normalize_holidays(raw.get("holidays"))
    except ValueError:
        holidays = []
    return {"models": models, "holidays": holidays}


def _settings_path():
    return settings_store.plugin_settings_path("model_usage")


def pricing_config() -> dict:
    return normalize_pricing(settings_store.read_at(_settings_path()).get(_SETTINGS_KEY))


def save_pricing(payload: dict) -> dict:
    if not isinstance(payload, dict):
        raise ValueError("价目配置必须为对象")
    raw_models = payload.get("models")
    if not isinstance(raw_models, dict) or not raw_models:
        raise ValueError("价目配置至少需要一个模型")
    models: dict[str, dict] = {}
    for raw_key, raw_model in raw_models.items():
        key = str(raw_key or "").strip()
        if not _MODEL_KEY_RE.fullmatch(key):
            raise ValueError(f"模型名不合法：{key}（只允许字母、数字、点、下划线、连字符）")
        if not isinstance(raw_model, dict):
            raise ValueError(f"模型 {key} 的价目必须为对象")
        models[key] = {
            "label": str(raw_model.get("label") or key).strip()[:60] or key,
            "cache_read": _normalize_prices(raw_model.get("cache_read"), f"{key} 缓存命中输入价"),
            "uncached_input": _normalize_prices(raw_model.get("uncached_input"), f"{key} 缓存未命中输入价"),
            "output": _normalize_prices(raw_model.get("output"), f"{key} 输出价"),
        }
    holidays = _normalize_holidays(payload.get("holidays"))
    cfg = {"models": models, "holidays": holidays}
    data, ok = settings_store.update_at(_settings_path(), {_SETTINGS_KEY: cfg})
    if not ok:
        raise ValueError("价目配置保存失败：无法写入 data/plugins/model_usage/settings.json")
    return normalize_pricing(data.get(_SETTINGS_KEY))


def _normalize_model_name(value, models: dict[str, dict]) -> str:
    key = str(value if value is not None else "").strip()
    if not key:
        raise ValueError("模型名不能为空")
    low = key.lower()
    if low in models:
        return low
    if low in MODEL_ALIASES and MODEL_ALIASES[low] in models:
        return MODEL_ALIASES[low]
    if ("v4.1-flash" in low or "v4-flash" in low) and "deepseek-flash" in models:
        return "deepseek-flash"
    if "v4-pro" in low and "deepseek-v4-pro" in models:
        return "deepseek-v4-pro"
    raise ValueError("模型不在当前价目配置中，请先在「价目设置」中添加该模型与价格")


def _beijing_datetime(called_at: str) -> datetime:
    """called_at 按莫斯科本地时间存储；北京时间 = 莫斯科时间 + 5 小时（无夏令时）。"""
    moscow = datetime.strptime(called_at, "%Y-%m-%d %H:%M:%S")
    return moscow + timedelta(hours=5)


def is_peak(called_at: str, holidays: list[str] | None = None) -> bool:
    """北京时间周一至周五 9:00–12:00、14:00–18:00 为高峰；节假日全天空闲。"""
    bj = _beijing_datetime(called_at)
    if bj.date().isoformat() in set(holidays or []):
        return False
    if bj.weekday() >= 5:
        return False
    minutes = bj.hour * 60 + bj.minute
    return (9 * 60 <= minutes < 12 * 60) or (14 * 60 <= minutes < 18 * 60)


def calculate_cost(model_pricing: dict, tokens: dict, tier: str) -> float:
    """按价目表计算花销；cache_write 只记录，不单独计价。"""
    def price(field: str) -> float:
        return float(model_pricing[field][tier])

    total = (
        tokens["uncached_input_tokens"] * price("uncached_input")
        + tokens["cache_read_tokens"] * price("cache_read")
        + tokens["output_tokens"] * price("output")
    ) / 1_000_000
    return round(total, 6)


# ------------------------------------------------------------
# 记录校验
# ------------------------------------------------------------

def _normalize_record(data: dict, pricing: dict) -> tuple[dict, list[str]]:
    if not isinstance(data, dict):
        raise ValueError("请求数据必须为 JSON 对象")
    warnings: list[str] = []
    models = pricing["models"]
    record: dict = {
        "called_at": _parse_called_at(data.get("called_at")),
        "conversation_label": _clean_text(data.get("conversation_label"), "对话标签"),
        "turn_index": _parse_int(data.get("turn_index"), "对话内序号",
                                 required=True, minimum=1),
        "feature_label": _clean_text(data.get("feature_label"), "功能标签"),
        "model_name": _normalize_model_name(data.get("model_name"), models),
        "uncached_input_tokens": _parse_int(data.get("uncached_input_tokens"),
                                            "缓存未命中输入 token", required=True, minimum=0),
        "cache_read_tokens": _parse_int(data.get("cache_read_tokens"),
                                        "缓存命中输入 token", required=True, minimum=0),
        "cache_write_tokens": _parse_int(data.get("cache_write_tokens"),
                                         "缓存写入 token", required=True, minimum=0),
        "output_tokens": _parse_int(data.get("output_tokens"),
                                    "输出 token", required=True, minimum=0),
    }
    if "currency" not in data or data.get("currency") is None:
        record["currency"] = DEFAULT_CURRENCY
    else:
        record["currency"] = _clean_text(data.get("currency"), "币种").upper()
    interval_seconds, interval_warning = _interval_input(data)
    record["interval_seconds"] = interval_seconds
    if interval_warning:
        warnings.append(interval_warning)

    tier = "peak" if is_peak(record["called_at"], pricing.get("holidays")) else "offpeak"
    calculated = calculate_cost(models[record["model_name"]], record, tier)
    actual_raw = data.get("actual_cost")
    if actual_raw is None or (isinstance(actual_raw, str) and not actual_raw.strip()):
        actual = calculated
    else:
        actual = _parse_float(actual_raw, "实际花销")
    record["calculated_cost"] = calculated
    record["actual_cost"] = actual
    record["price_tier"] = tier
    return record, warnings


def _with_interval_text(record: dict) -> dict:
    data = dict(record)
    data["interval_text"] = format_interval(record.get("interval_seconds"))
    data["total_tokens"] = (
        int(record.get("uncached_input_tokens") or 0)
        + int(record.get("cache_read_tokens") or 0)
        + int(record.get("cache_write_tokens") or 0)
        + int(record.get("output_tokens") or 0)
    )
    return data


def _parse_id(value) -> int:
    if isinstance(value, bool):
        raise ValueError("记录 id 无效")
    try:
        record_id = int(value)
    except (TypeError, ValueError):
        raise ValueError("记录 id 无效") from None
    if record_id <= 0:
        raise ValueError("记录 id 无效")
    return record_id


# ------------------------------------------------------------
# 业务接口
# ------------------------------------------------------------

def state() -> dict:
    return {
        "records": [_with_interval_text(r) for r in repo.list_model_usage()],
        "suggestions": repo.model_usage_suggestions(),
        "default_currency": DEFAULT_CURRENCY,
        "pricing": pricing_config(),
    }


def create(data: dict) -> dict:
    pricing = pricing_config()
    record, warnings = _normalize_record(data, pricing)
    record_id = repo.add_model_usage(record)
    saved = repo.get_model_usage(record_id)
    if saved is None:
        raise RuntimeError("记录写入后未能读回")
    return {"record": _with_interval_text(saved), "warnings": warnings}


def update(record_id: int, data: dict) -> dict:
    if repo.get_model_usage(record_id) is None:
        raise LookupError("记录不存在或已被删除，请刷新列表")
    pricing = pricing_config()
    record, warnings = _normalize_record(data, pricing)
    if not repo.update_model_usage(record_id, record):
        raise LookupError("记录不存在或已被删除，请刷新列表")
    saved = repo.get_model_usage(record_id)
    if saved is None:
        raise LookupError("记录不存在或已被删除，请刷新列表")
    return {"record": _with_interval_text(saved), "warnings": warnings}


def delete(record_id: int) -> dict:
    if not repo.delete_model_usage(record_id):
        raise LookupError("记录不存在或已被删除，请刷新列表")
    return {"deleted": True, "id": record_id}


def api(method: str, path: str, query: dict, data: dict):
    if method in ("GET", "POST") and path == "/api/model-usage":
        return state()
    if method == "GET" and path == "/api/model-usage/pricing":
        return {"pricing": pricing_config()}
    if method == "POST" and path == "/api/model-usage/pricing":
        return {"pricing": save_pricing(data)}
    if method == "POST" and path == "/api/model-usage/add":
        return create(data)
    if method == "POST" and path == "/api/model-usage/update":
        return update(_parse_id(data.get("id")), data)
    if method == "POST" and path == "/api/model-usage/delete":
        return delete(_parse_id(data.get("id")))
    raise LookupError(f"未找到模型用量接口：{method} {path}")
