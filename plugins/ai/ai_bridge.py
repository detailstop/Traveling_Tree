"""
AI 桥接：多平台对话（OpenAI 兼容接口）。

已接入：DeepSeek / Kimi（Moonshot）。
新增平台：在 PROVIDERS 增加一条 {name, url, default_model, hint}，
server.py 路由与前端 tab 无需大改（见模块注释）。
"""
from __future__ import annotations

import json
import socket
import urllib.error
import urllib.request
from pathlib import Path

import config

PROVIDERS = {
    "deepseek": {
        "name": "DeepSeek",
        "url": "https://api.deepseek.com/chat/completions",
        "default_model": "deepseek-chat",
        "hint": "platform.deepseek.com 注册，sk- 开头",
    },
    "kimi": {
        "name": "Kimi（Moonshot）",
        "url": "https://api.moonshot.cn/v1/chat/completions",
        "default_model": "kimi-k2.6",
        "hint": "platform.moonshot.cn 注册，sk- 开头（可用模型以账户实际授权为准）",
    },
    "doubao": {
        "name": "豆包（火山方舟）",
        "url": "https://ark.cn-beijing.volces.com/api/v3/responses",
        "default_model": "doubao-seed-evolving",
        "hint": "火山方舟控制台创建 API Key（ark- 开头）",
        "responses_api": True,  # OpenAI Responses API 风格：input 数组 + content 数组
    },
}
# 旧默认模型迁移映射：Moonshot 已下线 moonshot-v1-* 系列，命中旧值自动换到当前默认
_LEGACY_MODELS = {"moonshot-v1-8k": "kimi-k2.6", "moonshot-v1-32k": "kimi-k2.6"}
# 俄罗斯访问国内 API 链路较慢；长文本 / 长回复为非流式完整等待（服务端生成全程计入本次等待），
# 45s 在长文本场景必然超时 → 放宽至 300s（5 分钟）。流式化（SSE）可作为后续根治方案。
_TIMEOUT = 300


def _keys_path() -> Path:
    return config.DATA_DIR / "ai_keys.json"


def get_keys() -> dict:
    """读取本机保存的 AI Key 配置（含旧默认模型自动迁移）。"""
    try:
        d = json.loads(_keys_path().read_text(encoding="utf-8"))
        if not isinstance(d, dict):
            d = {}
    except Exception:
        d = {}
    changed = False
    for provider, cfg in PROVIDERS.items():
        key = provider + "_model"
        if key in d and d[key] in _LEGACY_MODELS:
            d[key] = _LEGACY_MODELS[d[key]]
            changed = True
    if changed:
        try:
            _keys_path().write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass
    return d


def status() -> dict:
    """各平台配置状态：{ providers: { pid: {has_key, model} } }。"""
    keys = get_keys()
    return {"ok": True, "providers": {
        pid: {
            "has_key": bool(keys.get(pid)),
            "model": keys.get(pid + "_model") or cfg.get("default_model"),
        }
        for pid, cfg in PROVIDERS.items()
    }}


def save_keys(provider: str, key: str, model: str | None = None) -> dict:
    """保存指定平台的 Key / 模型（仅写入非空字段）。"""
    if provider not in PROVIDERS:
        return {"ok": False, "error": f"未知平台：{provider}"}
    merged = get_keys()
    if str(key or "").strip():
        merged[provider] = str(key).strip()
    if str(model or "").strip():
        merged[provider + "_model"] = str(model).strip()
    _keys_path().parent.mkdir(parents=True, exist_ok=True)
    _keys_path().write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True, **{p: bool(merged.get(p)) for p in PROVIDERS}}


def _post_json(url: str, payload: dict, key: str) -> tuple[bool, dict]:
    """POST JSON 到 OpenAI 兼容接口，返回 (成功?, 数据或错误信息)。"""
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + key},
    )
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
            return True, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return False, {"code": exc.code, "msg": exc.read().decode("utf-8", errors="replace")[:500]}
    except (socket.timeout, TimeoutError):
        return False, {"code": "timeout", "msg": "请求超时（网络较慢，请重试）"}
    except urllib.error.URLError as exc:
        return False, {"code": "net", "msg": f"网络错误：{exc.reason or exc}"}


def _hist_pairs(history: list | None, message: str) -> list:
    """history + 当前消息 → [(role, content)]（最近 12 条、单条截断 4000 字）。"""
    pairs = []
    for h in (history or [])[-12:]:
        role = h.get("role") if h.get("role") in ("user", "assistant", "system") else "user"
        pairs.append((role, str(h.get("content") or "")[:4000]))
    pairs.append(("user", str(message or "")[:4000]))
    return pairs


def chat(provider: str, message: str, history: list | None) -> dict:
    """指定平台对话。history: [{role, content}, ...]（最多保留最近 12 条）。"""
    cfg = PROVIDERS.get(provider)
    if not cfg:
        return {"ok": False, "error": f"未知平台：{provider}"}
    keys = get_keys()
    key = keys.get(provider)
    if not key:
        return {"ok": False, "error": f"未配置 {cfg['name']} API Key：点击「⚙ 设置 Key」"}
    model = keys.get(provider + "_model") or cfg["default_model"]
    if cfg.get("responses_api"):
        # 火山方舟 Responses API：input 为消息数组，content 为多模态片段数组
        payload = {"model": model, "input": [
            {"role": r, "content": [{"type": "input_text", "text": t}]}
            for r, t in _hist_pairs(history, message)
        ]}
    else:
        payload = {"model": model, "messages": [
            {"role": r, "content": t}
            for r, t in _hist_pairs(history, message)
        ]}
    ok, data = _post_json(cfg["url"], payload, key)
    if not ok:
        code = data.get("code")
        if code == 401:
            return {"ok": False, "error": "API Key 无效或已过期，请到「⚙ 设置 Key」检查"}
        if code == 429:
            return {"ok": False, "error": "请求过于频繁或账户额度不足（429）"}
        return {"ok": False, "error": data.get("msg") or f"{cfg['name']} 请求失败（{code}）"}
    text = _extract_text(provider, data, cfg)
    if text is None:
        return {"ok": False, "error": f"{cfg['name']} 返回格式异常"}
    return {"ok": True, "text": text, "model": model}


def _extract_text(provider: str, data: dict, cfg: dict) -> str | None:
    """从响应中提取文本（OpenAI Chat 与 Ark Responses 两种结构）。"""
    try:
        if cfg.get("responses_api"):
            parts = []
            for item in data.get("output", []):
                if item.get("type") != "message":
                    continue
                for c in item.get("content", []):
                    if c.get("type") == "output_text" and c.get("text"):
                        parts.append(c["text"])
            return "\n".join(parts) or None
        return data["choices"][0]["message"]["content"]
    except Exception:
        return None
