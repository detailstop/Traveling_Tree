"""russian 插件数据访问层。

只拥有 items / item_stats / review_logs / daily_logs / themes 五张学习表；
SQL 集中在本文件，backend.py 与 seed.py 不直接拼 SQL。
"""

from datetime import date, datetime, timedelta
import json

import config
from db.connection import get_conn
from plugins.russian.models import Item, ItemStat
from plugins.russian import srs


def _json_text(data: dict) -> str:
    return json.dumps(data, ensure_ascii=False, default=str)


def _refresh_live(conn, table: str, key_col: str, key_val) -> None:
    """把当前行业务列写成 live_json 快照（raw_json 保留插入时快照）。"""
    row = conn.execute(f"SELECT * FROM {table} WHERE {key_col}=?", (key_val,)).fetchone()
    if not row:
        return
    data = {k: row[k] for k in row.keys() if k not in ("raw_json", "live_json")}
    conn.execute(f"UPDATE {table} SET live_json=? WHERE {key_col}=?",
                 (_json_text(data), key_val))


def _refresh_items_by_theme(conn, theme: str) -> None:
    """主题级联后刷新该主题下 items.live_json（raw 保留插入快照）。"""
    for row in conn.execute("SELECT id FROM items WHERE theme=?", (theme,)).fetchall():
        _refresh_live(conn, "items", "id", row["id"])


# ============================================================
# items
# ============================================================

def _theme_default_type(conn, theme: str) -> str | None:
    """取主题已登记的默认类型；主题不存在返回 None。"""
    row = conn.execute("SELECT default_type FROM themes WHERE name=?", (theme,)).fetchone()
    return (row["default_type"] or "daily") if row else None


def _register_theme(conn, theme: str, item_type: str) -> None:
    """注册新主题（默认类型取条目类型）。"""
    conn.execute(
        "INSERT OR IGNORE INTO themes (name, category, default_type) VALUES (?, 'daily', ?)",
        (theme, item_type),
    )


def add_item(item: Item) -> int:
    """插入一条学习条目，同时初始化其 item_stats（默认 C 档，明天复习）。
    主题已存在时，条目类型归并到该主题的默认类型；新主题则按条目类型注册。"""
    conn = get_conn()
    eff_type = item.item_type
    if item.theme:
        dt = _theme_default_type(conn, item.theme)
        if dt is not None:
            eff_type = dt          # 主题已存在：类型归并到主题
        else:
            _register_theme(conn, item.theme, item.item_type)
    payload = _json_text({"item_type": eff_type, "russian": item.russian, "chinese": item.chinese,
                          "theme": item.theme, "notes": item.notes, "tag": item.tag})
    cur = conn.execute(
        "INSERT INTO items (item_type, russian, chinese, theme, notes, tag, raw_json, live_json) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (eff_type, item.russian, item.chinese, item.theme, item.notes, item.tag, payload, payload),
    )
    item_id = cur.lastrowid
    stats_payload = _json_text({"item_id": item_id, "level": "C",
                                "next_review": srs.next_review(srs.Level.C).isoformat()})
    conn.execute(
        "INSERT INTO item_stats (item_id, level, next_review, raw_json) VALUES (?, 'C', ?, ?)",
        (item_id, srs.next_review(srs.Level.C).isoformat(), stats_payload),
    )
    conn.commit()
    return item_id


