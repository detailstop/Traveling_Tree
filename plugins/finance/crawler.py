"""理财量化 · 爬虫层：抓取选定数据源指向的网页，提取纯文本并返回前 N 字摘要。

仅用于获取网页正文做简要预览（无 AI、无简化加工）；动态渲染页面（JS 生成内容）
可能抓不到文本，此时返回明确错误，由前端标记该源失败。
"""
from __future__ import annotations

import gzip
import re
import urllib.request
from urllib.error import HTTPError, URLError

TIMEOUT = 10          # 单页抓取超时（秒）
SNIPPET = 50          # 展示前 50 字
FULL_LIMIT = 6000     # 供 AI 清洗的完整正文上限（字）
MAX_BYTES = 1 << 20   # 响应体上限 1MB

_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")


def _text_from_html(html: str) -> str:
    """HTML → 纯文本（去 script/style/标签，压缩空白）"""
    if not html:
        return ""
    html = re.sub(r"(?is)<(script|style|noscript|svg|head)[^>]*>.*?</\1>", " ", html)
    html = re.sub(r"(?is)<br\s*/?>", "\n", html)
    html = re.sub(r"(?s)<[^>]+>", " ", html)
    html = re.sub(r"\s+", " ", html)
    return html.strip()


def _fetch(url: str) -> str:
    req = urllib.request.Request(url, headers={
        "User-Agent": _UA,
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.6",
    })
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        raw = resp.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raw = raw[:MAX_BYTES]
        enc = resp.headers.get_content_charset() or "utf-8"
        try:
            return raw.decode(enc, errors="replace")
        except (LookupError, UnicodeDecodeError):
            return raw.decode("utf-8", errors="replace")


def crawl(url: str) -> dict:
    """抓取单个网址，返回 {ok, snippet, len, full, error?}
    snippet：正文前 50 字（简要展示）；full：前 FULL_LIMIT 字（供 AI 清洗）"""
    if not url or not isinstance(url, str):
        return {"ok": False, "error": "无效网址"}
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        return {"ok": False, "error": "仅支持 http/https 网址"}
    try:
        html = _fetch(url)
    except HTTPError as exc:
        return {"ok": False, "error": f"HTTP {exc.code}（{url[:60]}）"}
    except URLError as exc:
        reason = getattr(exc, "reason", exc)
        return {"ok": False, "error": f"网络错误：{reason}（{url[:60]}）"}
    except Exception as exc:  # 超时、拒绝等
        return {"ok": False, "error": f"抓取失败：{exc}（{url[:60]}）"}
    text = _text_from_html(html)
    if not text:
        return {"ok": False, "error": "页面无可提取文本（可能为 JS 动态渲染或需登录）"}
    return {"ok": True, "snippet": text[:SNIPPET], "len": len(text), "full": text[:FULL_LIMIT]}
