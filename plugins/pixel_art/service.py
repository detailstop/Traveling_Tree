# -*- coding: utf-8 -*-
"""像素画作品、视觉设置与资产引用。

职责：
  - 通篇视图外观设置：全局一份 key/value，存 visual_settings 表；
  - 像素画作品：单帧单图层，存 pixel_artworks 表（palette + 行主序像素索引）；
  - 资产引用：书签 / 通篇视图图标 -> 作品 id，存 pixel_asset_refs 表。

约束：
  - 只新增表，不改 reader_* 等现有表；
  - 作品删除时清空对应引用，前端按“回退默认图形”处理；
  - 不调用任何 AI，不做多帧 / 多图层 / GIF。
"""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone

from . import repo
from . import visual_settings

VISUAL_KEY = "reader.full.visual"
SCREEN_VISUAL_KEY = "reader.screen.visual"
VISUAL_KEYS = (VISUAL_KEY, SCREEN_VISUAL_KEY)
VISUAL_GROUPS = ("ru", "zh", "kw")
MAX_SIZE = 128
MAX_PALETTE = 64
REF_KEYS = ("bookmark", "icon.edit", "icon.copy_ru", "icon.copy_zh",
            "icon.delete", "icon.settings")

DEFAULT_VISUAL = {
    "ru": {"font": 'Georgia, "Times New Roman", "Noto Serif", serif',
           "size": 21, "lh": 1.7, "color": "#241c22", "bg": ""},
    "zh": {"font": '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
           "size": 15, "lh": 1.65, "color": "#6b5b63", "bg": ""},
    "kw": {"font": '"Microsoft YaHei", sans-serif', "size": 12.5, "lh": 1.5,
           "color": "#b4576f", "bg": "#ffe6ee"},
    "mask": {"color": "#d9d2e3", "opacity": 88},
    "singleHidden": True,
}

