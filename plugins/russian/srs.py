"""
间隔重复算法（SRS）—— 本产品的核心规则层，对应需求文档「层次二」。

所有档位流转逻辑集中于此，修改规则只需改动本文件。

档位:
    A  熟   -> 7 天后复习
    B  半熟 -> 3 天后复习
    C  生   -> 1 天后复习（明天测）
    LONG 长期 -> 30 天后复习

升级:
    C 通过 -> B
    B 通过 -> A
    A 连续通过 N 次 -> LONG  (N = config.A_GRADUATE_THRESHOLD)

降级:
    任意档位失败 -> 降一档 (LONG 失败 -> A)
"""

from datetime import date, timedelta

import config


class Level:
    """档位常量。使用类属性而非 Enum，便于与数据库字符串直接互转。"""
    A = "A"
    B = "B"
    C = "C"
    LONG = "LONG"


# 失败时的降级映射
_DOWNGRADE = {
    Level.LONG: Level.A,
    Level.A: Level.B,
    Level.B: Level.C,
    Level.C: Level.C,
}


def interval_days(level: str) -> int:
    """返回某档位对应的复习间隔天数。"""
    return config.REVIEW_INTERVALS[level]


def next_review(level: str, from_date: date | None = None) -> date:
    """根据档位计算下次复习日期。"""
    base = from_date or date.today()
    return base + timedelta(days=interval_days(level))


def apply_result(level: str, passed: bool, streak_a: int) -> tuple[str, int]:
    """
    应用一次测试结果，返回 (新档位, 新 streak_a)。

    Args:
        level:    当前档位
        passed:   是否通过（True=通过 / False=失败）
        streak_a: 当前 A 档连续通过次数

    Returns:
        (new_level, new_streak_a)
    """
    if passed:
        if level == Level.C:
            return Level.B, 0
        if level == Level.B:
            return Level.A, 0
        if level == Level.A:
            s = streak_a + 1
            if s >= config.A_GRADUATE_THRESHOLD:
                return Level.LONG, 0
            return Level.A, s
        return Level.LONG, 0  # LONG 通过保持 LONG

    # 失败：降一档
    return _DOWNGRADE[level], 0