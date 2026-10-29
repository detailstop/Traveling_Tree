"""
网页层级接口：Playwright 控制浏览器打开网页会话（如 DeepSeek 会话链接）。

设计：
  - 专用 worker 线程持有常驻持久化浏览器（登录态存 profile），请求经队列串行执行，线程安全；
  - chat: 打开会话 URL → 定位输入框 → 发送 → 等回复完成 → 提取最后一段回复；
  - login: 以有头窗口打开 DeepSeek 供扫码登录，成功后自动切换回无头常驻；
  - sessions: 会话链接列表持久化于 data/webchat_sessions.json。
"""
from __future__ import annotations

import json
import os
import queue
import re
import threading
import time
import uuid
from pathlib import Path

import config
from modules import settings_store

_PROFILE_DIR = config.plugin_data_dir("webchat") / "webchat_profile"

_SESSIONS_PATH = config.DATA_DIR / "webchat_sessions.json"

# DeepSeek 页面输入框候选选择器（页面改版时在此追加）
_INPUT_CANDIDATES = [
    "textarea[placeholder*='给 DeepSeek 发送消息']",
    "textarea[placeholder*='DeepSeek']",
    "textarea[placeholder*='发送']",
    "textarea",
    "div[contenteditable='true']",
    "div[contenteditable='true'][role='textbox']",
]
_STOP_SELECTOR = "button[aria-label*='停止'], button:has-text('停止生成'), [class*='stop']"
_REPLY_JS = """() => {
  const els = document.querySelectorAll('[class*="ds-markdown"]');
  if (!els.length) return '';
  // 从后往前取最后一个「有实质内容」的块（跳过流式渲染中的占位/进度短文本）
  for (let i = els.length - 1; i >= 0; i--) {
    const t = (els[i].innerText || '').trim();
    if (t.length >= 8) return t;
  }
  return (els[els.length - 1].innerText || '').trim();
}"""
# 拼接全部 ds-markdown 块：长 JSON 在 DS 流式分段渲染时会被拆成多个块，
# 仅取「最后一个块」会抓到无 { 的中间/尾部片段（前端解析必然失败）。
# 拼接全量后由后端 _last_json 提取最后一个可解析的 JSON（新回复）。
_REPLY_JS_ALL = """() => {
  const els = document.querySelectorAll('[class*="ds-markdown"]');
  const parts = [];
  for (let i = 0; i < els.length; i++) {
    const t = (els[i].innerText || '').trim();
    if (t) parts.push(t);
  }
  return parts.join('\\n');
}"""
_MSG_TIMEOUT = 180     # 单次对话总超时（秒）
_REPLY_TIMEOUT = 150   # 等待回复生成超时（秒）
_LOGIN_TIMEOUT = 300   # 登录等待超时（秒）

_jobs: queue.Queue = queue.Queue()
_worker: threading.Thread | None = None
_ctx_state = {"headed": False}  # 当前 ctx 是否临时有头模式
_CTX = None                     # 当前浏览器上下文（worker 线程内维护，供强制重启使用）
_CTX_LOCK = threading.Lock()    # restart 与 worker 重建互斥


def _browsers_dir() -> Path:
    """浏览器二进制目录：默认相对项目 data/playwright_browsers，可用 settings 覆盖。"""
    paths = settings_store.read().get("paths")
    raw = str((paths or {}).get("playwright_browsers") or "").strip() if isinstance(paths, dict) else ""
    p = Path(raw) if raw else Path(config.PLAYWRIGHT_BROWSERS_DIR)
    if not p.is_absolute():
        p = config.BASE_DIR / p
    p = p.expanduser().resolve()
    if not p.is_dir():
        raise RuntimeError(
            f"Playwright 浏览器目录不存在：{p}。"
            "默认相对路径 data/playwright_browsers；"
            "可在 data/settings.json 的 paths.playwright_browsers 指定覆盖。"
        )
    return p