def add_items_bulk(items: list[Item]) -> int:
    """
    批量插入条目（单事务），返回实际新增条数。

    按 russian 去重：与库内已有条目重复、以及本次批次内重复的都会被跳过。
    主题已存在时，条目类型归并到该主题的默认类型；新主题则按条目类型注册。
    """
    conn = get_conn()
    theme_types = {r["name"]: (r["default_type"] or "daily")
                   for r in conn.execute("SELECT name, default_type FROM themes")}
    existing = {r for (r,) in conn.execute("SELECT russian FROM items")}
    seen: set[str] = set()
    added = 0
    cur = conn.cursor()
    for item in items:
        if item.russian in existing or item.russian in seen:
            continue
        seen.add(item.russian)
        eff_type = item.item_type
        if item.theme:
            if item.theme in theme_types:
                eff_type = theme_types[item.theme]   # 归并到主题类型
            else:
                theme_types[item.theme] = item.item_type
                _register_theme(conn, item.theme, item.item_type)
        payload = _json_text({"item_type": eff_type, "russian": item.russian, "chinese": item.chinese,
                              "theme": item.theme, "notes": item.notes, "tag": item.tag})
        cur.execute(
            "INSERT INTO items (item_type, russian, chinese, theme, notes, tag, raw_json, live_json) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (eff_type, item.russian, item.chinese, item.theme, item.notes, item.tag, payload, payload),
        )
        item_id = cur.lastrowid
        stats_payload = _json_text({"item_id": item_id, "level": "C",
                                    "next_review": srs.next_review(srs.Level.C).isoformat()})
        cur.execute(
            "INSERT INTO item_stats (item_id, level, next_review, raw_json) VALUES (?, 'C', ?, ?)",
            (item_id, srs.next_review(srs.Level.C).isoformat(), stats_payload),
        )
        added += 1
    conn.commit()
    return added


def update_item(item_id: int, item: Item) -> None:
    """更新条目的内容字段（类型/俄语/中文/主题/备注/标签）。主题若为新名则自动注册。"""
    conn = get_conn()
    if item.theme:
        _register_theme(conn, item.theme, item.item_type)
    payload = _json_text({"item_type": item.item_type, "russian": item.russian, "chinese": item.chinese,
                          "theme": item.theme, "notes": item.notes, "tag": item.tag})
    conn.execute(
        "UPDATE items SET item_type=?, russian=?, chinese=?, theme=?, notes=?, tag=?, live_json=? "
        "WHERE id=?",
        (item.item_type, item.russian, item.chinese, item.theme, item.notes, item.tag, payload, item_id),
    )
    conn.commit()


def delete_item(item_id: int) -> None:
    """删除条目及其关联的记忆状态与复习流水（外键级联）。"""
    conn = get_conn()
    conn.execute("DELETE FROM items WHERE id=?", (item_id,))
    conn.commit()


def set_item_type(item_id: int, item_type: str) -> None:
    """调整条目的内容类型（daily/term/pattern）。"""
    conn = get_conn()
    conn.execute("UPDATE items SET item_type=? WHERE id=?", (item_type, item_id))
    _refresh_live(conn, "items", "id", item_id)
    conn.commit()


def set_item_created_date(item_id: int, iso_date: str) -> None:
    """调整条目的入库日期（用于知识库按日/周重新归档）。"""
    conn = get_conn()
    conn.execute(
        "UPDATE items SET created_at=? WHERE id=?",
        (f"{iso_date} 00:00:00", item_id),
    )
    _refresh_live(conn, "items", "id", item_id)
    conn.commit()


def get_item(item_id: int) -> Item | None:
    """按 ID 取条目。"""
    row = get_conn().execute("SELECT * FROM items WHERE id=?", (item_id,)).fetchone()
    return _row_to_item(row) if row else None


def list_items(item_type: str | None = None, theme: str | None = None) -> list[Item]:
    """按类型/主题筛选条目，参数为 None 时忽略该条件。"""
    sql = "SELECT * FROM items WHERE 1=1"
    args: list = []
    if item_type:
        sql += " AND item_type=?"
        args.append(item_type)
    if theme:
        sql += " AND theme=?"
        args.append(theme)
    rows = get_conn().execute(sql, args).fetchall()
    return [_row_to_item(r) for r in rows]


