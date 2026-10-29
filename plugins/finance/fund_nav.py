# -*- coding: utf-8 -*-
"""
基金净值披露：天天基金全量列表 + 单只基金成立以来净值序列。

数据源（均公开、无鉴权）：
- 全量列表: https://fund.eastmoney.com/js/fundcode_search.js  （约 2.8 万条）
- 单只基金: https://fund.eastmoney.com/pingzhongdata/<code>.js （Data_netWorthTrend 为成立以来全量）
本地缓存 24 小时，避免频繁请求。
"""
from __future__ import annotations

import datetime
import json
import re
import time
import urllib.request
from pathlib import Path

import config

FUND_LIST_URL = "https://fund.eastmoney.com/js/fundcode_search.js"
PINGZHONG = "https://fund.eastmoney.com/pingzhongdata/{code}.js"
CACHE_TTL = 24 * 3600


def _get(url: str, timeout: int = 20) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8")


def _cache_dir() -> Path:
    d = config.DATA_DIR / "fund_cache"
    d.mkdir(parents=True, exist_ok=True)
    return d


def fund_list(force: bool = False) -> dict:
    """全量基金列表 [{code,name,type}]，本地缓存 24h。"""
    cf = config.DATA_DIR / "fund_list_cache.json"
    if not force and cf.exists() and time.time() - cf.stat().st_mtime < CACHE_TTL:
        return {"ok": True, "cached": True, "funds": json.loads(cf.read_text(encoding="utf-8"))}
    try:
        js = _get(FUND_LIST_URL)
    except Exception as exc:
        return {"ok": False, "error": f"全量列表获取失败：{exc}"}
    m = re.search(r"var\s+r\s*=\s*(\[.*?\]);", js, re.S)
    if not m:
        return {"ok": False, "error": "全量列表解析失败（接口格式可能已变动）"}
    try:
        raw = json.loads(m.group(1))
    except Exception as exc:
        return {"ok": False, "error": f"全量列表 JSON 解析失败：{exc}"}
    funds = [{"code": x[0], "name": x[2], "type": x[3]}
             for x in raw if len(x) >= 4 and re.fullmatch(r"\d{6}", str(x[0]))]
    if not funds:
        return {"ok": False, "error": "全量列表为空"}
    cf.parent.mkdir(parents=True, exist_ok=True)
    cf.write_text(json.dumps(funds, ensure_ascii=False), encoding="utf-8")
    return {"ok": True, "cached": False, "funds": funds, "count": len(funds)}


def fund_nav(code: str) -> dict:
    """单只基金成立以来净值序列，本地缓存 24h。"""
    code = str(code or "").strip()
    if not re.fullmatch(r"\d{6}", code):
        return {"ok": False, "error": "基金编号应为 6 位数字"}
    cf = _cache_dir() / f"{code}.json"
    if cf.exists() and time.time() - cf.stat().st_mtime < CACHE_TTL:
        data = json.loads(cf.read_text(encoding="utf-8"))
        return {"ok": True, "cached": True, **data}
    try:
        js = _get(PINGZHONG.format(code=code))
    except Exception as exc:
        return {"ok": False, "error": f"获取失败：{exc}"}
    m_name = re.search(r'fS_name\s*=\s*"([^"]+)"', js)
    name = m_name.group(1) if m_name else code
    m = re.search(r"Data_netWorthTrend\s*=\s*(\[.*?\]);", js, re.S)
    if not m:
        return {"ok": False, "error": "净值数据解析失败（该编号可能不是场外基金）"}
    try:
        rows = json.loads(m.group(1))
    except Exception as exc:
        return {"ok": False, "error": f"净值 JSON 解析失败：{exc}"}
    navs = [{
        "date": datetime.datetime.fromtimestamp(r["x"] / 1000).strftime("%Y-%m-%d"),
        "unit_nav": r.get("y"),
        "daily_return_pct": r.get("equityReturn", 0),
    } for r in rows]
    if not navs:
        return {"ok": False, "error": "该基金暂无净值数据"}
    data = {"code": code, "name": name, "navs": navs, "count": len(navs)}
    cf.parent.mkdir(parents=True, exist_ok=True)
    cf.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return {"ok": True, "cached": False, **data}
