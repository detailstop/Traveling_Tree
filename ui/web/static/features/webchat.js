'use strict';
/* 轻量会话能力：供提示词生成器与接口调试器按需共享。 */
(function () {
async function getSession() {
  try {
    const raw = localStorage.getItem('rt_fq_dsurls');
    const pool = raw ? JSON.parse(raw) : null;
    if (Array.isArray(pool) && pool.length) {
      let idx = parseInt(localStorage.getItem('rt_fq_dsurl_idx') || '0', 10);
      if (!Number.isFinite(idx) || idx < 0) idx = 0;
      const item = pool[idx % pool.length];
      const url = typeof item === 'string' ? item : item && item.url;
      if (url) {
        localStorage.setItem('rt_fq_dsurl_idx', String((idx + 1) % pool.length));
        return url;
      }
    }
    const oldUrl = localStorage.getItem('rt_fq_dsurl');
    if (oldUrl && oldUrl.trim()) return oldUrl.trim();
  } catch (e) {}
  if (S.ai && S.ai.wsess && S.ai.wsess.url) return S.ai.wsess.url;
  const r = await api('/api/plugin/webchat/sessions');
  const sessions = (r && r.sessions) || [];
  return sessions.length ? sessions[0].url : null;
}
function chatPost(url, message, timeoutMs, expect) {
  if (FQ_ABORT) return Promise.resolve({ ok: false, aborted: true, error: '⛔ 已手动中断' });
  const ctl = new AbortController();
  FQ_ABORT_CTLS.add(ctl);
  const tm = setTimeout(() => ctl.abort(), timeoutMs || 195000);
  return fetch('/api/plugin/webchat/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, message, expect: expect || '' }), signal: ctl.signal,
  }).then(r => r.json()).then(r => {
    clearTimeout(tm); FQ_ABORT_CTLS.delete(ctl); return r;
  }).catch(e => {
    clearTimeout(tm); FQ_ABORT_CTLS.delete(ctl);
    const aborted = !!(FQ_ABORT && e && e.name === 'AbortError');
    return { ok: false, error: aborted ? '⛔ 已手动中断' : (e && e.name === 'AbortError' ? '超时（等待超限）' : (e.message || String(e))), timeout: !!(e && e.name === 'AbortError' && !aborted), aborted };
  });
}
function parseJSON(text) {
  let source = String(text || '').trim();
  const fenced = source.match(/```(?:json|js|javascript)?\s*([\s\S]*?)```/i);
  if (fenced) source = fenced[1].trim();
  for (let start = 0; start < source.length; start++) {
    const first = source[start];
    if (first !== '{' && first !== '[') continue;
    const stack = [];
    let inString = false, escaped = false, candidate = '';
    for (let i = start; i < source.length; i++) {
      let ch = source[i];
      if (inString) {
        if (ch.charCodeAt(0) < 32) ch = ' ';
        candidate += ch;
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      candidate += ch;
      if (ch === '"') { inString = true; continue; }
      if (ch === '{' || ch === '[') stack.push(ch);
      else if (ch === '}' || ch === ']') {
        const expected = ch === '}' ? '{' : '[';
        if (stack.pop() !== expected) break;
        if (!stack.length) {
          try { return JSON.parse(candidate); } catch (e) { break; }
        }
      }
    }
  }
  return null;
}
window.__webchat = { getSession, chatPost, parseJSON };
})();