def _ensure_browser_env() -> None:
    """设置 Playwright 浏览器目录；已显式设置环境变量时尊重环境变量。"""
    if os.environ.get("PLAYWRIGHT_BROWSERS_PATH"):
        return
    os.environ["PLAYWRIGHT_BROWSERS_PATH"] = str(_browsers_dir())


def _start_worker() -> None:
    global _worker
    if _worker is not None and _worker.is_alive():
        return
    _worker = threading.Thread(target=_worker_loop, name="webchat-browser", daemon=True)
    _worker.start()


def _do_new_chat(ctx, arg: dict) -> tuple:
    """开启新对话：进入 DeepSeek 首页新会话态（首页即新输入界面）。

    返回 'fresh://' 标记；前端随后的 chat('fresh://', msg) 发送首条消息后
    自动取得真实新会话 URL 并回传。
    """
    try:
        page = _ensure_page(ctx, "https://chat.deepseek.com/")
        if page is None:
            return "err", "页面打开失败"
        if _find_input(page, timeout=12) is None:
            return "err", "未检测到新会话输入框（可能未登录或登录已过期）"
        return "ok", "fresh://"
    except Exception as exc:  # noqa: BLE001
        return "err", f"开启新对话异常：{exc}"


def _do_login(ctx, arg):
    """worker 循环内的登录流程标记（不直接分发执行）。"""
    raise RuntimeError("内部任务标记，不应直接分发")


def _launch(pw, ctx, headless: bool, visible: bool = False):
    """有头常驻（默认窗口移出屏幕，避免打扰桌面）；visible=True 用于登录窗口正常显示。"""
    if ctx is not None:
        try:
            ctx.close()
        except Exception:
            pass
    _ensure_browser_env()
    args = []
    if not headless and not visible:
        args.append("--window-position=-32000,-32000")
    return pw.chromium.launch_persistent_context(
        str(_PROFILE_DIR), headless=headless, args=args,
        viewport={"width": 1280, "height": 900}, locale="zh-CN")


def _ctx_alive(ctx) -> bool:
    """检查常驻浏览器上下文是否仍存活（外部关闭/崩溃时底层已断开）。"""
    if ctx is None:
        return False
    try:
        return bool(getattr(ctx, "browser", None)) and ctx.browser.is_connected()
    except Exception:
        return False


def _default_url() -> str:
    """默认网址：优先最近使用的网页会话链接，否则 DeepSeek 首页。"""
    try:
        if _SESSIONS_PATH.exists():
            data = json.loads(_SESSIONS_PATH.read_text(encoding="utf-8"))
            lst = data if isinstance(data, list) else data.get("sessions", [])
            if lst and lst[0].get("url"):
                return lst[0]["url"]
    except Exception:
        pass
    return "https://chat.deepseek.com/"


def _preload_default(ctx) -> None:
    """浏览器（重新）打开后，默认进入默认网址，保持热页。"""
    try:
        page = _ensure_page(ctx, _default_url())
        if page is not None and _find_input(page, timeout=8) is None:
            pass  # 未登录也保持页面打开，登录后即可对话
    except Exception:
        pass


