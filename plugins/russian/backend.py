"""russian 插件后端：接管学习核心的全部 HTTP API。

路由前缀由宿主统一为 `/api/plugin/russian/*`，本模块只处理子路径：
  GET  bootstrap / themes / plan / study/queue / review/queue / items /
       tree / stats / stats/month / stats/months / settings
  POST themes / themes/rename / themes/type / themes/delete / study/rate /
       review/rate / items / items/delete / items/move / import/preview /
       import / settings
  PUT  items/<id>

所有 SQL 经 plugins.russian.repo；模型、SRS、计划器、导入器、seed 全部在插件内。
"""
from __future__ import annotations

import threading
from datetime import date

import config
from modules import settings_store

from plugins.russian import importer, planner, repo
from plugins.russian.models import Item

TYPE_LABELS = {"daily": "日常用语", "term": "学术术语", "pattern": "学术句式"}
LEVEL_LABELS = {"A": "熟", "B": "半熟", "C": "生", "LONG": "长期"}
_LOCK = threading.RLock()


def _settings_path():
    return settings_store.plugin_settings_path("russian")


def _read_settings() -> dict:
    return settings_store.read_at(_settings_path())


def _write_settings(data: dict) -> bool:
    return settings_store.write_at(_settings_path(), data)


def _stat_to_json(s):
    if s is None:
        return None
    return {
        "level": s.level,
        "level_label": LEVEL_LABELS.get(s.level, s.level),
        "streak_a": s.streak_a,
        "last_review": s.last_review.isoformat() if s.last_review else None,
        "next_review": s.next_review.isoformat(),
        "total_reviews": s.total_reviews,
        "correct_reviews": s.correct_reviews,
    }


def _item_json(item: Item, with_stat: bool = False) -> dict:
    d = {
        "id": item.id,
        "item_type": item.item_type,
        "type_label": TYPE_LABELS.get(item.item_type, item.item_type),
        "russian": item.russian,
        "chinese": item.chinese,
        "notes": item.notes,
        "theme": item.theme,
        "tag": item.tag,
        "created_at": item.created_at,
    }
    if with_stat:
        d["stat"] = _stat_to_json(repo.get_stat(item.id))
    return d


def _theme_json() -> list[dict]:
    repo.ensure_default_theme()
    rows = repo.list_themes_with_type()
    counts = repo.theme_item_counts()
    out = []
    for name, dt in rows:
        out.append({
            "name": name,
            "default_type": dt,
            "type_label": TYPE_LABELS.get(dt, dt),
            "item_count": counts.get(name, 0),
        })
    return out


def _tree_json() -> list[dict]:
    """知识库树：周(ISO) → 日 → 类型 → 条目。"""
    from collections import defaultdict
    items = repo.list_items()
    by_week: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    for it in items:
        try:
            d = date.fromisoformat(str(it.created_at or "")[:10])
        except Exception:
            d = date.today()
        by_week[d.isocalendar()[:2]][d][it.item_type].append(it)
    tree = []
    for (y, w) in sorted(by_week.keys()):
        monday = date.fromisocalendar(y, w, 1)
        week_label = f"{y} 年第 {w} 周（{monday.month}/{monday.day} 起）"
        days = []
        for d in sorted(by_week[(y, w)].keys()):
            weekday = "一二三四五六日"[d.weekday()]
            types = []
            for t in ("daily", "term", "pattern"):
                lst = by_week[(y, w)][d].get(t, [])
                if not lst:
                    continue
                types.append({
                    "type": t,
                    "type_label": TYPE_LABELS.get(t, t),
                    "items": [_item_json(it) for it in sorted(lst, key=lambda x: x.created_at or "")],
                })
            days.append({"date": d.isoformat(), "weekday": f"周{weekday}", "types": types})
        tree.append({"key": f"{y}-{w}", "label": week_label, "days": days})
    return tree


def api_bootstrap() -> dict:
    summary = repo.stats_summary()
    themes = _theme_json()
    due_count = len(repo.list_due_items())
    activity = repo.activity_stats()
    today = date.today().isoformat()
    review_today = repo.stats_daily().get(today, {}).get("review", 0)
    return {
        "ok": True,
        "themes": themes,
        "total": summary["total"],
        "by_level": summary["by_level"],
        "due_count": due_count,
        "activity": activity,
        "review_today": review_today,
        "today": today,
        "new_quota": config.DAILY_NEW_QUOTA,
        "review_quota": config.DAILY_REVIEW_QUOTA,
        "settings": api_settings(),
    }


def api_themes() -> dict:
    return {"ok": True, "themes": _theme_json()}


def api_theme_add(data: dict) -> dict:
    name = str(data.get("name", "")).strip()
    if not name:
        return {"ok": False, "error": "主题名不能为空"}
    repo.add_theme(name, "daily")
    return {"ok": True, "themes": _theme_json()}


def api_theme_rename(data: dict) -> dict:
    old = str(data.get("old", "")).strip()
    new = str(data.get("new", "")).strip()
    if not old or not new:
        return {"ok": False, "error": "主题名不能为空"}
    if new == config.DEFAULT_THEME and old != config.DEFAULT_THEME:
        return {"ok": False, "error": "不能重命名到默认主题"}
    repo.rename_theme(old, new)
    return {"ok": True, "themes": _theme_json()}


