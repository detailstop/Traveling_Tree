"""插件开发提示词生成：模板解析、占位符校验、写盘（由 market backend 调用）。

模板唯一源：docs/appendix/prompts/plugin-dev-prompt.md。
写盘位置：data/settings.json 的 download_dir（通用下载地址，本地绝对路径）。
"""
from __future__ import annotations

import re
import time
from pathlib import Path

from plugins.market.info import InfoError  # noqa: F401  (保持同插件错误风格)

ROOT = Path(__file__).resolve().parents[2]
TEMPLATE = ROOT / "docs" / "appendix" / "prompts" / "plugin-dev-prompt.md"
ID_RE = re.compile(r"^[a-z][a-z0-9_]{1,31}$")

PLACEHOLDER_META = {
    "PLUGIN_ID": ("插件 id", "小写字母/数字/下划线，与目录名一致", "demo"),
    "PLUGIN_NAME": ("显示名", "卡片或插件显示名", "演示插件"),
    "PLUGIN_KIND": ("插件类型", "functional / library", "functional"),
    "HAS_UI": ("是否有前端卡片", "是 / 否", "是"),
    "ENTRY_OR_BACKEND": ("入口形态", "feature.js 或 backend.py（entries=[]）", "feature.js"),
    "DEPENDS_ON_LIB": ("依赖的底层插件", "如 webchat；无则填 无", "无"),
    "NEEDS_DB": ("是否需要业务表", "是 / 否", "否"),
    "NEEDS_DATA_DIR": ("是否需要独立数据目录", "是 / 否", "否"),
    "PROVIDES": ("对外能力", "如 [\"tts\"]；无则填 无", "无"),
    "TARGET_DIR": ("落地目录", "默认 plugins/<id>/", "plugins/demo/"),
}


class ScaffoldError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def read_template() -> str:
    if not TEMPLATE.is_file():
        raise ScaffoldError("template_missing", f"模板不存在：{TEMPLATE}")
    return TEMPLATE.read_text(encoding="utf-8")


def placeholders(template: str | None = None) -> list[str]:
    text = template if template is not None else read_template()
    seen: list[str] = []
    for name in re.findall(r"\{\{([A-Za-z0-9_]+)\}\}", text):
        if name not in seen:
            seen.append(name)
    return seen


def fields() -> list[dict]:
    out = []
    for key in placeholders():
        label, hint, example = PLACEHOLDER_META.get(key, (key, "", ""))
        out.append({"key": key, "label": label, "hint": hint,
                    "example": example, "multiline": False, "required": True})
    return out


def render(values: dict, template: str | None = None) -> str:
    text = template if template is not None else read_template()
    keys = placeholders(text)
    missing = [k for k in keys if not str(values.get(k) or "").strip()]
    if missing:
        raise ScaffoldError("missing_values", "缺少参数：" + ", ".join(missing))
    for key in keys:
        text = text.replace("{{" + key + "}}", str(values[key]))
    leftover = sorted(set(re.findall(r"\{\{[A-Za-z0-9_]+\}\}", text)))
    if leftover:
        raise ScaffoldError("leftover_placeholder", "仍有未替换占位符：" + ", ".join(leftover))
    return text


def output_dir() -> Path | None:
    from modules import settings_store
    value = str(settings_store.read().get("download_dir") or "").strip()
    if not value:
        return None
    return Path(value).expanduser()


def generate(pid: str, values: dict) -> dict:
    pid = str(pid or "").strip()
    if not ID_RE.fullmatch(pid):
        raise ScaffoldError("bad_id", "插件 id 不合法（小写字母开头，字母/数字/下划线）")
    out = output_dir()
    if out is None:
        raise ScaffoldError("not_configured", "未设置通用下载地址：请到设置页填写本地绝对路径")
    if not out.is_absolute():
        raise ScaffoldError("not_absolute", "通用下载地址必须是绝对路径")
    if not out.is_dir():
        raise ScaffoldError("dir_missing", f"通用下载地址不存在：{out}")
    text = render(values)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    name = f"scaffold-{pid}-{stamp}.md"
    target = out / name
    n = 2
    while target.exists():
        target = out / f"scaffold-{pid}-{stamp}-{n}.md"
        n += 1
    try:
        target.write_text(text, encoding="utf-8", newline="\n")
    except OSError as exc:
        raise ScaffoldError("write_failed", f"写入失败：{exc}") from exc
    return {"path": str(target.resolve()), "filename": target.name}
