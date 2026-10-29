# -*- coding: utf-8 -*-
"""铆钉点插件 · 后端业务逻辑（P3 批 1）

由 ui/web/server.py 的 `/api/plugin/rivet/*` 动态加载；业务规则从
`modules/rivet.py` 原样承接（难度 XP、连续/最长、护盾、徽章、强度分、
升降档建议均未改动）。数据文件迁至 `data/plugins/rivet/rivet.json`，
首次加载时从旧 `data/rivet.json` 复制一次，旧文件保留不删。

设计参考市面打卡产品（调研 2026-10）：
- 数据统计：GitHub 风格热力图、连续天数火焰色阶、完成率（周/月/总）、
  周几模式分析、习惯强度分（Loop 式：近 7/14 天完成率加权，非二元归零）
- 循序渐进：难度档位 tiny→easy→standard→challenge（XP 1/2/3/5）；
  连续 7 天自动建议升档；5 日跳过率 >40% 建议降档（只建议，不代改）
- 模式记录：每次打卡可附备注 + 时间戳；周复盘摘要
- 强激励：XP/等级（Level N 需 5×N×(N-1) 累计铆钉值）、连胜护盾
  （连续 7 天 +1，miss 可消耗护盾补卡保 streak）、里程碑徽章（7/30/100/365）
"""
import json
import shutil
import sys
import threading
import time
from datetime import date, datetime, timedelta
from pathlib import Path

_PLUGIN_DIR = Path(__file__).resolve().parent
_ROOT = _PLUGIN_DIR.parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import config

PLUGIN_ID = "rivet"
_lock = threading.Lock()


def _plugin_dir() -> Path:
    return config.plugin_data_dir(PLUGIN_ID)


def _path() -> Path:
    return _plugin_dir() / "rivet.json"


def _legacy_path() -> Path:
    return Path(config.DATA_DIR) / "rivet.json"


def _ensure_data() -> None:
    """首次使用时复制旧 data/rivet.json；旧文件保持不动；无旧文件则落默认 JSON。"""
    target = _path()
    if target.exists():
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    legacy = _legacy_path()
    if legacy.is_file():
        shutil.copyfile(legacy, target)
    else:
        target.write_text(json.dumps({"habits": []}, ensure_ascii=False, indent=2),
                          encoding="utf-8")

DIFFS = {"tiny": 1, "easy": 2, "standard": 3, "challenge": 5}
DIFF_ORDER = ("tiny", "easy", "standard", "challenge")
DIFF_LABELS = {"tiny": "微步", "easy": "轻松", "standard": "标准", "challenge": "挑战"}
SHIELD_MILESTONE = 7          # 连续每 7 天奖励 1 护盾
MILESTONES = {7: "七日之锚", 30: "月铆", 100: "百日铆", 365: "年轮铆"}
STREAK_COLORS = [  # 火焰色阶
    (0, "#d9d9d9"), (2, "#ffc078"), (6, "#ff9f45"), (29, "#ff6b35"),
    (99, "#e03131"), (364, "#9d2fc5"), (10 ** 9, "#f7c600"),
]


def _today() -> str:
    return date.today().isoformat()


def _load() -> dict:
    _ensure_data()
    try:
        with open(_path(), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"habits": []}


def _save(data: dict) -> None:
    _ensure_data()
    with open(_path(), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)


def _d(start: str, offset: int) -> str:
    return (date.fromisoformat(start) + timedelta(days=offset)).isoformat()


def _week_start(today: str = None) -> str:
    t = date.fromisoformat(today or _today())
    return (t - timedelta(days=t.weekday())).isoformat()


def _streak_color(days: int) -> str:
    for cap, c in STREAK_COLORS:
        if days <= cap:
            return c
    return STREAK_COLORS[-1][1]


def _current_streak(habit: dict) -> int:
    """从今天（或昨天）起连续完成的天然日数。"""
    rec = habit.get("records", {})
    today = _today()
    n = 0
    d = today
    if rec.get(d, {}).get("done"):
        n += 1
        d = _d(d, -1)
    while rec.get(d, {}).get("done"):
        n += 1
        d = _d(d, -1)
    return n


def _longest_streak(habit: dict) -> int:
    rec = habit.get("records", {})
    if not rec:
        return 0
    best = cur = 0
    start = min(rec.keys())
    end = _today()
    day = start
    while day <= end:
        if rec.get(day, {}).get("done"):
            cur += 1
            best = max(best, cur)
        else:
            cur = 0
        day = _d(day, 1)
    return best


