# -*- coding: utf-8 -*-
"""AI 工作台 · 网页层级接口 —— 最小技术验证
Playwright 持久化 profile → 打开 DeepSeek 会话链接 → 输入消息 → 取回回复打印
profile 保存于脚本同目录 webchat_profile/，登录一次后续复用
"""
import os, sys, time, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

URL = "https://chat.deepseek.com/a/chat/s/d5c8b9d4-9a9c-4012-afd0-e29b4dba3761"
BASE = os.path.dirname(os.path.abspath(__file__))
PROFILE = os.path.join(BASE, "webchat_profile")
MSG = "你好，这是一条最小技术验证消息，请用一句话简短回复。"

def log(*a):
    print("[probe]", *a, flush=True)

def main():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        log("启动持久化浏览器 profile=%s", PROFILE)
        ctx = p.chromium.launch_persistent_context(
            PROFILE, headless=False, viewport={"width": 1280, "height": 900}, locale="zh-CN")
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(URL, timeout=60000, wait_until="domcontentloaded")
        log("已打开会话链接，检测登录状态…（若弹出登录页，请在窗口中登录，完成后自动继续）")

        # 候选输入框选择器（DeepSeek 改版时在此追加）
        candidates = [
            "textarea[placeholder*='给 DeepSeek 发送消息']",
            "textarea[placeholder*='DeepSeek']",
            "textarea[placeholder*='发送']",
            "textarea",
            "div[contenteditable='true']",
            "div[contenteditable='true'][role='textbox']",
        ]
        input_sel = None
        deadline = time.time() + 240
        while time.time() < deadline:
            for s in candidates:
                try:
                    loc = page.locator(s)
                    if loc.count() > 0 and loc.first.is_visible():
                        input_sel = s
                        break
                except Exception:
                    pass
            if input_sel:
                break
            low = page.url.lower()
            if "sign_in" in low or "login" in low:
                log("当前为登录页，等待你在窗口中完成登录…")
            time.sleep(2)
        if not input_sel:
            log("超时未找到输入框（可能登录未完成或页面结构变化）")
            log("当前URL=%s", page.url)
            page.screenshot(path=os.path.join(BASE, "webchat_debug.png"))
            log("已保存截图 webchat_debug.png")
            ctx.close()
            return 1

        log("登录态正常，输入框就绪 (selector=%s)", input_sel)
        inp = page.locator(input_sel).first
        inp.fill(MSG)
        page.keyboard.press("Enter")
        log("消息已发送，等待回复生成…")

        # 等待「停止生成」出现 → 消失 = 回复完成
        stop_sel = "button[aria-label*='停止'], button:has-text('停止生成'), [class*='stop']"
        stop_seen = False
        t0 = time.time()
        while time.time() - t0 < 150:
            try:
                st = page.locator(stop_sel).first
                if st.is_visible():
                    stop_seen = True
                elif stop_seen:
                    break
            except Exception:
                pass
            time.sleep(1)
        time.sleep(2)

        # 提取最后一段 AI markdown 文本
        reply = ""
        try:
            reply = page.evaluate("""() => {
                const els = document.querySelectorAll('[class*="ds-markdown"]');
                if (!els.length) return '';
                return els[els.length - 1].innerText || '';
            }""")
        except Exception as e:
            log("提取回复失败: %s", e)
        reply = (reply or "").strip()
        log("===== 验证结果 =====")
        log("回复内容:\n%s", reply[:2000])
        if not reply:
            log("未取到回复文本，保存调试截图")
            page.screenshot(path=os.path.join(BASE, "webchat_debug.png"))
        log("===== 最小验证结束 =====")
        ctx.close()
        return 0 if reply else 2

if __name__ == "__main__":
    sys.exit(main())
