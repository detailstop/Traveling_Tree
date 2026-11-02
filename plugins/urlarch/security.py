"""urlarch R4 安全校验：白名单条目的名称/路径/参数校验（纯函数，无副作用）。

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

_ID_RE = re.compile(r"^us_[0-9a-f]{16}$")
_GROUP_ID_RE = re.compile(r"^ug_[0-9a-f]{16}$")


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


def sanitize_hotkey(raw) -> str:
    """hotkey 字段可选：只做基础清洗（长度/控制字符），不校验组合格式、不检查冲突。

    该列是 R3 建表时的历史字段，schema 本轮不改；快捷入口为点击启动，hotkey 不参与逻辑。
    """
    if raw is None:
        return ""
    if not isinstance(raw, str):
        raise ShortcutError("HOTKEY_INVALID", "hotkey 必须是字符串")
    text = raw.strip()
    if len(text) > MAX_HOTKEY:
        raise ShortcutError("HOTKEY_INVALID", f"hotkey 不能超过 {MAX_HOTKEY} 字符")
    if any(ch in text for ch in "\r\n\t\0"):
        raise ShortcutError("HOTKEY_INVALID", "hotkey 不能包含控制字符")
    return text


def validate_group_name(raw) -> str:
    """软件快捷入口组别名：1–64 字符，不允许控制字符与纯空白。"""
    if not isinstance(raw, str):
        raise ShortcutError("GROUP_NAME_INVALID", "组别名必须是字符串")
    name = raw.strip()
    if not name or len(name) > MAX_NAME:
        raise ShortcutError("GROUP_NAME_INVALID", f"组别名需为 1–{MAX_NAME} 个字符")
    if any(ch in name for ch in "\r\n\t\0"):
        raise ShortcutError("GROUP_NAME_INVALID", "组别名不能包含换行或制表符")
    return name


def validate_sort_order(raw) -> int:
    """排序值可选：非整数按 0 处理，范围 0–9999（新建组用）。"""
    if raw is None or raw == "":
        return 0
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return 0
    return max(0, min(9999, value))


def validate_sort_order_strict(raw) -> int:
    """PATCH 调序用：必须是 -10000~10000 的整数，否则 SORT_ORDER_INVALID(400)。"""
    if isinstance(raw, bool) or not isinstance(raw, int):
        raise ShortcutError("SORT_ORDER_INVALID", "sort_order 必须是整数")
    if raw < -10000 or raw > 10000:
        raise ShortcutError("SORT_ORDER_INVALID", "sort_order 需在 -10000~10000 之间")
    return raw


def valid_id(raw) -> bool:
    return isinstance(raw, str) and bool(_ID_RE.match(raw))


def valid_group_id(raw) -> bool:
    return isinstance(raw, str) and bool(_GROUP_ID_RE.match(raw))


# ---------------- 卡片图片（round 105） ----------------
# 图片只存本地文件（data/plugins/urlarch/images/），库里只存文件名；
# 上传必须同时满足：扩展名白名单 + 文件头 magic + 大小上限，文件名一律后端生成。

MAX_IMAGE_BYTES = 2 * 1024 * 1024
IMAGE_EXTENSIONS = ("png", "jpg", "jpeg", "webp", "gif")
IMAGE_MIME = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
              "webp": "image/webp", "gif": "image/gif"}
_IMAGE_NAME_RE = re.compile(r"^img_[0-9a-f]{16}\.(?:png|jpg|jpeg|webp|gif)$")


def valid_image_name(raw) -> bool:
    return isinstance(raw, str) and bool(_IMAGE_NAME_RE.match(raw))


def validate_image_name(raw) -> str:
    """条目上的 image 字段：空串（无图）或后端生成的图片文件名；不接受任何路径。"""
    if raw is None:
        return ""
    if not isinstance(raw, str):
        raise ShortcutError("IMAGE_INVALID", "image 必须是文件名或空串")
    text = raw.strip()
    if not text:
        return ""
    if not _IMAGE_NAME_RE.match(text):
        raise ShortcutError("IMAGE_INVALID", "image 必须是后端生成的图片文件名")
    return text


def image_extension(filename) -> str:
    """按扩展名白名单取小写扩展名；非法 → IMAGE_TYPE_INVALID。"""
    if not isinstance(filename, str):
        raise ShortcutError("IMAGE_TYPE_INVALID", "缺少文件名")
    name = filename.strip().replace("\\", "/").split("/")[-1]
    if "." not in name:
        raise ShortcutError("IMAGE_TYPE_INVALID", "图片需要扩展名（png/jpg/jpeg/webp/gif）")
    ext = name.rsplit(".", 1)[1].lower()
    if ext not in IMAGE_EXTENSIONS:
        raise ShortcutError("IMAGE_TYPE_INVALID", "仅支持 png/jpg/jpeg/webp/gif")
    return "jpeg" if ext == "jpg" else ext


def validate_image_bytes(ext: str, data: bytes) -> None:
    """文件头 magic 校验；扩展名与内容不一致 → IMAGE_HEADER_INVALID。"""
    if not data:
        raise ShortcutError("IMAGE_HEADER_INVALID", "图片内容为空")
    head = data[:16]
    if ext == "png" and not head.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ShortcutError("IMAGE_HEADER_INVALID", "文件头与 .png 不符")
    if ext == "jpeg" and not head.startswith(b"\xff\xd8\xff"):
        raise ShortcutError("IMAGE_HEADER_INVALID", "文件头与 .jpg 不符")
    if ext == "gif" and head[:6] not in (b"GIF87a", b"GIF89a"):
        raise ShortcutError("IMAGE_HEADER_INVALID", "文件头与 .gif 不符")
    if ext == "webp" and not (head[:4] == b"RIFF" and head[8:12] == b"WEBP"):
        raise ShortcutError("IMAGE_HEADER_INVALID", "文件头与 .webp 不符")


def image_mime(name: str) -> str:
    ext = name.rsplit(".", 1)[-1].lower()
    return IMAGE_MIME.get("jpeg" if ext == "jpg" else ext, "application/octet-stream")


def validate_link_title(raw) -> str:
    """网址卡名称：可空，≤200 字符，不允许控制字符。"""
    if not isinstance(raw, str):
        raise ShortcutError("NAME_INVALID", "名称必须是字符串")
    title = raw.strip()
    if len(title) > 200:
        raise ShortcutError("NAME_INVALID", "名称不能超过 200 字符")
    if any(ch in title for ch in "\r\n\t\0"):
        raise ShortcutError("NAME_INVALID", "名称不能包含控制字符")
    return title


def validate_link_url(raw) -> str:
    """网址卡 URL：仅 http/https，长度受限，拒绝控制字符与空白。"""
    if not isinstance(raw, str):
        raise ShortcutError("URL_INVALID", "网址必须是字符串")
    url = raw.strip()
    if not url or len(url) > 2048:
        raise ShortcutError("URL_INVALID", "网址需为 1–2048 个字符")
    if any(ch in url for ch in "\r\n\t\0 "):
        raise ShortcutError("URL_INVALID", "网址不能包含空白或控制字符")
    low = url.lower()
    if not (low.startswith("http://") or low.startswith("https://")):
        raise ShortcutError("URL_INVALID", "网址需以 http:// 或 https:// 开头")
    if len(low.split("://", 1)[1].split("/", 1)[0]) < 1:
        raise ShortcutError("URL_INVALID", "网址缺少主机名")
    return url
