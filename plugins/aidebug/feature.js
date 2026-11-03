'use strict';
/* 按需加载的功能模块：aidebug */
(function () {
  let ROOT = null;
/* ---------- 外部接口调试器（网页 DS 对接：发送 → 抓取原文 → JSON 解码） ---------- */
const AI_DEBUG_PROMPT = '【角色】你是网页正文清洗专员，严格输出纯JSON，禁止任何额外文本。\n'
  + '【任务】对给定三个信息组中的每条信息进行清洗：判断该条是否包含有效正文。\n'
  + '1. 若该条内容明显不含正文（如仅导航、空白、错误页提示、登录墙、验证码等），返回 status="failed"；\n'
  + '2. 若含有正文，则筛除 UI 界面元素、广告、导航、页脚、推荐位等非正文内容，将纯正文直接返回：不做摘要、不改写、不翻译、不评价，保留原文（仅适度压缩多余空白）。\n'
  + '【输入变量】\n公司事件信息组（company）：\n产业新闻信息组（industry）：\n舆情讨论信息组（discussion）：\n'
  + '【输出要求】仅输出合法JSON对象，禁止输出前缀、后缀、解释、markdown，确保可直接JSON.parse解析。JSON结构严格如下，不得新增、删减、修改键名：\n'
  + '{\n  "company": [ { "url": "原网址", "status": "ok或failed", "title": "正文标题或空字符串", "content": "清洗后正文；failed 时为空字符串" } ],\n'
  + '  "industry": [ { "url": "原网址", "status": "ok或failed", "title": "正文标题或空字符串", "content": "清洗后正文；failed 时为空字符串" } ],\n'
  + '  "discussion": [ { "url": "原网址", "status": "ok或failed", "title": "正文标题或空字符串", "content": "清洗后正文；failed 时为空字符串" } ]\n}\n'
  + '【强制约束】1. 每组条目必须对应输入中的网址，不得新增、删除或改序；无条目的组输出空数组\n'
  + '2. 对明显无正文的条目必须返回 "failed"，不得编造内容\n'
  + '3. 正文保持原样，仅筛除非正文成分，不做摘要、改写、翻译\n'
  + '4. 仅输出JSON对象，无任何其他字符';
async function renderAIDebugTool(container) {
  ROOT = container;
  const box = ROOT;
  let saved = {};
  try { const d = await api('/api/plugin/aidebug/state'); saved = (d && d.state) || {}; } catch (e) { saved = {}; }
  box.innerHTML = `
    <div class="exp-wrap">
      <div class="gcard">
        <div class="section-title"><span class="st-emoji">🛠️</span>外部接口调试器
          <span style="font-size:12px;color:var(--text-dim);font-weight:400;">网页 DS 对接：发送 → 抓取原文 → JSON 解码（与因子分析抓取同一通道）</span></div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
          <span style="font-size:13px;white-space:nowrap;">会话网址</span>
          <input class="input" id="adb-url" value="${esc(saved.url || '')}" placeholder="粘贴 DeepSeek 会话链接 https://chat.deepseek.com/a/chat/s/…" style="flex:1;min-width:240px;padding:5px 8px;font-size:12.5px;">
          <button class="btn soft sm" id="adb-default">⤓ 沿用默认会话</button>
        </div>
        <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:8px;">
          <span style="font-size:13px;white-space:nowrap;padding-top:5px;">提示词</span>
          <textarea id="adb-prompt" rows="9" style="flex:1;min-width:240px;padding:6px 8px;font-size:12.5px;font-family:inherit;line-height:1.45;">${esc(saved.prompt || AI_DEBUG_PROMPT)}</textarea>
        </div>
        <div class="exp-ctrl" style="margin-bottom:8px;">
          <button class="btn sm" id="adb-send">📤 发送并抓取</button>
          <button class="btn sm soft" id="adb-abort" disabled>⏹ 中断</button>
          <button class="btn sm soft" id="adb-clear">🗑 清空结果</button>
          <span id="adb-status" style="font-size:12.5px;color:var(--text-dim);margin-left:6px;"></span>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <div style="flex:1;min-width:300px;">
            <div style="font-size:12.5px;color:var(--text-dim);margin-bottom:4px;">抓取内容（原始文本）</div>
            <pre id="adb-raw" class="adb-pre">${esc(saved.raw || '')}</pre>
          </div>
          <div style="flex:1;min-width:300px;">
            <div style="font-size:12.5px;color:var(--text-dim);margin-bottom:4px;">JSON 解码</div>
            <pre id="adb-json" class="adb-pre">${esc(saved.json || '')}</pre>
          </div>
        </div>
      </div>
      <div class="gcard" style="margin-top:10px;">
        <div class="section-title"><span class="st-emoji">🥥</span>豆包监听已下线</div>
        <div style="font-size:12.5px;color:var(--text-dim);">原豆包 UIA 监听面板已归档下线；外部接口调试器仍可正常使用。</div>
      </div>
    </div>`;
  const $id = x => document.getElementById(x);
  let saveChain = Promise.resolve();
  const saveDbg = () => {
    const snapshot = { url: $id('adb-url').value.trim(), prompt: $id('adb-prompt').value, raw: $id('adb-raw').textContent || '', json: $id('adb-json').textContent || '' };
    saveChain = saveChain
      .then(() => api('/api/plugin/aidebug/state', { method: 'PUT', body: { state: snapshot } }))
      .catch(() => {});
  };
  $id('adb-url').addEventListener('input', saveDbg);
  $id('adb-prompt').addEventListener('input', saveDbg);
  $id('adb-default').onclick = async () => {
    try {
      const u = await window.__webchat.getSession('base');
      if (u) { $id('adb-url').value = u; saveDbg(); toast('已沿用默认会话 ✓', 'success'); }
      else toast('暂无可用的默认会话（请先在 AI 工作台添加会话链接）', 'warn');
    } catch (e) { toast('读取默认会话失败：' + (e && e.message ? e.message : e), 'warn'); }
  };
  $id('adb-send').onclick = async () => {
    const url = $id('adb-url').value.trim();
    const prompt = $id('adb-prompt').value.trim();
    if (!url) return toast('请先填写会话网址', 'warn');
    if (!prompt) return toast('请填写提示词', 'warn');
    const btn = $id('adb-send');
    btn.disabled = true;
    $id('adb-abort').disabled = false;
    const st = $id('adb-status');
    st.textContent = '⏳ 发送中…（等待回复，最长 195 秒）';
    const t0 = Date.now();
    try {
      const r = await window.__webchat.chatPost(url, prompt);
      if (r && r.aborted) { st.textContent = '⛔ 已手动中断'; return; }
      if (!r || !r.ok) {
        st.textContent = '✖ 失败：' + ((r && r.error) || '未知错误') + ((r && r.timeout) ? '（前端超时）' : '');
        $id('adb-raw').textContent = '请求失败，无抓取内容';
        $id('adb-json').textContent = '';
        return;
      }
      const ms = Date.now() - t0;
      const raw = (r.text || '').trim();
      $id('adb-raw').textContent = raw || '（回复为空）';
      const obj = window.__webchat.parseJSON(raw);
      if (obj == null) {
        $id('adb-json').textContent = 'JSON 解析失败：未找到可解析的 JSON 内容（原始文本见左侧）';
        st.textContent = '✔ 抓取完成（' + Math.round(ms / 1000) + 's）· JSON 解码失败';
      } else {
        $id('adb-json').textContent = JSON.stringify(obj, null, 2);
        st.textContent = '✔ 完成（' + Math.round(ms / 1000) + 's）· JSON 解码成功';
      }
      if (r.url && r.url !== url) { st.textContent += ' · 新会话链接已更新'; $id('adb-url').value = r.url; }
      saveDbg();
    } catch (e) {
      st.textContent = '✖ 异常：' + (e && e.message ? e.message : e);
    } finally {
      btn.disabled = false;
      $id('adb-abort').disabled = true;
    }
  };
  $id('adb-abort').onclick = () => fqAbortNow('外部接口调试器');
  $id('adb-clear').onclick = () => {
    $id('adb-raw').textContent = '';
    $id('adb-json').textContent = '';
    $id('adb-status').textContent = '';
    saveDbg();
  };
}


window.__toolRenderers.aidebug = renderAIDebugTool;
})();
