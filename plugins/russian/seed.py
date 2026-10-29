"""
种子内容库（russian 插件私有）。

用于首次创建数据库时初始化演示数据。后续可通过 Web UI 或
repository.add_item 扩充。每条记录包含 item_type / russian / chinese / theme。
"""

from plugins.russian.models import Item
from plugins.russian import repo

# 主题注册
THEMES = {
    "daily": ["课堂救场", "自我介绍", "购物", "餐厅", "问路"],
    "academic": ["通用学术术语", "通用学术句式"],
}

SEED_ITEMS: list[Item] = [
    # ---------- 日常：课堂救场 ----------
    Item(None, "daily", "Извините, я не совсем понял(а).", "对不起，我不太明白。", "课堂救场"),
    Item(None, "daily", "Повторите, пожалуйста, медленнее.", "请说慢一点，重复一遍。", "课堂救场"),
    Item(None, "daily", "Что вы имеете в виду?", "您指的是什么？", "课堂救场"),
    Item(None, "daily", "Можно ещё раз?", "可以再来一遍吗？", "课堂救场"),
    Item(None, "daily", "Объясните, пожалуйста, ещё раз.", "请再解释一遍。", "课堂救场"),
    Item(None, "daily", "Что значит это слово?", "这个词是什么意思？", "课堂救场"),
    Item(None, "daily", "Можно вопрос?", "可以问个问题吗？", "课堂救场"),
    Item(None, "daily", "Я хотел(а) бы уточнить.", "我想确认一下。", "课堂救场"),
    Item(None, "daily", "Это связано с...?", "这和……有关吗？", "课堂救场"),
    Item(None, "daily", "Приведите пример, пожалуйста.", "请举个例子。", "课堂救场"),

    # ---------- 日常：自我介绍 ----------
    Item(None, "daily", "Меня зовут...", "我叫……", "自我介绍"),
    Item(None, "daily", "Я из Китая.", "我来自中国。", "自我介绍"),
    Item(None, "daily", "Я изучаю русский язык.", "我在学俄语。", "自我介绍"),
    Item(None, "daily", "Я плохо говорю по-русски.", "我俄语说得不好。", "自我介绍"),
    Item(None, "daily", "Очень приятно.", "很高兴认识您。", "自我介绍"),

    # ---------- 日常：购物 ----------
    Item(None, "daily", "Сколько стоит?", "多少钱？", "购物"),
    Item(None, "daily", "Дайте, пожалуйста, ...", "请给我……", "购物"),
    Item(None, "daily", "У вас есть ...?", "您有……吗？", "购物"),
    Item(None, "daily", "Я беру это.", "我买这个。", "购物"),

    # ---------- 学术：术语 ----------
    Item(None, "term", "исследование", "研究", "通用学术术语"),
    Item(None, "term", "анализ", "分析", "通用学术术语"),
    Item(None, "term", "результат", "结果", "通用学术术语"),
    Item(None, "term", "метод", "方法", "通用学术术语"),
    Item(None, "term", "проблема", "问题", "通用学术术语"),
    Item(None, "term", "гипотеза", "假设", "通用学术术语"),
    Item(None, "term", "вывод", "结论", "通用学术术语"),
    Item(None, "term", "данные", "数据", "通用学术术语"),

    # ---------- 学术：句式 ----------
    Item(None, "pattern", "Что такое ...?", "……是什么？", "通用学术句式"),
    Item(None, "pattern", "Это связано с ...", "这与……有关。", "通用学术句式"),
    Item(None, "pattern", "С одной стороны..., с другой стороны...", "一方面……另一方面……", "通用学术句式"),
    Item(None, "pattern", "В заключение хочу сказать...", "最后我想说……", "通用学术句式"),
    Item(None, "pattern", "Приведите пример.", "请举例。", "通用学术句式"),
]


def load_seed() -> int:
    """导入种子内容，返回新增条目数。重复导入不会产生重复（按 russian 去重）。"""
    conn_existing = {i.russian for i in repo.list_items()}
    added = 0

    for cat, names in THEMES.items():
        for n in names:
            repo.add_theme(n, cat)

    for item in SEED_ITEMS:
        if item.russian in conn_existing:
            continue
        repo.add_item(item)
        added += 1
    # 为无标签条目回填简短标签（优先主题，其次俄语前 12 字符），幂等
    conn = repo.get_conn()
    conn.execute(
        "UPDATE items SET tag = COALESCE(NULLIF(theme, ''), substr(russian, 1, 12)) "
        "WHERE tag IS NULL OR tag = ''"
    )
    conn.commit()
    return added