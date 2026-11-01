"""urlarch R4 安全校验：白名单条目的名称/路径/参数/快捷键校验（纯函数，无副作用）。

安全底线（对应守则第 21 条 / 硬约束 5）：
- 只接受「白名单 id」，path/args 一律取自数据库，不接受前端传入的路径或命令；
- 路径必须为绝对路径、真实存在的普通文件，拒绝 `..`、UNC 与脚本/快捷方式类扩展名；
- 参数必须是 JSON 字符串数组，长度受限，且不含 shell 元字符（配合 shell=False 双保险）；
- 启动只用 `[path] + args` 列表形式，不拼接命令字符串、不使用 shell。
"""
from __future__ import annotations

import json
import os
import re

MAX_NAME = 64
MAX_PATH = 512
MAX_HOTKEY = 64
MAX_ARGS = 20
MAX_ARG_LEN = 200
MAX_ARGS_TOTAL = 1000

# 明确拒绝：可执行任意内容的脚本 / 快捷方式 / 安装包 / 链接类文件。
# 采用「黑名单显式拦截」，而非「扩展名白名单」——白名单注册制才是放行依据。
BLOCKED_EXTS = frozenset({
    "bat", "cmd", "lnk", "ps1", "psm1", "psd1", "vbs", "vbe", "js", "jse",
    "wsf", "wsh", "hta", "msi", "msp", "mst", "scr", "com", "pif", "cpl",
    "reg", "jar", "py", "pyw", "sh", "bash", "inf", "scf", "url",
})
# shell 元字符：args 里出现即拒绝（即使 shell=False 不会解释，也不放宽）。
_SHELL_META = (";", "&&", "||", "|", ">", "<", "`", "$(", "\n", "\r", "\0")

_MODS = {
    "ctrl": "Ctrl", "control": "Ctrl",
    "alt": "Alt",
    "shift": "Shift",
    "meta": "Meta", "win": "Meta", "cmd": "Meta", "super": "Meta",
}
_MOD_ORDER = ("Ctrl", "Alt", "Shift", "Meta")
_KEY_RE = re.compile(r"^(?:[A-Z]|[0-9]|F(?:[1-9]|1[0-2]))$")
_ID_RE = re.compile(r"^us_[0-9a-f]{16}$")


class ShortcutError(ValueError):
    """带稳定错误码的校验失败。"""

    def __init__(self, code: str, message: str = ""):
        super().__init__(message or code)
        self.code = code
        self.message = message or code


def validate_name(raw) -> str:
    if not isinstance(raw, str):
        raise ShortcutError("NAME_INVALID", "名称必须是字符串")
    name = raw.strip()
    if not name or len(name) > MAX_NAME:
        raise ShortcutError("NAME_INVALID", f"名称需为 1–{MAX_NAME} 个字符")
    if any(ch in name for ch in "\r\n\t\0"):
        raise ShortcutError("NAME_INVALID", "名称不能包含换行或制表符")
    return name


def validate_path(raw) -> str:
    """返回规范化后的绝对路径；任何可疑形态一律拒绝。"""
    if not isinstance(raw, str):
        raise ShortcutError("PATH_INVALID", "路径必须是字符串")
    text = raw.strip()
    if not text or len(text) > MAX_PATH:
        raise ShortcutError("PATH_INVALID", f"路径需为 1–{MAX_PATH} 个字符")
    if "\0" in text or "\n" in text or "\r" in text:
        raise ShortcutError("PATH_INVALID", "路径不能包含控制字符")
    if text.startswith("\\\\"):
        raise ShortcutError("PATH_INVALID", "不接受 UNC 网络路径")
    if not os.path.isabs(text):
        raise ShortcutError("PATH_INVALID", "必须是绝对路径")
    if ".." in text.replace("\\", "/").split("/"):
        raise ShortcutError("PATH_INVALID", "路径不允许包含 ..")
    real = os.path.realpath(text)
    if ".." in real.replace("\\", "/").split("/"):
        raise ShortcutError("PATH_INVALID", "路径不允许包含 ..")
    if not os.path.isfile(real):
        raise ShortcutError("PATH_INVALID", "文件不存在或不是普通文件")
    ext = os.path.splitext(real)[1].lower().lstrip(".")
    if ext in BLOCKED_EXTS:
        raise ShortcutError("PATH_EXT_BLOCKED",
                            f".{ext} 属于脚本/快捷方式/安装包类文件，请登记可执行程序本体")
    return real