def api_theme_type(data: dict) -> dict:
    name = str(data.get("name", "")).strip()
    t = str(data.get("item_type", ""))
    if t not in ("daily", "term", "pattern"):
        return {"ok": False, "error": "类型无效"}
    n = repo.set_theme_type(name, t)
    return {"ok": True, "changed": n, "themes": _theme_json()}


def api_theme_delete(data: dict) -> dict:
    name = str(data.get("name", "")).strip()
    try:
        repo.delete_theme(name)
        return {"ok": True, "themes": _theme_json()}
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}


def api_plan(query: dict) -> dict:
    theme = query.get("theme") or config.DEFAULT_THEME
    plan = planner.build_daily_plan(theme)
    new_items = [i for values in plan["new"].values() for i in values]
    new_stats = repo.get_stats([i.id for i in new_items])
    new = {
        t: [{**_item_json(i), "stat": _stat_to_json(new_stats.get(i.id))}
            for i in plan["new"].get(t, [])]
        for t in ("daily", "term", "pattern")
    }
    due = [{"item": _item_json(i), "stat": _stat_to_json(stat)}
           for i, stat in plan["due"]]
    return {
        "ok": True,
        "theme": theme,
        "date": plan["date"],
        "new_quota": config.DAILY_NEW_QUOTA,
        "review_quota": config.DAILY_REVIEW_QUOTA,
        "new": new,
        "new_total": sum(len(v) for v in new.values()),
        "due": due,
    }


def api_study_queue(query: dict) -> dict:
    theme = query.get("theme") or config.DEFAULT_THEME
    new_items = planner.pick_new_items(theme)
    items = [it for t in ("daily", "term", "pattern") for it in new_items.get(t, [])]
    stats = repo.get_stats([it.id for it in items])
    flat = [{"item": _item_json(it), "stat": _stat_to_json(stats.get(it.id))} for it in items]
    return {"ok": True, "theme": theme, "queue": flat}


def api_review_queue() -> dict:
    due = repo.list_due_items()[: max(0, int(config.DAILY_REVIEW_QUOTA))]
    return {"ok": True, "queue": [{"item": _item_json(i), "stat": _stat_to_json(stat)}
                                  for i, stat in due]}


def api_rate(data: dict) -> dict:
    item_id = int(data.get("id") or 0)
    result = str(data.get("result", ""))
    if not item_id:
        return {"ok": False, "error": "缺少条目 id"}
    if result == "skip":
        return {"ok": True, "skipped": True}
    old, new = repo.record_review(item_id, result == "know")
    return {"ok": True, "old": old, "new": new}


def api_items(query: dict) -> dict:
    t = query.get("type") or None
    theme = query.get("theme") or None
    items = repo.list_items_with_stats(item_type=t, theme=theme)
    out = []
    for item, stat in items:
        data = _item_json(item)
        data["stat"] = _stat_to_json(stat)
        out.append(data)
    return {"ok": True, "items": out}


def api_item_add(data: dict) -> dict:
    item = _data_to_item(data)
    if not item.russian or not item.chinese:
        return {"ok": False, "error": "句式与翻译不能为空"}
    item_id = repo.add_item(item)
    return {"ok": True, "id": item_id}


def api_item_update(item_id: int, data: dict) -> dict:
    old = repo.get_item(item_id)
    if old is None:
        return {"ok": False, "error": "条目不存在"}
    item = _data_to_item(data, fallback=old)
    repo.update_item(item_id, item)
    return {"ok": True}


def api_items_delete(data: dict) -> dict:
    ids = [int(x) for x in (data.get("ids") or []) if str(x).isdigit()]
    for i in ids:
        repo.delete_item(i)
    return {"ok": True, "deleted": len(ids)}


def api_items_move(data: dict) -> dict:
    ids = [int(x) for x in (data.get("ids") or []) if str(x).isdigit()]
    theme = str(data.get("theme", "")).strip() or None
    t = str(data.get("item_type", ""))
    if t not in ("daily", "term", "pattern"):
        t = None
    n = 0
    for i in ids:
        old = repo.get_item(i)
        if old is None:
            continue
        new_type = t or old.item_type
        repo.update_item(i, Item(None, new_type, old.russian, old.chinese,
                                 theme, old.notes, old.tag))
        n += 1
    return {"ok": True, "moved": n, "themes": _theme_json()}


def api_stats() -> dict:
    summary = repo.stats_summary()
    return {
        "ok": True,
        "total": summary["total"],
        "by_level": summary["by_level"],
        "by_type": repo.stats_by_type(),
        "totals": repo.review_totals(),
        "activity": repo.activity_stats(),
    }


def api_stats_month(query: dict) -> dict:
    month = query.get("month") or date.today().strftime("%Y-%m")
    daily = repo.stats_daily()
    out = []
    for k in sorted(daily):
        if k.startswith(month):
            out.append({"date": k, "study": daily[k]["study"], "review": daily[k]["review"]})
    return {"ok": True, "month": month, "days": out}