def _worker_loop() -> None:
    """浏览器常驻线程：任务经队列串行执行，ctx 生命周期在本线程内。
    CloudFront 风控会拦截无头浏览器，故常驻使用有头模式并把窗口移出屏幕。
    浏览器被外部关闭/崩溃时自动重建并重新进入默认网址。"""
    from playwright.sync_api import sync_playwright
    _ensure_browser_env()
    pw = sync_playwright().start()
    ctx = None
    global _CTX
    try:
        while True:
            fn, arg, resp = _jobs.get()
            try:
                if fn is _do_login:
                    with _CTX_LOCK:
                        ctx = _launch(pw, ctx, headless=False, visible=True)
                        _CTX = ctx
                    _ctx_state["headed"] = True
                    resp.append(_wait_login(ctx))
                    with _CTX_LOCK:
                        ctx = _launch(pw, ctx, headless=False, visible=False)
                        _CTX = ctx
                    _ctx_state["headed"] = False
                    _ensure_page._page = None
                    _preload_default(ctx)
                else:
                    if ctx is None or not _ctx_alive(ctx):
                        if not _PROFILE_DIR.exists():
                            resp.append(("err", "浏览器未就绪，请先完成登录"))
                            continue
                        with _CTX_LOCK:
                            ctx = _launch(pw, ctx, headless=False, visible=False)  # 有头 + 移出屏幕
                            _CTX = ctx
                        _ctx_state["headed"] = False
                        _ensure_page._page = None   # 清除指向已关闭浏览器的死页缓存
                        _preload_default(ctx)        # 默认打开并进入默认网址
                    resp.append(fn(ctx, arg))
            except Exception as exc:  # noqa: BLE001
                # 浏览器被关闭/上下文失效：自动重建并重试一次，而非直接报错
                if not _ctx_alive(ctx) or "has been closed" in str(exc) or "Target page" in str(exc):
                    try:
                        if _PROFILE_DIR.exists():
                            with _CTX_LOCK:
                                ctx = _launch(pw, ctx, headless=False, visible=False)
                                _CTX = ctx
                            _ctx_state["headed"] = False
                            _ensure_page._page = None
                            _preload_default(ctx)
                            resp.append(fn(ctx, arg))
                        else:
                            resp.append(("err", f"浏览器异常：{exc}"))
                    except Exception as exc2:  # noqa: BLE001
                        resp.append(("err", f"浏览器异常：{exc2}"))
                else:
                    resp.append(("err", f"浏览器异常：{exc}"))
    finally:
        if ctx is not None:
            try:
                ctx.close()
            except Exception:
                pass
        _CTX = None
        pw.stop()


def _submit(fn, arg, timeout: float) -> tuple:
    """向 worker 提交任务并同步等待结果。"""
    _start_worker()
    resp: list = []
    _jobs.put((fn, arg, resp))
    deadline = time.time() + timeout
    while not resp and time.time() < deadline:
        time.sleep(0.3)
    return resp[0] if resp else ("err", "操作超时")


def _find_input(page, timeout: float):
    """在候选选择器中找可见输入框。"""
    deadline = time.time() + timeout
    while time.time() < deadline:
        for s in _INPUT_CANDIDATES:
            try:
                loc = page.locator(s)
                if loc.count() > 0 and loc.first.is_visible():
                    return s
            except Exception:
                pass
        time.sleep(0.6)
    return None


def _ensure_page(ctx, url: str):
    """复用常驻标签页（模拟网页版热状态）：
    同 URL 直接复用发消息；不同 URL 同页导航（浏览器/缓存/JSS 均热）；
    无页或页面异常时新建。返回 page 或 None（登录页/异常）。
    """
    page = getattr(_ensure_page, "_page", None)
    if page is None:
        _ensure_page._page = None
    if page is not None:
        try:
            cur = page.url
        except Exception:
            page = None
        if page is not None and cur.rstrip('/') == url.rstrip('/'):
            try:
                if _find_input(page, timeout=4) is not None:
                    return page  # 同会话热页，直接复用
            except Exception:
                pass
    if page is not None:
        try:
            page.goto(url, timeout=45000, wait_until="domcontentloaded")
            return page
        except Exception:
            pass
    p = ctx.new_page()
    p.goto(url, timeout=45000, wait_until="domcontentloaded")
    _ensure_page._page = p
    return p


