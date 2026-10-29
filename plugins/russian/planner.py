"""
每日计划生成器 —— 旅行之木学习核心。

每天固定三块：
  1. 日常用语
  2. 学术用语
  3. 中俄互译（复习 + 输出）

本模块只负责「选出今天该学/该测的内容」，具体展示与交互由插件 feature 负责。
"""

from datetime import date

import config
from plugins.russian import repo


def _allocate(total: int, weights: dict, avail: dict) -> dict:
    """把新学总配额分配到三种类型。
    - 只把额度给「当前有可用新条目」的类型，并按权重分配；
    - 单类型不超过其可用数 avail，剩余额度补给还有余量的类型。
    """
    order = ("daily", "term", "pattern")
    result = {k: 0 for k in order}
    active = [k for k in order if avail[k] > 0]
    if not active:
        return result
    wsum = sum(weights[k] for k in active)
    for k in active:
        result[k] = min(avail[k], int(total * weights[k] / wsum)) if wsum else 0
    left = total - sum(result.values())
    i = 0
    while left > 0 and i < 200:  # 补给还有余量的类型
        k = active[i % len(active)]
        if result[k] < avail[k]:
            result[k] += 1
            left -= 1
        i += 1
    return result


def pick_new_items(theme: str) -> dict:
    """
    挑选今天要学的新内容。
    统一使用一个主题（同一大类）；按 config.DAILY_NEW_QUOTA 总数，
    依 config.NEW_TYPE_WEIGHTS 权重分配到 daily/term/pattern 三块。
    配额只分给「当前确有新条目」的类型，多余额度补给有余量的类型，
    因此只有一种类型有货时，配额会全部落到该类型。

    Returns:
        {
          'daily':   [Item, ...],
          'term':    [Item, ...],
          'pattern': [Item, ...],
        }
    """
    total = max(0, int(config.DAILY_NEW_QUOTA))

    def _fresh(item_type: str):
        # 条目与状态一次 JOIN 读取，避免候选条目逐个查询复习状态。
        return [item for item, stat in repo.list_items_with_stats(item_type=item_type, theme=theme)
                if stat and stat.total_reviews == 0]

    pools = {t: _fresh(t) for t in ("daily", "term", "pattern")}
    quotas = _allocate(total, config.NEW_TYPE_WEIGHTS, {t: len(pools[t]) for t in pools})
    return {t: pools[t][: quotas[t]] for t in pools}


def build_daily_plan(theme: str) -> dict:
    """
    组装一份完整的今日计划（单一主题）。
    到期复习按 config.DAILY_REVIEW_QUOTA 限制每日复习数量。

    Returns:
        {
          'date': str,
          'due': [(Item, ItemStat), ...],   # 今日到期复习（截取配额）
          'new': {'daily': [...], 'term': [...], 'pattern': [...]},
        }
    """
    return {
        "date": date.today().isoformat(),
        "due": repo.list_due_items()[: max(0, int(config.DAILY_REVIEW_QUOTA))],
        "new": pick_new_items(theme),
    }