def _weekday_rate(habit: dict, days: int = 90) -> dict:
    """近 N 天按星期几统计完成率（模式记录 → 找出最容易坚持的日子）。"""
    rec = habit.get("records", {})
    out = {i: {"done": 0, "total": 0} for i in range(7)}
    end = date.fromisoformat(_today())
    for off in range(days):
        d = end - timedelta(days=off)
        if d > end:
            continue
        out[d.weekday()]["total"] += 1
        if rec.get(d.isoformat(), {}).get("done"):
            out[d.weekday()]["done"] += 1
    return {i: {"rate": round(v["done"] / v["total"] * 100) if v["total"] else 0,
                "done": v["done"], "total": v["total"]} for i, v in out.items()}


def _strength(habit: dict) -> int:
    """习惯强度分（Loop 式衰减思路）：0.6×近7天完成率 + 0.4×近14天完成率。"""
    rec = habit.get("records", {})
    end = date.fromisoformat(_today())
    d7 = sum(1 for off in range(7) if rec.get((end - timedelta(days=off)).isoformat(), {}).get("done"))
    d14 = sum(1 for off in range(14) if rec.get((end - timedelta(days=off)).isoformat(), {}).get("done"))
    return round(0.6 * d7 / 7 * 100 + 0.4 * d14 / 14 * 100)


def _rate(rec: dict, span_start: str) -> float:
    """自 span_start 起到今天的完成率（分母=期间自然天数）。"""
    end = date.fromisoformat(_today())
    start = date.fromisoformat(span_start)
    if start > end:
        return 0.0
    total = (end - start).days + 1
    done = sum(1 for off in range(total) if rec.get((end - timedelta(days=off)).isoformat(), {}).get("done"))
    return round(done / total * 100, 1) if total else 0.0


def _level(xp: int) -> dict:
    """等级：Level N 需 5×N×(N-1) 累计 XP（Anchor Loop 公式）。"""
    lv = 1
    while xp >= 5 * (lv + 1) * lv:
        lv += 1
    need_next = 5 * (lv + 1) * lv
    need_cur = 5 * lv * (lv - 1)
    span = need_next - need_cur or 1
    return {"level": lv, "xp": xp, "need_next": need_next,
            "progress": round(min(1, (xp - need_cur) / span) * 100)}


def _heatmap(habit: dict, weeks: int = 53) -> list:
    """GitHub 风格热力图：近 weeks 周，返回 [{date, count, diff}]（按周分组由前端排布）。"""
    rec = habit.get("records", {})
    end = date.fromisoformat(_today())
    start = end - timedelta(days=weeks * 7 - 1)
    out = []
    d = start
    while d <= end:
        iso = d.isoformat()
        r = rec.get(iso, {})
        count = 1 if r.get("done") else 0
        diff = r.get("diff", "") if r.get("done") else ""
        out.append({"date": iso, "count": count, "diff": diff})
        d += timedelta(days=1)
    return out


def _weekly_summary(habits: list) -> list:
    """本周各习惯：目标模式下的进度（本周完成数/每周目标）。"""
    ws = _week_start()
    rows = []
    for h in habits:
        rec = h.get("records", {})
        done = sum(1 for off in range(7)
                   if rec.get(_d(ws, off), {}).get("done"))
        rows.append({"id": h["id"], "name": h["name"], "done": done,
                     "target": h.get("weekly_target") or 0})
    return rows


def data() -> dict:
    """总览数据：所有习惯统计 + 全局等级/徽章。"""
    d = _load()
    habits = d.get("habits", [])
    today = _today()
    total_xp = 0
    today_done = 0
    all_records = {}
    for h in habits:
        rec = h.get("records", {})
        total_xp += h.get("xp", 0)
        if rec.get(today, {}).get("done"):
            today_done += 1
        for k, v in rec.items():
            if v.get("done"):
                all_records[k] = all_records.get(k, 0) + 1
    # 总览热力图（每日完成习惯数）
    end = date.fromisoformat(today)
    heat = []
    for off in range(53 * 7 - 1, -1, -1):
        iso = (end - timedelta(days=off)).isoformat()
        heat.append({"date": iso, "count": all_records.get(iso, 0)})
    lv = _level(total_xp)
    longest = max((_longest_streak(h) for h in habits), default=0)
    # 全局里程碑徽章（以累计打卡次数计）
    total_checkins = sum(len([r for r in h.get("records", {}).values() if r.get("done")]) for h in habits)
    badges = [{"days": k, "name": v, "unlocked": total_checkins >= k}
              for k, v in sorted(MILESTONES.items())]
    return {
        "ok": True,
        "habits": [habit_view(h) for h in habits],
        "total_xp": total_xp, "level": lv,
        "today_done": today_done, "total_checkins": total_checkins,
        "longest_streak": longest,
        "heatmap": heat,
        "badges": badges,
        "weekly": _weekly_summary(habits),
        "today": today,
    }


