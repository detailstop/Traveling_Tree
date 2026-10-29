"""领域数据模型。纯数据结构，不包含业务逻辑。"""

from dataclasses import dataclass
from datetime import date


@dataclass
class Item:
    """一条学习条目。"""
    id: int | None
    item_type: str          # 'daily' | 'term' | 'pattern'
    russian: str
    chinese: str
    theme: str | None = None
    notes: str | None = None
    tag: str | None = None          # 标签：简短表述，用于知识库树形显示
    created_at: str | None = None   # 入库时间（DB 原值，YYYY-MM-DD 或 datetime）


@dataclass
class ItemStat:
    """条目的记忆状态。"""
    item_id: int
    level: str              # 'A' | 'B' | 'C' | 'LONG'
    streak_a: int
    last_review: date | None
    next_review: date
    total_reviews: int
    correct_reviews: int