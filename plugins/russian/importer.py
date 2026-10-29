"""
批量导入模块。

用于把 AI（或其他来源）按规则生成的「当天知识点」批量写入数据库。
支持三种格式，自动识别：

1) Markdown 表格（推荐，AI 最易生成）：五列，首行表头 + --- 分隔行 + 数据行
   | 句式  | 例句  | 翻译  | 主题  | 标签  |
   | --- | --- | --- | --- | --- |
   | Повторите, пожалуйста. | 请再说一遍。 | 课堂救场 | 课堂救场-请求重复 |
   - 按表头名映射字段（列名可中英混用，顺序不限）：
     句式/俄语 → 句式；例句/示例 → 例句；翻译/中文 → 翻译；
     主题 → 主题；标签 → 标签；类型/类型(可选) → 类型（默认 daily）
   - 无「类型」列时，所有条目默认「日常用语」类型。

2) 管道分隔文本（兼容旧格式）：每行一条，字段以 | 分隔
   俄语 | 中文 | 类型 | 主题 | 示例 | 标签
   - 类型可省略，默认 daily；可写 daily/term/pattern 或 日常/术语/句式
   - # 开头为注释，空行忽略

3) JSON 格式：顶层为数组，每项含 russian/chinese/item_type/theme/notes/tag
   示例：[{"russian": "...", "chinese": "...", "item_type": "daily", "tag": "短语-问候"}]

解析结果为 (items, errors)：errors 为被跳过的行说明，不影响其余条目导入。
"""

import json

from plugins.russian.models import Item

VALID_TYPES = {"daily", "term", "pattern"}
_TYPE_ALIAS = {
    "日常": "daily", "术语": "term", "句式": "pattern",
    "d": "daily", "t": "term", "p": "pattern",
    "daily": "daily", "term": "term", "pattern": "pattern",
}

# Markdown 表头名 → Item 字段（支持中英混用）
_HEADER_MAP = {
    "句式": "russian", "俄语": "russian", "russian": "russian",
    "例句": "notes", "示例": "notes", "notes": "notes",
    "翻译": "chinese", "中文": "chinese", "chinese": "chinese",
    "主题": "theme", "theme": "theme",
    "标签": "tag", "tag": "tag",
    "类型": "item_type", "item_type": "item_type",
}


def normalize_type(raw) -> str | None:
    """把类型标签归一化为 daily/term/pattern；无法识别返回 None。"""
    s = (raw or "").strip().lower()
    if not s:
        return "daily"
    return _TYPE_ALIAS.get(s)


# ============================================================
# 格式 1：Markdown 表格
# ============================================================

def _split_row(line: str) -> list[str]:
    """去掉行首尾的 |，按 | 切分单元格。"""
    s = line.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    return [c.strip() for c in s.split("|")]


def _is_sep_row(line: str) -> bool:
    """是否为 Markdown 分隔行（如 | --- | --- |）。"""
    cells = _split_row(line)
    if not cells:
        return False
    return all(set(c) <= set(":-") and "-" in c for c in cells)


def _looks_like_table(text: str) -> bool:
    """粗检：是否存在「表头 + 分隔行」。"""
    lines = [l for l in text.splitlines() if l.strip()]
    for i in range(len(lines) - 1):
        if lines[i].lstrip().startswith("|") and _is_sep_row(lines[i + 1]):
            return True
    return False