def _wait_login(ctx) -> dict:
    """有头窗口打开 DeepSeek，等待用户在窗口内完成登录（输入框出现 = 登录成功）。"""
    page = None
    try:
        page = ctx.new_page()
        page.goto("https://chat.deepseek.com/", timeout=45000, wait_until="domcontentloaded")
        sel = _find_input(page, timeout=_LOGIN_TIMEOUT)
        if sel is None:
            return {"ok": False, "error": "登录窗口等待超时，未检测到输入框"}
        time.sleep(1)
        return {"ok": True, "error": ""}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": f"登录窗口异常：{exc}"}
    finally:
        if page is not None:
            try:
                page.close()
            except Exception:
                pass


def _first_sess_href(page) -> str:
    """读取侧栏第一个会话链接（最新会话）。DeepSeek 新版侧栏会话为 a[href*='/a/chat/s/']，列表第一个即最新。"""
    try:
        loc = page.locator("a[href*='/a/chat/s/']").first
        return loc.get_attribute("href", timeout=3000) or ""
    except Exception:
        return ""


def _sanitize_json(t: str) -> str:
    """容错：将 JSON 字符串值内的裸控制字符（换行/回车/制表）替换为空格。"""
    out, n, i, in_str = [], len(t), 0, False
    while i < n:
        c = t[i]
        if in_str:
            if c == "\\":
                out.append(t[i:i + 2]); i += 2; continue
            if c == '"':
                in_str = False; out.append(c); i += 1; continue
            if c in "\r\n\t":
                out.append(" "); i += 1; continue
            out.append(c); i += 1; continue
        if c == '"':
            in_str = True
        out.append(c); i += 1
    return "".join(out)


def _json_shape_ok(obj, expect: str) -> bool:
    """校验提取到的 JSON 是否满足调用方期待的结构（用于流式增量渲染防误判：
    整体 JSON 未闭合时，内部单条对象已可解析，但不能当完整回复）。"""
    if expect == "rec":
        if isinstance(obj, dict) and all(isinstance(obj.get(k), list) for k in
                                         ("company_news_platforms", "industry_news_platforms", "investment_discussion_platforms")):
            return True
        # 兼容兜底：长期价值类第 1 层产品补全结构（旧版前端曾统一传 rec）。
        # 不会削弱 L2 流式防误判——生成中途的单条平台对象不含以下六键。
        return isinstance(obj, dict) and all(k in obj for k in
                                             ("product_id", "product_name", "product_type",
                                              "company_full_name", "industry_level1", "list_date"))
    if expect == "prod":
        # 长期价值类第 1 层：产品信息补全（固定字段，缺失填 null）——流式未完成时缺键即不算完成
        return isinstance(obj, dict) and all(k in obj for k in
                                             ("product_id", "product_name", "product_type",
                                              "company_full_name", "industry_level1", "list_date"))
    if expect == "l1arr":
        # 长期价值类 顶层数组层（firm 公司信息 / industry 维度评估）：元素均为含 section/items 的组对象。
        # 防 _last_json 数组型从「最后 [」起步取回内部 items 数组（第三层 items 为数组时，
        # 内部数组先被尝试；其元素无 section/items 键 → 门控拒绝 → 回退到顶层完整数组）
        return isinstance(obj, list) and len(obj) >= 1 and \
               all(isinstance(x, dict) and ("section" in x or "items" in x) for x in obj)
    if expect == "l1arrfin":
        # 长期价值类 第 4 层（finance 对抗性审查）：顶层数组，每条含「置信度得分」
        return isinstance(obj, list) and len(obj) >= 1 and \
               all(isinstance(x, dict) and "置信度得分" in x for x in obj)
    if expect == "clean":
        return isinstance(obj, dict) and all(isinstance(obj.get(k), list) for k in
                                             ("company", "industry", "discussion"))
    if expect == "firm":
        # 第 2 层总览（事件 / 产业 / 舆情三总览）
        return isinstance(obj, dict) and all(isinstance(obj.get(k), dict) for k in
                                             ("event_overview", "industry_news_overview", "opinion_overview"))
    if expect == "mid3":
        # 中期第 3 层单批评估：含四维之一（批次按数据组拆分，仅含本批维度键）
        return isinstance(obj, dict) and any(isinstance(obj.get(k), dict) for k in
                                             ("event_expectation_gap", "industry_expectation_correction",
                                              "public_opinion_score", "opinion_divergence"))
    if expect == "fin":
        # 第 4 层对抗性审查：JSON 数组（元素含 item_name）
        return isinstance(obj, list) and len(obj) >= 1 and all(isinstance(x, dict) and "item_name" in x for x in obj)
    if expect == "risk":
        # 第 5 层标准化评分：对象（item_scores + 总分键）
        return isinstance(obj, dict) and isinstance(obj.get("item_scores"), list) and \
               ("total_mid_score" in obj or "total_score" in obj)
    if expect == "finai":
        # 报表 · AI 分析（总账 / 理财 / 账目建议）：顶层对象须含特征键（summary / assessment）。
        # 禁止宽放为任意 dict/list——否则 _last_json 会把 detail / holdings 等嵌套子对象
        # （单行 {"指标","数值","说明"}）误判为完整回复，导致前端只显示部分分析。
        return isinstance(obj, dict) and ("summary" in obj or "assessment" in obj)
    return True