def list_items_with_stats(item_type: str | None = None, theme: str | None = None) -> list[tuple[Item, ItemStat | None]]:
    """批量读取条目与复习状态，避免界面 API 对每个条目单独查询状态。"""
    sql = (
        "SELECT i.*, s.item_id, s.level, s.streak_a, s.last_review, s.next_review, "
        "s.total_reviews, s.correct_reviews FROM items i "
        "LEFT JOIN item_stats s ON s.item_id=i.id WHERE 1=1"
    )
    args: list = []
    if item_type:
        sql += " AND i.item_type=?"
        args.append(item_type)
    if theme:
        sql += " AND i.theme=?"
        args.append(theme)
    rows = get_conn().execute(sql, args).fetchall()
    return [(_row_to_item(r), _row_to_stat(r) if r["item_id"] is not None else None) for r in rows]


def get_stats(item_ids: list[int]) -> dict[int, ItemStat]:
    """一次查询多条目的复习状态。"""
    ids = list(dict.fromkeys(int(i) for i in item_ids if i is not None))
    if not ids:
        return {}
    marks = ",".join("?" for _ in ids)
    rows = get_conn().execute(
        f"SELECT * FROM item_stats WHERE item_id IN ({marks})", ids
    ).fetchall()
    stats = [_row_to_stat(r) for r in rows]
    return {s.item_id: s for s in stats}


def theme_item_counts() -> dict[str, int]:
    """按主题聚合条目数量，避免逐主题扫描条目表。"""
    rows = get_conn().execute(
        "SELECT theme, COUNT(*) AS n FROM items GROUP BY theme"
    ).fetchall()
    return {r["theme"]: r["n"] for r in rows if r["theme"] is not None}


# ============================================================
# item_stats
# ============================================================

def get_stat(item_id: int) -> ItemStat | None:
    """取某条目的记忆状态。"""
    row = get_conn().execute(
        "SELECT * FROM item_stats WHERE item_id=?", (item_id,)
    ).fetchone()
    return _row_to_stat(row) if row else None


def list_due_items(on_date: date | None = None) -> list[tuple[Item, ItemStat]]:
    """
    取出所有到期需复习的条目。
    到期定义：next_review <= on_date（默认今天）。
    """
    d = (on_date or date.today()).isoformat()
    rows = get_conn().execute(
        "SELECT i.*, s.level, s.streak_a, s.last_review, s.next_review, "
        "       s.total_reviews, s.correct_reviews "
        "FROM items i JOIN item_stats s ON i.id = s.item_id "
        "WHERE s.next_review <= ? "
        "ORDER BY s.next_review, s.level",
        (d,),
    ).fetchall()
    result = []
    for r in rows:
        item = _row_to_item(r)
        stat = ItemStat(
            item_id=r["id"],
            level=r["level"],
            streak_a=r["streak_a"],
            last_review=_parse_date(r["last_review"]),
            next_review=_parse_date(r["next_review"]),
            total_reviews=r["total_reviews"],
            correct_reviews=r["correct_reviews"],
        )
        result.append((item, stat))
    return result


def record_review(item_id: int, passed: bool) -> tuple[str, str]:
    """
    记录一次复习结果，按 SRS 规则更新档位与下次复习日期。

    Returns:
        (old_level, new_level)  便于调用方展示变化
    """
    conn = get_conn()
    stat = get_stat(item_id)
    if stat is None:
        raise ValueError(f"item_stats 不存在: item_id={item_id}")

    old_level = stat.level
    new_level, new_streak = srs.apply_result(stat.level, passed, stat.streak_a)
    today = date.today()

    conn.execute(
        "UPDATE item_stats SET level=?, streak_a=?, last_review=?, next_review=?, "
        "total_reviews=total_reviews+1, correct_reviews=correct_reviews+? "
        "WHERE item_id=?",
        (
            new_level,
            new_streak,
            today.isoformat(),
            srs.next_review(new_level, today).isoformat(),
            1 if passed else 0,
            item_id,
        ),
    )
    log_payload = _json_text({"item_id": item_id, "result": 1 if passed else 0,
                              "old_level": old_level, "new_level": new_level})
    conn.execute(
        "INSERT INTO review_logs (item_id, result, old_level, new_level, raw_json, live_json) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (item_id, 1 if passed else 0, old_level, new_level, log_payload, log_payload),
    )
    conn.commit()
    return old_level, new_level