def habit_view(h: dict) -> dict:
    cur = _current_streak(h)
    rec = h.get("records", {})
    today_rec = rec.get(_today(), {})
    return {
        "id": h["id"], "name": h["name"], "icon": h.get("icon", "🔩"),
        "color": h.get("color", "#4e8cff"), "mode": h.get("mode", "daily"),
        "weekly_target": h.get("weekly_target", 0), "days": h.get("days", []),
        "difficulty": h.get("difficulty", "tiny"),
        "difficulty_label": DIFF_LABELS.get(h.get("difficulty", "tiny"), ""),
        "note": h.get("note", ""), "created": h.get("created", ""),
        "shield": h.get("shield", 0), "xp": h.get("xp", 0),
        "streak": cur, "streak_color": _streak_color(cur),
        "longest": _longest_streak(h),
        "strength": _strength(h),
        "rate_week": _rate(rec, _week_start()),
        "rate_month": _rate(rec, _d(_today(), -29)),
        "rate_all": _rate(rec, h.get("created") or _d(_today(), -364)),
        "weekday": _weekday_rate(h),
        "done_today": today_rec.get("done", False),
        "today_note": today_rec.get("note", ""),
        "today_ts": today_rec.get("ts", ""),
        "suggest_up": cur >= 7 and h.get("difficulty", "tiny") != "challenge",
        "suggest_down": _suggest_down(h),
        "heatmap": _heatmap(h),
    }


def _suggest_down(h: dict) -> bool:
    """5 日跳过率 >40% → 建议降档（仅当习惯已创建满 5 天，避免新习惯误报）。"""
    created = h.get("created", "")
    if not created:
        return False
    try:
        age = (date.fromisoformat(_today()) - date.fromisoformat(created)).days
    except ValueError:
        age = 0
    if age < 5:
        return False
    rec = h.get("records", {})
    end = date.fromisoformat(_today())
    done = sum(1 for off in range(5) if rec.get((end - timedelta(days=off)).isoformat(), {}).get("done"))
    return done <= 2 and h.get("difficulty", "tiny") != "tiny"


def save_habit(item: dict) -> dict:
    """新建/更新习惯。item: {id?, name, icon, color, mode, weekly_target, days, difficulty, note}"""
    d = _load()
    name = (item.get("name") or "").strip()
    if not name:
        return {"ok": False, "error": "习惯名称不能为空"}
    habits = d.get("habits", [])
    hid = item.get("id")
    if hid and any(h["id"] == hid for h in habits):
        h = next(h for h in habits if h["id"] == hid)
        h["name"] = name
        h["icon"] = item.get("icon", h.get("icon", "🔩"))
        h["color"] = item.get("color", h.get("color", "#4e8cff"))
        h["mode"] = item.get("mode", "daily")
        h["weekly_target"] = int(item.get("weekly_target") or 0)
        h["days"] = [str(x) for x in (item.get("days") or [])]
        h["difficulty"] = item.get("difficulty", h.get("difficulty", "tiny"))
        h["note"] = (item.get("note") or "").strip()
    else:
        hid = "h" + str(int(time.time() * 1000))
        habits.append({
            "id": hid, "name": name, "icon": item.get("icon", "🔩"),
            "color": item.get("color", "#4e8cff"), "mode": item.get("mode", "daily"),
            "weekly_target": int(item.get("weekly_target") or 0),
            "days": [str(x) for x in (item.get("days") or [])],
            "difficulty": item.get("difficulty", "tiny"),
            "note": (item.get("note") or "").strip(),
            "created": _today(), "shield": 0, "xp": 0, "records": {},
        })
    d["habits"] = habits
    _save(d)
    return {"ok": True}


def delete_habit(hid: str) -> dict:
    d = _load()
    before = len(d.get("habits", []))
    d["habits"] = [h for h in d.get("habits", []) if h["id"] != hid]
    if len(d["habits"]) == before:
        return {"ok": False, "error": "未找到该习惯"}
    _save(d)
    return {"ok": True}