def _json_incomplete(text: str) -> bool:
    """判断候选回复是否为「疑似 JSON 但尚未输出完整」（用于长 JSON 生成防截断）。"""
    t = text.strip()
    fm = re.search(r"```(?:json|js|javascript)?\s*([\s\S]*?)```", t, re.I)
    if fm:
        t = fm.group(1).strip()
    # 仅当整段以 { 或 [ 开头才视为疑似 JSON：普通文本回复中的 {{变量}} 占位符、
    # 花括号文本（如「请以附件{{附件}}为基础…」）不得误判为未完成 JSON——
    # 否则含占位符的纯文本回复会永远等不到「稳定完成」而超时。
    if not (t.startswith("{") or t.startswith("[")):
        return False  # 非 JSON 回复，无需等待
    try:
        json.loads(_sanitize_json(t))
        return False  # 已可解析，视为完整
    except Exception:
        return True   # 解析失败 → 大概率仍在流式输出


def _last_json(t: str, expect: str = ""):
    """从（可能含历史回复的）拼接文本中提取「最后一个满足期待结构」的可解析 JSON。

    长 JSON 流式分段渲染时，最后一次采样的拼接文本 = 历史回复 + 新回复（DS
    分块不丢字符，块间拼接后仍是完整 JSON）。从文本尾部往前，按「最晚起点 →
    最晚终点」顺序尝试起点/终点组合，返回第一个长度足够（≥16 字符，排除
    [] / {} 等内部空数组误匹配）且可解析的 (片段文本, 解析对象)；无则 None。
    expect 非空时，候选须通过 _json_shape_ok 结构校验——流式增量渲染中整体
    JSON 未闭合前，内部单条对象已可独立解析，若直接返回会导致误判完成。
    """
    starts = [m.start() for m in re.finditer(r"\{", t)]
    ends = [m.start() for m in re.finditer(r"\}", t)]
    for st in reversed(starts):
        for en in reversed(ends):
            if en <= st:
                continue
            seg = t[st:en + 1]
            if len(seg) < 16:
                continue
            try:
                obj = json.loads(_sanitize_json(seg))
            except Exception:
                continue
            if expect and not _json_shape_ok(obj, expect):
                continue   # 单条对象 / 结构不符：视为未完成，继续等待
            return seg, obj
    # 对象型无果 → 数组型顶层
    astarts = [m.start() for m in re.finditer(r"\[", t)]
    aends = [m.start() for m in re.finditer(r"\]", t)]
    for st in reversed(astarts):
        for en in reversed(aends):
            if en <= st:
                continue
            seg = t[st:en + 1]
            if len(seg) < 16:
                continue
            try:
                obj = json.loads(_sanitize_json(seg))
            except Exception:
                continue
            if expect and not _json_shape_ok(obj, expect):
                continue
            return seg, obj
    return None