def stats_summary() -> dict:
    """返回各档位数量与总条目数，用于 stats 命令。"""
    conn = get_conn()
    rows = conn.execute(
        "SELECT level, COUNT(*) AS n FROM item_stats GROUP BY level"
    ).fetchall()
    by_level = {r["level"]: r["n"] for r in rows}
    total = conn.execute("SELECT COUNT(*) AS n FROM items").fetchone()["n"]
    return {"total": total, "by_level": by_level}


def stats_by_type() -> dict[str, int]:
    """各内容类型（daily/term/pattern）的条目数。"""
    conn = get_conn()
    rows = conn.execute(
        "SELECT item_type, COUNT(*) AS n FROM items GROUP BY item_type"
    ).fetchall()
    return {r["item_type"]: r["n"] for r in rows}


def review_totals() -> dict:
    """复习累计：总复习次数、正确次数、正确率（%）与复习流水条数。"""
    conn = get_conn()
    row = conn.execute(
        "SELECT COALESCE(SUM(total_reviews),0) AS total, "
        "       COALESCE(SUM(correct_reviews),0) AS correct "
        "FROM item_stats"
    ).fetchone()
    total, correct = row["total"], row["correct"]
    logs = conn.execute("SELECT COUNT(*) AS n FROM review_logs").fetchone()["n"]
    return {
        "total_reviews": total,
        "correct_reviews": correct,
        "accuracy": round(correct / total * 100, 1) if total else 0.0,
        "log_count": logs,
    }


def stats_daily() -> dict:
    """每天的学习(新增入库)与复习数量。返回 {date_iso: {'study': n, 'review': m}}。"""
    conn = get_conn()
    study = {r["d"]: r["n"] for r in conn.execute(
        "SELECT date(created_at) AS d, COUNT(*) AS n FROM items GROUP BY d").fetchall()}
    review = {r["d"]: r["n"] for r in conn.execute(
        "SELECT date(reviewed_at) AS d, COUNT(*) AS n FROM review_logs GROUP BY d").fetchall()}
    keys = set(study) | set(review)
    return {k: {"study": study.get(k, 0), "review": review.get(k, 0)} for k in sorted(keys)}


def activity_stats() -> dict:
    """坚持统计（以有复习活动的天为准）：累计 / 当前连续 / 最长连续学习天数。"""
    conn = get_conn()
    days = sorted(r["d"] for r in conn.execute(
        "SELECT DISTINCT date(reviewed_at) AS d FROM review_logs").fetchall())
    total = len(days)
    day_set = set(days)
    today = date.today()
    cur = 0
    d = today
    while d.isoformat() in day_set:
        cur += 1
        d -= timedelta(days=1)
    longest = 0
    run = 1 if days else 0
    for i in range(1, len(days)):
        if (date.fromisoformat(days[i]) - date.fromisoformat(days[i - 1])).days == 1:
            run += 1
        else:
            longest = max(longest, run)
            run = 1
    longest = max(longest, run)
    return {"total_days": total, "current": cur, "longest": longest}


# ============================================================
# daily_logs / themes
# ============================================================

def log_daily(log_date: str, daily_theme: str, academic_theme: str, note: str = "") -> None:
    """写入一条每日学习日志。"""
    conn = get_conn()
    payload = _json_text({"log_date": log_date, "daily_theme": daily_theme,
                          "academic_theme": academic_theme, "note": note})
    conn.execute(
        "INSERT INTO daily_logs (log_date, daily_theme, academic_theme, note, raw_json, live_json) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (log_date, daily_theme, academic_theme, note, payload, payload),
    )
    conn.commit()


def add_theme(name: str, category: str, default_type: str = "daily") -> None:
    """注册主题（category: 'daily' | 'academic'；default_type: daily/term/pattern）。重复则忽略。"""
    dt = default_type if default_type in ("daily", "term", "pattern") else "daily"
    conn = get_conn()
    payload = _json_text({"name": name, "category": category, "default_type": dt})
    conn.execute(
        "INSERT OR IGNORE INTO themes (name, category, default_type, raw_json, live_json) "
        "VALUES (?, ?, ?, ?, ?)",
        (name, category, dt, payload, payload),
    )
    conn.commit()