def parse_table(text: str) -> tuple[list[Item], list[str]]:
    """解析 Markdown 表格格式。返回 (items, errors)。"""
    items: list[Item] = []
    errors: list[str] = []
    lines = text.splitlines()
    i, n = 0, len(lines)
    while i < n:
        line = lines[i].strip()
        if line.startswith("|") and i + 1 < n and _is_sep_row(lines[i + 1]):
            header = _split_row(line)
            col_map: dict[str, int] = {}
            for ci, name in enumerate(header):
                field = _HEADER_MAP.get(name.strip())
                if field:
                    col_map[field] = ci
            i += 2  # 跳过表头与分隔行

            def cell(field: str) -> str:
                idx = col_map.get(field)
                return cells[idx].strip() if idx is not None and idx < len(cells) else ""

            while i < n:
                d = lines[i].strip()
                if d.startswith("|"):
                    cells = _split_row(d)
                    ru, zh = cell("russian"), cell("chinese")
                    if not ru or not zh:
                        errors.append(f"表格第{i + 1}行：缺少句式或翻译，已跳过。")
                        i += 1
                        continue
                    item_type = normalize_type(cell("item_type") or "daily")
                    if item_type is None:
                        errors.append(f"表格第{i + 1}行：未知类型，已跳过。")
                        i += 1
                        continue
                    items.append(Item(None, item_type, ru, zh,
                                      cell("theme") or None,
                                      cell("notes") or None,
                                      cell("tag") or None))
                    i += 1
                elif not d:
                    i += 1
                else:
                    break  # 遇到非表格行，回到外层继续扫描
        else:
            i += 1
    return items, errors


# ============================================================
# 格式 2：管道分隔文本（兼容旧格式）
# ============================================================

def parse_text(text: str) -> tuple[list[Item], list[str]]:
    """解析管道分隔的文本格式。返回 (items, errors)。"""
    items: list[Item] = []
    errors: list[str] = []
    for ln_no, raw in enumerate(text.splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [p.strip() for p in line.split("|")]
        russian, chinese = parts[0], parts[1] if len(parts) > 1 else ""
        if not russian or not chinese:
            errors.append(f"第{ln_no}行：缺少俄语或中文，已跳过。")
            continue
        item_type = normalize_type(parts[2]) if len(parts) > 2 else "daily"
        if item_type is None:
            errors.append(f"第{ln_no}行：未知类型「{parts[2]}」，已跳过。")
            continue
        theme = parts[3] if len(parts) > 3 and parts[3] else None
        notes = parts[4] if len(parts) > 4 and parts[4] else None
        tag = parts[5] if len(parts) > 5 and parts[5] else None
        items.append(Item(None, item_type, russian, chinese, theme, notes, tag))
    return items, errors


# ============================================================
# 格式 3：JSON
# ============================================================

def parse_json(text: str) -> tuple[list[Item], list[str]]:
    """解析 JSON 数组格式。返回 (items, errors)。"""
    try:
        data = json.loads(text)
    except Exception as exc:
        return [], [f"JSON 解析失败：{exc}"]
    if not isinstance(data, list):
        return [], ["JSON 顶层应为数组（[...]）。"]

    items: list[Item] = []
    errors: list[str] = []
    for i, obj in enumerate(data, 1):
        if not isinstance(obj, dict):
            errors.append(f"第{i}项：不是对象，已跳过。")
            continue
        russian = (obj.get("russian") or obj.get("俄语") or "").strip()
        chinese = (obj.get("chinese") or obj.get("中文") or "").strip()
        if not russian or not chinese:
            errors.append(f"第{i}项：缺少俄语或中文，已跳过。")
            continue
        item_type = normalize_type(obj.get("item_type") or obj.get("类型") or "daily")
        if item_type is None:
            errors.append(f"第{i}项：未知类型「{obj.get('item_type')}」，已跳过。")
            continue
        theme = obj.get("theme") or obj.get("主题")
        notes = obj.get("notes") or obj.get("示例")
        tag = obj.get("tag") or obj.get("标签")
        items.append(Item(None, item_type, russian, chinese, theme, notes, tag))
    return items, errors


def parse(text: str) -> tuple[list[Item], list[str]]:
    """自动识别 Markdown 表格 / JSON / 管道分隔文本格式并解析。"""
    stripped = text.lstrip()
    if stripped.startswith(("[", "{")):
        return parse_json(text)
    if _looks_like_table(text):
        return parse_table(text)
    return parse_text(text)