def validate_args(raw) -> str:
    """校验并返回规范化的 JSON 数组字符串（存库格式）。"""
    if raw is None:
        raw = ""
    if not isinstance(raw, str):
        raise ShortcutError("ARGS_INVALID", "args 必须是 JSON 数组字符串")
    text = raw.strip()
    if not text:
        return "[]"
    if len(text) > MAX_ARGS_TOTAL:
        raise ShortcutError("ARGS_INVALID", f"args 总长度不能超过 {MAX_ARGS_TOTAL}")
    try:
        data = json.loads(text)
    except (ValueError, TypeError):
        raise ShortcutError("ARGS_INVALID", "args 不是合法 JSON") from None
    if not isinstance(data, list):
        raise ShortcutError("ARGS_INVALID", "args 必须是 JSON 数组")
    if len(data) > MAX_ARGS:
        raise ShortcutError("ARGS_INVALID", f"args 最多 {MAX_ARGS} 项")
    for item in data:
        if not isinstance(item, str):
            raise ShortcutError("ARGS_INVALID", "args 每一项都必须是字符串")
        if len(item) > MAX_ARG_LEN:
            raise ShortcutError("ARGS_INVALID", f"单个参数不能超过 {MAX_ARG_LEN} 字符")
        if any(mark in item for mark in _SHELL_META):
            raise ShortcutError("ARGS_INVALID", "参数含 shell 元字符（; && || | > < ` $( 等）")
    return json.dumps(data, ensure_ascii=False, separators=(",", ":"))


def parse_stored_args(raw) -> list[str]:
    """解析库中已存的 args（启动前再走一次同一套校验）。"""
    if not isinstance(raw, str) or not raw.strip():
        return []
    try:
        return json.loads(validate_args(raw))
    except ShortcutError:
        raise
    except (ValueError, TypeError):
        raise ShortcutError("ARGS_INVALID", "库中 args 无法解析") from None


def normalize_hotkey(raw) -> str:
    """把 "ctrl+alt+k" 规范成 "Ctrl+Alt+K"；不合法抛 HOTKEY_INVALID。"""
    if not isinstance(raw, str):
        raise ShortcutError("HOTKEY_INVALID", "快捷键必须是字符串")
    text = raw.strip()
    if not text or len(text) > MAX_HOTKEY:
        raise ShortcutError("HOTKEY_INVALID", f"快捷键需为 1–{MAX_HOTKEY} 个字符")
    parts = [p.strip() for p in text.split("+") if p.strip()]
    if len(parts) < 1:
        raise ShortcutError("HOTKEY_INVALID", "快捷键为空")
    key = parts[-1].upper()
    if not _KEY_RE.match(key):
        raise ShortcutError("HOTKEY_INVALID", "键位仅支持 A–Z、0–9、F1–F12")
    mods = []
    for token in parts[:-1]:
        mod = _MODS.get(token.lower())
        if mod is None or mod in mods:
            raise ShortcutError("HOTKEY_INVALID", "修饰键仅支持 Ctrl / Alt / Shift / Meta，且不可重复")
        mods.append(mod)
    if not any(m in mods for m in ("Ctrl", "Alt", "Meta")) and not key.startswith("F"):
        raise ShortcutError("HOTKEY_INVALID", "快捷键需含 Ctrl / Alt / Meta 之一，或使用 F1–F12")
    ordered = [m for m in _MOD_ORDER if m in mods]
    return "+".join(ordered + [key])


def valid_id(raw) -> bool:
    return isinstance(raw, str) and bool(_ID_RE.match(raw))
