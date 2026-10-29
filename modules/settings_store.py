# -*- coding: utf-8 -*-
"""data/settings.json 的共享读写工具。

Web 设置页（下载分组）与模型用量价目配置都需要读写同一个 settings.json；
集中在这里做原子写入与进程内串行化，避免两个模块互相覆盖。
"""
from __future__ import annotations

import json
import os
import threading
from pathlib import Path

import config

_lock = threading.RLock()
MODULES = ("core", "pm", "reader", "bg", "file_notes", "model_usage", "finance")
DEFAULT_SETTINGS_PATH = Path(config.DATA_DIR) / "settings.json"


def plugin_settings_path(plugin_id: str) -> Path:
    """返回插件独立 settings.json 路径（data/plugins/<id>/settings.json）。"""
    return config.plugin_data_dir(str(plugin_id)) / "settings.json"


def quota_settings_path() -> Path:
    """学习配额由 russian 插件持有；宿主只通过此路径转调。"""
    return plugin_settings_path("russian")


def read_at(path) -> dict:
    """按路径读取 JSON 对象；缺失/损坏时返回 {}。"""
    target = Path(path)
    try:
        with open(target, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def write_at(path, data: dict) -> bool:
    """按路径原子写入；失败返回 False。"""
    if not isinstance(data, dict):
        return False
    target = Path(path)
    tmp = target.with_name(target.name + ".tmp")
    try:
        with _lock:
            target.parent.mkdir(parents=True, exist_ok=True)
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False)
            os.replace(tmp, target)
        return True
    except OSError:
        try:
            tmp.unlink(missing_ok=True)
        except OSError:
            pass
        return False


def update_at(path, patch: dict) -> tuple[dict, bool]:
    """按路径浅合并 patch 后写入，返回 (合并后数据, 是否成功)。"""
    with _lock:
        data = read_at(path)
        data.update(patch or {})
        return data, write_at(path, data)


def modules_enabled() -> dict[str, bool]:
    """读取 modules.enabled；缺失模块或整段缺失时默认启用。"""
    data = read()
    modules = data.get("modules") if isinstance(data, dict) else None
    enabled = modules.get("enabled") if isinstance(modules, dict) else None
    if not isinstance(enabled, dict):
        enabled = {}
    return {name: enabled.get(name, True) is not False for name in MODULES}


def module_enabled(name: str) -> bool:
    return modules_enabled().get(str(name), True)


def path() -> Path:
    return DEFAULT_SETTINGS_PATH


def read() -> dict:
    return read_at(DEFAULT_SETTINGS_PATH)


def write(data: dict) -> bool:
    """按默认路径原子写入；失败返回 False。"""
    return write_at(DEFAULT_SETTINGS_PATH, data)


def update(patch: dict) -> tuple[dict, bool]:
    """按默认路径浅合并后写入，返回 (合并后数据, 是否成功)。"""
    return update_at(DEFAULT_SETTINGS_PATH, patch)