def list_themes(category: str | None = None) -> list[str]:
    """列出主题名。"""
    sql = "SELECT name FROM themes"
    args: list = []
    if category:
        sql += " WHERE category=?"
        args.append(category)
    rows = get_conn().execute(sql, args).fetchall()
    return [r["name"] for r in rows]


def ensure_default_theme() -> None:
    """确保默认主题存在（幂等）。"""
    conn = get_conn()
    conn.execute("INSERT OR IGNORE INTO themes (name, category) VALUES (?, 'daily')",
                 (config.DEFAULT_THEME,))
    conn.commit()


def list_all_themes() -> list[str]:
    """列出全部主题（含默认），供统一主题池使用。"""
    ensure_default_theme()
    rows = get_conn().execute("SELECT name FROM themes ORDER BY name").fetchall()
    return [r["name"] for r in rows]


def rename_theme(old: str, new: str) -> None:
    """重命名主题，并同步该主题下所有知识点。"""
    conn = get_conn()
    conn.execute("UPDATE themes SET name=? WHERE name=?", (new, old))
    conn.execute("UPDATE items SET theme=? WHERE theme=?", (new, old))
    _refresh_live(conn, "themes", "name", new)
    _refresh_items_by_theme(conn, new)
    conn.commit()


def delete_theme(name: str) -> None:
    """删除主题；其下知识点统一归入默认主题。默认主题不可删除。"""
    if name == config.DEFAULT_THEME:
        raise ValueError("默认主题不可删除")
    conn = get_conn()
    conn.execute("UPDATE items SET theme=? WHERE theme=?", (config.DEFAULT_THEME, name))
    conn.execute("DELETE FROM themes WHERE name=?", (name,))
    _refresh_items_by_theme(conn, config.DEFAULT_THEME)
    conn.commit()


def list_themes_with_type() -> list[tuple[str, str]]:
    """列出全部主题及其默认类型（含默认主题），供主题管理展示。"""
    ensure_default_theme()
    rows = get_conn().execute(
        "SELECT name, default_type FROM themes ORDER BY name").fetchall()
    return [(r["name"], r["default_type"] or "daily") for r in rows]


def set_theme_type(name: str, item_type: str) -> int:
    """把主题归入指定类型，并同步其下所有知识点类型。返回受影响条目数。"""
    item_type = item_type if item_type in ("daily", "term", "pattern") else "daily"
    conn = get_conn()
    conn.execute("UPDATE themes SET default_type=? WHERE name=?", (item_type, name))
    _refresh_live(conn, "themes", "name", name)
    cur = conn.execute("UPDATE items SET item_type=? WHERE theme=?", (item_type, name))
    _refresh_items_by_theme(conn, name)
    conn.commit()
    return cur.rowcount


# ============================================================
# 内部辅助
# ============================================================

def _row_to_item(row) -> Item:
    return Item(
        id=row["id"],
        item_type=row["item_type"],
        russian=row["russian"],
        chinese=row["chinese"],
        theme=row["theme"],
        notes=row["notes"],
        tag=row["tag"],
        created_at=row["created_at"],
    )


def _row_to_stat(row) -> ItemStat:
    return ItemStat(
        item_id=row["item_id"],
        level=row["level"],
        streak_a=row["streak_a"],
        last_review=_parse_date(row["last_review"]),
        next_review=_parse_date(row["next_review"]),
        total_reviews=row["total_reviews"],
        correct_reviews=row["correct_reviews"],
    )


def _parse_date(s: str | None) -> date | None:
    if not s:
        return None
    # 兼容 'YYYY-MM-DD' 与 'YYYY-MM-DD HH:MM:SS'
    return datetime.fromisoformat(s.replace(" ", "T")).date() if " " in s else date.fromisoformat(s)