def _do_chat(ctx, arg: dict) -> tuple:
    """在常驻浏览器中发送消息并取回回复（热页复用 + 间隔采样稳定判定）。

    url='fresh://' 表示「新会话态」：首页输入首条消息，回复完成后提取
    真实新会话 URL 一并返回（供前端缓存复用）。
    """
    url, msg = arg.get("url", ""), arg.get("message", "")
    expect = arg.get("expect", "") or ""
    if not url:
        return "err", "缺少会话链接 url"
    if not msg:
        return "err", "缺少消息内容"
    fresh = url == "fresh://"
    try:
        page = _ensure_page(ctx, "https://chat.deepseek.com/" if fresh else url)
        if page is None:
            return "err", "页面打开失败"

        sel = _find_input(page, timeout=12)
        if sel is None:
            low = page.url.lower()
            if "sign_in" in low or "login" in low or "log in" in low:
                return "need_login", "未登录或登录已过期，请重新登录"
            return "err", f"未找到输入框（页面结构可能变化，URL={page.url}）"

        # 发送前记录最后一条回复（全量拼接 + 最后一块），用于区分新旧回复
        try:
            last0 = (page.evaluate(_REPLY_JS_ALL) or "").strip()
            last0_last = (page.evaluate(_REPLY_JS) or "").strip()
        except Exception:
            last0 = ""
            last0_last = ""
        last0_json = None
        try:
            _lj0 = _last_json(last0, expect)
            if _lj0 is not None:
                last0_json = _lj0[0]   # 旧回复的 JSON 指纹（拼接文本中最后一个满足 expect 的可解析 JSON 片段）
        except Exception:
            last0_json = None

        page.locator(sel).first.fill(msg)
        page.keyboard.press("Enter")

        # 阶段一：等待新回复开始生成（停止按钮出现，或拼接文本发生变化）
        started = False
        t0 = time.time()
        while time.time() - t0 < 15 and not started:
            try:
                if page.locator(_STOP_SELECTOR).first.is_visible():
                    started = True
                    break
            except Exception:
                pass
            try:
                cur_all = (page.evaluate(_REPLY_JS_ALL) or "").strip()
                if cur_all and cur_all != last0:
                    started = True
                    break
            except Exception:
                pass
            time.sleep(0.8)

        # 阶段二：间隔采样提取回复。
        # 判定顺序：
        # 1) 生成中（停止按钮可见）绝不判定完成；
        # 2) 必须出现发送后的新内容（拼接文本 != last0）；
        # 3) 从拼接文本中提取「最后一个可解析 JSON」且 != 旧回复指纹 → 立即完成
        #    （清洗/推荐等 JSON 输出即使被 DS 分段渲染成多个块也能拼回完整 JSON）；
        # 4) 整体拼接稳定 2 次：JSON 场景取提取片段；纯文本场景取「最后一块」新文本；
        # 5) 兜底快照若仍等于旧回复 → 明确报错，绝不把旧回复当成功返回。
        reply, prev, same, prev_last, prev_last2, prev_last3 = "", "", 0, "", "", ""
        t1 = time.time()
        while time.time() - t1 < _REPLY_TIMEOUT:
            time.sleep(1.5)
            try:
                cur = (page.evaluate(_REPLY_JS_ALL) or "").strip()
            except Exception:
                cur = prev
            try:
                cur_last = (page.evaluate(_REPLY_JS) or "").strip()
            except Exception:
                cur_last = ""
            # 记录「上三次采样」的最后一块，供快速判定做稳定确认
            prev_last3, prev_last2, prev_last = prev_last2, prev_last, cur_last
            try:
                stopping = page.locator(_STOP_SELECTOR).first.is_visible()
            except Exception:
                stopping = False
            if stopping:
                same = 0          # 仍在生成，重置稳定计数，继续等待
                prev = cur
                continue
            # 未出现新回复（仍为发送前的拼接文本）：视为未开始生成，继续等待
            if not (cur and cur != last0):
                prev = cur
                continue
            # 新回复的完整 JSON（可解析、不同于旧回复指纹、且满足调用方期待结构）
            # → 立即判定完成。expect 校验防止流式增量渲染中途把「单条平台对象」
            # （整体 JSON 未闭合时已可独立解析）误判为完整回复。
            jj = _last_json(cur, expect)
            if jj is not None:
                seg, obj = jj
                if seg != last0_json and _json_shape_ok(obj, expect):
                    reply = seg
                    break
            # 快速回复：新回复最后一块已变化且停止按钮不可见 → 立即取最后一块完成。
            # 覆盖 DS 秒回场景（1.5s 采样可能错过停止按钮出现又消失的窗口，
            # 若还等「整体稳定 2 次」会误判为未生成而超时）。
            # 三个门槛防误判：
            # - 长度 ≥60 字符：拦截 DS 停顿处的解释性中间输出
            #   （如「注意：只输出润色后的提示词正文，不要任何解释或代码块标记。所以最终只给一句话。」）；
            # - 连续三次采样 cur_last 相同（约 4.5 秒稳定）：拦截流式输出中
            #   段落间短暂停顿的中间块（如「根据修改意见，优化后的提示词如下：」）
            #   被误当完整回复提前返回——要求该块已稳定成型；
            # - 出现新内容后（cur_all != last0）才可能判定。
            if (cur_last and cur_last != last0_last and not stopping and len(cur_last) >= 60
                    and cur_last == prev_last and cur_last == prev_last2 and cur_last == prev_last3):
                reply = cur_last
                break
            # 整体拼接稳定 2 次（文本回复 / JSON 输出完成后）
            if cur == prev:
                same += 1
                if same >= 2:
                    jj2 = _last_json(cur, expect)
                    if jj2 is not None:
                        seg2, obj2 = jj2
                        if seg2 != last0_json and _json_shape_ok(obj2, expect):
                            reply = seg2
                            break
                    if _json_incomplete(cur):
                        same = 0          # JSON 未输出完整，继续等待
                        prev = cur
                        continue
                    if cur_last and cur_last != last0_last:
                        reply = cur_last  # 纯文本回复：返回最后一块
                    else:
                        reply = cur       # 无新文本块时的整体快照
                    break
            else:
                same = 0
            prev = cur
        if not reply:
            try:
                reply = (page.evaluate(_REPLY_JS_ALL) or "").strip()
            except Exception:
                reply = ""
            # 兜底快照仍是发送前的旧回复 → 本次确实没有新回复生成。
            # 此前会把旧回复当成功返回，前端解析失败后立即重试、打断 DS 思考。
            if reply and reply == last0:
                reply = ""
        if not reply:
            try:
                diag = "页面无新内容（URL=" + page.url + "；旧回复拼接长度 " + str(len(last0)) + "，当前拼接长度 " + str(len(cur or "")) + "，最后一块长度 " + str(len(cur_last or "")) + "）"
            except Exception:
                diag = "页面无新内容"
            return "err", "未等到新回复（" + diag + "，可能 DS 未开始、已停止或页面结构变化）"
        if fresh:
            try:
                cur = page.url
                if "/a/chat/s/" not in cur:
                    cur = _first_sess_href(page)
                full = ("https://chat.deepseek.com" + cur) if cur.startswith("/") else cur
            except Exception:
                full = ""
            return "ok", {"text": reply, "url": full}
        return "ok", reply
    finally:
        # 页面保持打开作为热标签页（同 URL 下次直接复用）
        pass