_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _json(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _decode(value, fallback):
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return fallback


# ------------------------------------------------------------
# 视觉设置
# ------------------------------------------------------------

def _as_float(value, field: str, low: float, high: float, errors: list[str]) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        errors.append(f"{field} 必须为数字")
        return low
    if not low <= number <= high:
        errors.append(f"{field} 超出范围（{low:g}–{high:g}）")
        return max(low, min(high, number))
    return number


def _as_hex(value, field: str, errors: list[str], allow_empty: bool = False) -> str:
    text = str(value or "").strip()
    if allow_empty and not text:
        return ""
    if not _HEX.match(text):
        errors.append(f"{field} 必须为 #rrggbb 颜色")
        return "#000000"
    return text.lower()


def _normalize_visual(raw: dict) -> dict:
    if not isinstance(raw, dict):
        raise ValueError("视觉设置必须为对象")
    errors: list[str] = []
    out: dict = {}
    for group in VISUAL_GROUPS:
        source = raw.get(group) if isinstance(raw.get(group), dict) else {}
        base = DEFAULT_VISUAL[group]
        font = str(source.get("font", base["font"]) or base["font"]).strip()
        if len(font) > 200:
            errors.append(f"{group}.font 过长")
            font = base["font"]
        out[group] = {
            "font": font or base["font"],
            "size": _as_float(source.get("size", base["size"]), f"{group}.size", 8, 64, errors),
            "lh": _as_float(source.get("lh", base["lh"]), f"{group}.lh", 1, 3.5, errors),
            "color": _as_hex(source.get("color", base["color"]), f"{group}.color", errors),
            "bg": _as_hex(source.get("bg", base["bg"]), f"{group}.bg", errors, allow_empty=True),
        }
    mask = raw.get("mask") if isinstance(raw.get("mask"), dict) else {}
    out["mask"] = {
        "color": _as_hex(mask.get("color", DEFAULT_VISUAL["mask"]["color"]), "mask.color", errors),
        "opacity": int(_as_float(mask.get("opacity", DEFAULT_VISUAL["mask"]["opacity"]),
                                 "mask.opacity", 20, 100, errors)),
    }
    single = raw.get("singleHidden", DEFAULT_VISUAL["singleHidden"])
    if not isinstance(single, bool):
        errors.append("singleHidden 必须为布尔值")
        single = True
    out["singleHidden"] = single
    if errors:
        raise ValueError("；".join(errors))
    return out


def _merge_visual(raw) -> dict:
    """把任意（可能缺字段/损坏）的设置合并到默认值，永远返回完整结构。"""
    out = {k: dict(v) if isinstance(v, dict) else v for k, v in DEFAULT_VISUAL.items()}
    if isinstance(raw, dict):
        try:
            normalized = _normalize_visual(raw)
        except ValueError:
            return out
        out.update(normalized)
    return out


def _visual_key(key: str | None) -> str:
    key = str(key or "").strip() or VISUAL_KEY
    if key not in VISUAL_KEYS:
        raise ValueError("视觉设置 key 非法：" + key)
    return key


def get_visual_settings(key: str | None = None) -> dict:
    key = _visual_key(key)
    row = visual_settings.get_visual_setting(key)
    saved = _decode(row["value"], {}) if row else {}
    return {"visual": _merge_visual(saved), "defaults": DEFAULT_VISUAL, "key": key}


def save_visual_settings(data: dict, key: str | None = None) -> dict:
    if not key and isinstance(data, dict):
        key = data.get("key")
    key = _visual_key(key)
    raw = data.get("visual") if isinstance(data, dict) and "visual" in data else data
    visual = _normalize_visual(raw)
    visual_settings.save_visual_setting(key, _json(visual), _now())
    return {"visual": visual, "key": key}


# ------------------------------------------------------------
# 像素画作品
# ------------------------------------------------------------

def _work(row) -> dict:
    item = {
        "artwork_id": row["artwork_id"],
        "name": row["name"],
        "width": int(row["width"]),
        "height": int(row["height"]),
        "palette": _decode(row["palette"], []),
        "pixels": _decode(row["pixels"], []),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }
    return item


def _one_work(artwork_id: str) -> dict:
    row = repo.get_pixel_artwork(artwork_id)
    if not row:
        raise LookupError("像素画作品不存在")
    return _work(row)


def list_works() -> list[dict]:
    return [_work(r) for r in repo.list_pixel_artworks()]


def _normalize_palette(value, errors: list[str]) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        errors.append("palette 必须为 #rrggbb 数组")
        return []
    if len(value) > MAX_PALETTE:
        errors.append(f"palette 最多 {MAX_PALETTE} 色")
    out = []
    for i, color in enumerate(value[:MAX_PALETTE], 1):
        text = str(color or "").strip()
        if not _HEX.match(text):
            errors.append(f"palette 第 {i} 项不是 #rrggbb 颜色")
            continue
        out.append(text.lower())
    return out


def _normalize_pixels(value, width: int, height: int, palette_len: int,
                      errors: list[str]) -> list[int]:
    if not isinstance(value, list):
        errors.append("pixels 必须为数组")
        return []
    if len(value) != width * height:
        errors.append(f"pixels 长度必须为 {width * height}（width × height）")
        return []
    out: list[int] = []
    for i, item in enumerate(value):
        if isinstance(item, bool) or not isinstance(item, int):
            errors.append(f"pixels 第 {i + 1} 项必须为整数")
            out.append(-1)
            continue
        if item < -1 or item >= palette_len:
            errors.append(f"pixels 第 {i + 1} 项超出调色板范围")
            out.append(-1)
            continue
        out.append(item)
    return out


def _normalize_work(data: dict, current: dict | None = None) -> dict:
    if not isinstance(data, dict):
        raise ValueError("作品必须为对象")
    errors: list[str] = []
    name = str(data.get("name", current["name"] if current else "") or "").strip()
    if not name:
        errors.append("name 不能为空")
    if len(name) > 80:
        errors.append("name 最多 80 个字符")
        name = name[:80]
    try:
        width = int(data.get("width", current["width"] if current else 16))
        height = int(data.get("height", current["height"] if current else 16))
    except (TypeError, ValueError):
        errors.append("width / height 必须为整数")
        width, height = 16, 16
    if not 1 <= width <= MAX_SIZE:
        errors.append(f"width 必须在 1–{MAX_SIZE}")
        width = max(1, min(MAX_SIZE, width))
    if not 1 <= height <= MAX_SIZE:
        errors.append(f"height 必须在 1–{MAX_SIZE}")
        height = max(1, min(MAX_SIZE, height))
    palette_raw = data.get("palette", current["palette"] if current else [])
    palette = _normalize_palette(palette_raw, errors)
    if current and "pixels" not in data and (width != current["width"] or height != current["height"]):
        errors.append("修改宽高时必须同时提交 pixels")
        pixels = []
    else:
        pixels_raw = data.get("pixels", current["pixels"] if current else [-1] * (width * height))
        pixels = _normalize_pixels(pixels_raw, width, height, len(palette), errors)
    if errors:
        raise ValueError("；".join(errors))
    return {"name": name, "width": width, "height": height,
            "palette": palette, "pixels": pixels}


def create_work(data: dict) -> dict:
    work = _normalize_work(data)
    artwork_id = str(uuid.uuid4())
    now = _now()
    repo.add_pixel_artwork((artwork_id, work["name"], work["width"], work["height"],
                            _json(work["palette"]), _json(work["pixels"]), now, now))
    return _one_work(artwork_id)


def update_work(artwork_id: str, data: dict) -> dict:
    current = _one_work(artwork_id)
    work = _normalize_work(data, current)
    repo.update_pixel_artwork((work["name"], work["width"], work["height"], _json(work["palette"]),
                               _json(work["pixels"]), _now(), artwork_id))
    return _one_work(artwork_id)


# ------------------------------------------------------------
# 资产引用
# ------------------------------------------------------------

def _refs() -> dict[str, str]:
    out: dict[str, str] = {}
    for row in repo.list_pixel_asset_refs():
        if row.get("artwork_id"):
            out[row["ref_key"]] = row["artwork_id"]
    return out


def assets_payload() -> dict:
    works = {w["artwork_id"]: w for w in list_works()}
    refs = _refs()
    return {"refs": refs,
            "assets": {key: works[value] for key, value in refs.items() if value in works},
            "keys": list(REF_KEYS)}


def set_ref(ref_key: str, data: dict) -> dict:
    ref_key = str(ref_key or "").strip()
    if ref_key not in REF_KEYS:
        raise ValueError("资产引用键非法：" + ref_key)
    artwork_id = data.get("artwork_id") if isinstance(data, dict) else None
    artwork_id = str(artwork_id).strip() if artwork_id else ""
    if artwork_id:
        _one_work(artwork_id)  # 不存在则 404
    repo.set_pixel_asset_ref(ref_key, artwork_id or None, _now())
    return {"ref_key": ref_key, **assets_payload()}


def clear_ref(ref_key: str) -> dict:
    return set_ref(ref_key, {"artwork_id": ""})


def delete_work(artwork_id: str) -> dict:
    _one_work(artwork_id)
    cleared = [row["ref_key"] for row in repo.list_pixel_asset_refs(artwork_id)]
    repo.delete_pixel_artwork(artwork_id)
    return {"deleted_id": artwork_id, "cleared_refs": cleared}


# ------------------------------------------------------------
# 对外接口
# ------------------------------------------------------------

def api(method: str, path: str, query: dict, data: dict):
    if method == "GET" and path == "/api/pixel/works":
        return {"works": list_works()}
    if method == "POST" and path == "/api/pixel/works":
        return {"work": create_work(data)}
    if method == "GET" and path == "/api/pixel/refs":
        return assets_payload()
    if (m := re.fullmatch(r"/api/pixel/refs/([^/]+)", path)):
        if method in ("PUT", "POST"):
            return set_ref(m.group(1), data)
        if method == "DELETE":
            return clear_ref(m.group(1))
    if (m := re.fullmatch(r"/api/pixel/works/([^/]+)", path)):
        wid = m.group(1)
        if method == "GET":
            return {"work": _one_work(wid)}
        if method in ("PUT", "PATCH"):
            return {"work": update_work(wid, data)}
        if method == "DELETE":
            return delete_work(wid)
    raise LookupError(f"未找到像素画接口：{method} {path}")