def api_stats_months() -> dict:
    daily = repo.stats_daily()
    months = sorted({k[:7] for k in daily})
    cur = date.today().strftime("%Y-%m")
    if cur not in months:
        months.append(cur)
    return {"ok": True, "months": sorted(months)}


def api_import_preview(data: dict) -> dict:
    text = str(data.get("text", ""))
    items, errors = importer.parse(text)
    return {
        "ok": True,
        "rows": [_item_json(i) for i in items],
        "errors": errors,
        "count": len(items),
    }


def api_import(data: dict) -> dict:
    text = str(data.get("text", ""))
    items, errors = importer.parse(text)
    added = repo.add_items_bulk(items)
    return {
        "ok": True,
        "added": added,
        "dup": max(0, len(items) - added),
        "errors": errors,
    }


def api_settings() -> dict:
    d = _read_settings()
    try:
        ru_size = int(d.get("ru_size") or config.RUSSIAN_FONT_SIZE)
    except (TypeError, ValueError):
        ru_size = config.RUSSIAN_FONT_SIZE
    return {
        "new_quota": config.DAILY_NEW_QUOTA,
        "review_quota": config.DAILY_REVIEW_QUOTA,
        "ru_family": d.get("ru_family") or config.RUSSIAN_FONT_FAMILY,
        "ru_size": ru_size,
        "show_translation": config.CARD_SHOW_TRANSLATION,
        "show_example": config.CARD_SHOW_EXAMPLE,
    }


def api_settings_save(data: dict) -> dict:
    d = _read_settings()
    patch = {}
    if "new_quota" in data:
        patch["new_quota"] = max(0, int(data["new_quota"]))
    if "review_quota" in data:
        patch["review_quota"] = max(0, int(data["review_quota"]))
    if "ru_family" in data:
        patch["ru_family"] = str(data["ru_family"]).strip() or config.RUSSIAN_FONT_FAMILY
    if "ru_size" in data:
        try:
            patch["ru_size"] = max(8, min(int(data["ru_size"]), 80))
        except (TypeError, ValueError):
            pass
    d, ok = settings_store.update_at(_settings_path(), patch)
    if not ok:
        return {"ok": False, "error": "设置保存失败：无法写入 data/plugins/russian/settings.json"}
    if "new_quota" in patch:
        config.DAILY_NEW_QUOTA = patch["new_quota"]
    if "review_quota" in patch:
        config.DAILY_REVIEW_QUOTA = patch["review_quota"]
    return {"ok": True, **api_settings()}


def _data_to_item(data: dict, fallback: Item | None = None) -> Item:
    def f(key, default=""):
        v = data.get(key)
        if v is None:
            return default
        return str(v).strip()

    return Item(
        None,
        f("item_type", (fallback.item_type if fallback else "daily")),
        f("russian", (fallback.russian if fallback else "")),
        f("chinese", (fallback.chinese if fallback else "")),
        f("theme", (fallback.theme if fallback else "")).strip() or None,
        f("notes", (fallback.notes if fallback else "")).strip() or None,
        f("tag", (fallback.tag if fallback else "")).strip() or None,
    )


def _dispatch(method: str, subpath: str, query: dict, body: dict):
    if method == "GET":
        if subpath == "bootstrap":
            return api_bootstrap()
        if subpath == "themes":
            return api_themes()
        if subpath == "plan":
            return api_plan(query)
        if subpath == "study/queue":
            return api_study_queue(query)
        if subpath == "review/queue":
            return api_review_queue()
        if subpath == "items":
            return api_items(query)
        if subpath == "tree":
            return {"ok": True, "tree": _tree_json()}
        if subpath == "stats":
            return api_stats()
        if subpath == "stats/month":
            return api_stats_month(query)
        if subpath == "stats/months":
            return api_stats_months()
        if subpath == "settings":
            return {"ok": True, **api_settings()}
    elif method == "POST":
        if subpath == "themes":
            return api_theme_add(body)
        if subpath == "themes/rename":
            return api_theme_rename(body)
        if subpath == "themes/type":
            return api_theme_type(body)
        if subpath == "themes/delete":
            return api_theme_delete(body)
        if subpath in ("study/rate", "review/rate"):
            return api_rate(body)
        if subpath == "items":
            return api_item_add(body)
        if subpath == "items/delete":
            return api_items_delete(body)
        if subpath == "items/move":
            return api_items_move(body)
        if subpath == "import/preview":
            return api_import_preview(body)
        if subpath == "import":
            return api_import(body)
        if subpath == "settings":
            return api_settings_save(body)
    elif method == "PUT":
        parts = subpath.split("/")
        if len(parts) == 2 and parts[0] == "items" and parts[1].isdigit():
            return api_item_update(int(parts[1]), body)
    return {"ok": False, "error": "not_found", "__status__": 404}


def handle(method: str, subpath: str, query: dict, body: dict):
    """宿主动态路由入口；整段请求串行化，避免 SQLite 写竞争。"""
    with _LOCK:
        return _dispatch(method, subpath, query, body)