# ---------- 对外 API ----------

def status() -> dict:
    return {
        "ok": True,
        "ready": _PROFILE_DIR.exists(),
        "profile": str(_PROFILE_DIR),
        "headed": _ctx_state["headed"],
    }


def login() -> dict:
    """以有头窗口打开 DeepSeek 供用户登录；成功后自动切换回无头常驻。"""
    code, payload = _submit(_do_login, {}, _LOGIN_TIMEOUT + 60)
    if code != "ok":
        if isinstance(payload, dict):
            return {"ok": False, **payload}
        return {"ok": False, "error": payload}
    return {"ok": True}


def chat(url: str, message: str, expect: str = "") -> dict:
    """网页会话对话。url='fresh://' 时为新会话态，返回含 url 字段。可能返回 need_login 错误码。
    expect：'rec'（推荐三键）/ 'prod'（长期价值类第 1 层产品补全）/ 'clean'（清洗三组）/ 'firm'（总览三键）/ 'mid3'（中期第 3 层四维之一）/
            'fin'（审查数组）/ 'risk'（评分对象）——回复须通过对应结构校验才判完成。"""
    if not _PROFILE_DIR.exists():
        return {"ok": False, "code": "need_login", "error": "尚未登录，请先点击「🔑 登录」"}
    code, payload = _submit(_do_chat, {"url": url, "message": message, "expect": expect}, _MSG_TIMEOUT + 30)
    if code == "ok":
        if url == "fresh://" and isinstance(payload, dict):
            return {"ok": True, "text": payload.get("text", ""), "url": payload.get("url", "")}
        return {"ok": True, "text": payload}
    if code == "need_login":
        return {"ok": False, "code": "need_login", "error": payload}
    return {"ok": False, "error": payload}