def checkin(hid: str, note: str = "", use_shield: bool = False) -> dict:
    """打卡 / 取消打卡 / 护盾补卡。

    - checkin(无 use_shield)：若今日未打卡 → 钉入（记 XP、难度、时间、备注）；
      若今日已打卡 → 取消今日打卡（XP 回退）。
    - checkin(use_shield=True)：消耗 1 护盾补最近 7 天内的空缺日（不增加 XP，
      仅保 streak），返回补卡日期。
    """
    d = _load()
    h = next((x for x in d.get("habits", []) if x["id"] == hid), None)
    if not h:
        return {"ok": False, "error": "未找到该习惯"}
    rec = h.setdefault("records", {})
    today = _today()
    today_r = rec.get(today, {})

    if use_shield:
        if h.get("shield", 0) <= 0:
            return {"ok": False, "error": "护盾不足（每连续 7 天奖励 1 盾）"}
        # 找最近 7 天第一个空缺日补卡
        target = None
        for off in range(1, 8):
            iso = _d(today, -off)
            if not rec.get(iso, {}).get("done"):
                target = iso
                break
        if target is None:
            return {"ok": False, "error": "最近 7 天没有空缺日可补"}
        rec[target] = {"done": True, "shield": True, "ts": datetime.now().strftime("%Y-%m-%d %H:%M")}
        h["shield"] = h.get("shield", 0) - 1
        _save(d)
        return {"ok": True, "shield_used": True, "date": target,
                "message": f"护盾已用：补回 {target} ✓"}

    if today_r.get("done"):
        # 取消今日打卡：XP 回退（难度对应值）
        h["xp"] = max(0, h.get("xp", 0) - DIFFS.get(today_r.get("diff", "tiny"), 1))
        rec.pop(today, None)
        _save(d)
        return {"ok": True, "undone": True, "message": "已撤销今日钉入"}

    diff = h.get("difficulty", "tiny")
    xp = DIFFS.get(diff, 1)
    h["xp"] = h.get("xp", 0) + xp
    rec[today] = {"done": True, "diff": diff, "xp": xp,
                  "ts": datetime.now().strftime("%Y-%m-%d %H:%M"),
                  "note": (note or "").strip()}
    # 护盾奖励：新 streak 达到 7 的倍数
    new_streak = _current_streak(h)
    if new_streak > 0 and new_streak % SHIELD_MILESTONE == 0:
        h["shield"] = h.get("shield", 0) + 1
        shield_gain = True
    else:
        shield_gain = False
    _save(d)
    msg = "铆钉已钉入 ✓"
    if shield_gain:
        msg += f"（连续 {new_streak} 天，+1 护盾 🛡️）"
    return {"ok": True, "xp": xp, "streak": new_streak,
            "shield_gain": shield_gain, "message": msg}


def note(hid: str, note: str) -> dict:
    """为今日打卡补写备注。"""
    d = _load()
    h = next((x for x in d.get("habits", []) if x["id"] == hid), None)
    if not h:
        return {"ok": False, "error": "未找到该习惯"}
    rec = h.setdefault("records", {})
    today = _today()
    if not rec.get(today, {}).get("done"):
        return {"ok": False, "error": "今日尚未打卡，先钉入再写备注"}
    rec[today]["note"] = (note or "").strip()
    _save(d)
    return {"ok": True}


# ------------------------------------------------------------
# 插件分发入口：子路径与旧 /api/rivet/* 一一对应
# ------------------------------------------------------------

_METHODS = {
    "data": {"GET", "POST"},
    "habit/save": {"POST"},
    "habit/delete": {"POST"},
    "checkin": {"POST"},
    "note": {"POST"},
}


def handle(method: str, subpath: str, query: dict, body: dict) -> dict:
    """处理 `/api/plugin/rivet/<subpath>`。

    映射：
      data          → data()
      habit/save    → save_habit(body.habit)
      habit/delete  → delete_habit(body.id)
      checkin       → checkin(body.id, body.note, body.use_shield)
      note          → note(body.id, body.note)
    """
    subpath = (subpath or "").strip("/")
    allowed = _METHODS.get(subpath)
    if allowed is None:
        return {"ok": False, "error": "not_found"}
    if method not in allowed:
        return {"ok": False, "error": "method_not_allowed"}
    payload = body if isinstance(body, dict) else {}
    if subpath == "data":
        return data()
    if subpath == "habit/save":
        return save_habit(payload.get("habit") or {})
    if subpath == "habit/delete":
        return delete_habit(str(payload.get("id") or ""))
    if subpath == "checkin":
        return checkin(str(payload.get("id") or ""),
                       str(payload.get("note") or ""),
                       bool(payload.get("use_shield")))
    if subpath == "note":
        return note(str(payload.get("id") or ""), str(payload.get("note") or ""))
    return {"ok": False, "error": "not_found"}