def restart() -> dict:
    """强制重启浏览器上下文（用于网页会话卡住 / 超时后恢复）。

    直接关闭当前浏览器 —— 这会中断 worker 正在执行的卡住任务，
    worker 的异常路径随即自动重建浏览器并重新进入默认网址热页，
    因此本接口快速返回，无需等待任务队列。
    """
    global _CTX
    _ensure_browser_env()
    with _CTX_LOCK:
        ctx = _CTX
        _CTX = None
    if ctx is not None:
        try:
            ctx.close()
        except Exception:
            pass
    return {"ok": True, "url": _default_url()}


def new_chat() -> dict:
    """开启新对话：返回 'fresh://' 标记（配合 chat('fresh://', msg) 自动取得新会话 URL）。"""
    if not _PROFILE_DIR.exists():
        return {"ok": False, "code": "need_login", "error": "尚未登录，请先点击「🔑 登录」"}
    code, payload = _submit(_do_new_chat, {}, 40)
    if code == "ok":
        return {"ok": True, "url": payload}
    if code == "need_login":
        return {"ok": False, "code": "need_login", "error": payload}
    return {"ok": False, "error": payload}


# ---------- 会话链接管理（data/webchat_sessions.json） ----------

def _load_sessions() -> list[dict]:
    try:
        d = json.loads(_SESSIONS_PATH.read_text(encoding="utf-8"))
        return d if isinstance(d, list) else []
    except Exception:
        return []


def _save_sessions(lst: list[dict]) -> None:
    _SESSIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    _SESSIONS_PATH.write_text(json.dumps(lst, ensure_ascii=False, indent=2), encoding="utf-8")


def list_sessions() -> dict:
    return {"ok": True, "sessions": _load_sessions()}


def add_session(name: str, url: str) -> dict:
    if not str(url or "").strip():
        return {"ok": False, "error": "链接不能为空"}
    lst = _load_sessions()
    sid = uuid.uuid4().hex[:12]
    lst.append({
        "id": sid,
        "name": str(name or "").strip() or url,
        "url": str(url).strip(),
        "ts": time.strftime("%Y-%m-%d %H:%M"),
    })
    _save_sessions(lst)
    return {"ok": True, "session": lst[-1]}


def delete_session(sid: str) -> dict:
    lst = [s for s in _load_sessions() if s.get("id") != sid]
    _save_sessions(lst)
    return {"ok": True}
